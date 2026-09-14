import { chromium, type Cookie } from "playwright";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { decryptSecret } from "./crypto";
import { matchesCriteria, parsePrice, type ScrapedListing } from "./matcher";
import { sendNotifications, type NotifyMatch } from "./notify";
import { geocodeLocation, type LatLon } from "./geocode";
import { checkDescription } from "./descriptioncheck";

const MIN_DELAY_MS = 5000;
const MAX_DELAY_MS = 12000;

function randomDelay(min: number, max: number): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadCookies(): Promise<Cookie[]> {
  const row = await prisma.setting.findUnique({ where: { key: "fb_cookies" } });
  if (!row) {
    throw new Error(
      "No Facebook session is configured. Open Settings and paste your exported facebook.com cookies first."
    );
  }
  const decrypted = decryptSecret(row.value);
  const parsed = JSON.parse(decrypted);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Stored Facebook cookies are empty or malformed. Re-upload them in Settings.");
  }
  return parsed as Cookie[];
}

function buildSearchUrl(
  item: { keywords: string; minPrice: number | null; maxPrice: number | null; category: string },
  home: LatLon | null,
  radiusMiles: number | null
): string {
  const primary = item.keywords.split(",")[0]?.trim() ?? "";
  const base = item.category
    ? `https://www.facebook.com/marketplace/category/${encodeURIComponent(item.category)}`
    : `https://www.facebook.com/marketplace/search`;
  const params = new URLSearchParams();
  if (primary) params.set("query", primary);
  if (item.minPrice != null) params.set("minPrice", String(item.minPrice));
  if (item.maxPrice != null) params.set("maxPrice", String(item.maxPrice));
  if (home) {
    params.set("latitude", String(home.lat));
    params.set("longitude", String(home.lon));
  }
  if (radiusMiles != null) params.set("radius", String(radiusMiles));
  return `${base}/?${params.toString()}`;
}

function splitInnerTextLines(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function extractListings(page: import("playwright").Page): Promise<ScrapedListing[]> {
  const raw = await page.$$eval('a[href*="/marketplace/item/"]', (anchors) =>
    anchors.map((a) => ({
      href: a.getAttribute("href") ?? "",
      text: (a as HTMLElement).innerText ?? "",
      img: a.querySelector("img")?.getAttribute("src") ?? "",
    }))
  );

  const seen = new Set<string>();
  const out: ScrapedListing[] = [];
  for (const entry of raw) {
    const match = entry.href.match(/\/marketplace\/item\/(\d+)/);
    if (!match) continue;
    const fbItemId = match[1];
    if (seen.has(fbItemId)) continue;
    seen.add(fbItemId);

    const lines = splitInnerTextLines(entry.text);
    const priceLine = lines.find((l) => /[$£€]\s?\d/.test(l)) ?? "";
    const remaining = lines.filter((l) => l !== priceLine);
    const title = remaining.sort((a, b) => b.length - a.length)[0] ?? lines[0] ?? "(untitled)";
    const location = remaining.find((l) => l !== title) ?? "";

    out.push({
      fbItemId,
      url: `https://www.facebook.com/marketplace/item/${fbItemId}/`,
      title,
      priceText: priceLine,
      location,
      image: entry.img,
    });
  }
  return out;
}

async function extractItemPageText(page: import("playwright").Page, url: string): Promise<string> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500 + Math.random() * 1000);
  return page.evaluate(() => document.body.innerText);
}

async function assertNotLoggedOut(page: import("playwright").Page): Promise<void> {
  const loginField = await page.$('input[name="email"], input[name="pass"]');
  if (loginField) {
    throw new Error(
      "Facebook returned a login page instead of Marketplace — the stored session has expired or hit a checkpoint. Re-export cookies from a logged-in browser and re-upload them in Settings."
    );
  }
}

export interface ScanResult {
  itemsScanned: number;
  newListings: number;
  errors: string[];
}

export async function runScan(trigger: "manual" | "internal-cron" | "external"): Promise<ScanResult> {
  const run = await prisma.scanRun.create({ data: { trigger } });
  const errors: string[] = [];
  let newListingsTotal = 0;
  let itemsScanned = 0;

  try {
    const cookies = await loadCookies();
    const wishlistItems = await prisma.wishlistItem.findMany({ where: { active: true } });

    if (wishlistItems.length === 0) {
      await prisma.scanRun.update({
        where: { id: run.id },
        data: { status: "ok", finishedAt: new Date(), newMatches: 0 },
      });
      return { itemsScanned: 0, newListings: 0, errors: [] };
    }

    const [locationSetting, radiusSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "home_location" } }),
      prisma.setting.findUnique({ where: { key: "home_radius_miles" } }),
    ]);
    let home: LatLon | null = null;
    if (locationSetting?.value) {
      try {
        home = await geocodeLocation(locationSetting.value);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    const radiusMiles = radiusSetting?.value ? Number(radiusSetting.value) : null;

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
        viewport: { width: 1280, height: 900 },
      });
      await context.addCookies(cookies);
      const page = await context.newPage();

      const allNotifications: NotifyMatch[] = [];

      for (const item of wishlistItems) {
        try {
          const url = buildSearchUrl(item, home, radiusMiles);
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(2000 + Math.random() * 1500);
          await assertNotLoggedOut(page);

          const scraped = await extractListings(page);
          const matched = scraped.filter((listing) =>
            matchesCriteria(listing, {
              keywords: item.keywords,
              excludeWords: item.excludeWords,
              maxPrice: item.maxPrice,
              minPrice: item.minPrice,
            })
          );

          for (const listing of matched) {
            const price = parsePrice(listing.priceText);

            // Already-seen listings are about to hit the unique-constraint
            // skip below anyway, so don't waste a page load re-checking them.
            const alreadySeen = await prisma.listing.findUnique({
              where: { wishlistItemId_fbItemId: { wishlistItemId: item.id, fbItemId: listing.fbItemId } },
              select: { id: true },
            });
            if (alreadySeen) continue;

            let flagged = false;
            let flagReason = "";
            let excluded = false;
            try {
              const pageText = await extractItemPageText(page, listing.url);
              const result = checkDescription({
                pageText,
                listedPrice: price,
                maxPrice: item.maxPrice,
                excludeWords: item.excludeWords,
              });
              excluded = result.excluded;
              flagged = result.flagged;
              flagReason = result.reasons.join("; ");
              await randomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
            } catch (err) {
              // If the description check itself fails (page didn't load, got
              // logged out mid-scan, etc.) don't let that sink the whole
              // listing — just save it unflagged rather than lose a match.
              errors.push(
                `${item.label}: description check failed for ${listing.fbItemId}: ${
                  err instanceof Error ? err.message : String(err)
                }`
              );
            }

            if (excluded) continue;

            try {
              const created = await prisma.listing.create({
                data: {
                  wishlistItemId: item.id,
                  fbItemId: listing.fbItemId,
                  title: listing.title,
                  price,
                  url: listing.url,
                  imageUrl: listing.image,
                  locationText: listing.location,
                  flagged,
                  flagReason,
                },
              });
              newListingsTotal += 1;
              allNotifications.push({
                title: created.title,
                price: created.price,
                currency: created.currency,
                url: created.url,
                wishlistLabel: item.label,
              });
            } catch (createErr) {
              const isDuplicate =
                createErr instanceof Prisma.PrismaClientKnownRequestError &&
                createErr.code === "P2002";
              if (!isDuplicate) {
                errors.push(
                  `${item.label}: failed to save listing ${listing.fbItemId}: ${
                    createErr instanceof Error ? createErr.message : String(createErr)
                  }`
                );
              }
            }
          }

          itemsScanned += 1;
        } catch (err) {
          errors.push(`${item.label}: ${err instanceof Error ? err.message : String(err)}`);
        }

        await randomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
      }

      if (allNotifications.length > 0) {
        await sendNotifications(allNotifications);
      }
    } finally {
      await browser.close();
    }

    await prisma.scanRun.update({
      where: { id: run.id },
      data: {
        status: errors.length > 0 && itemsScanned === 0 ? "error" : "ok",
        finishedAt: new Date(),
        newMatches: newListingsTotal,
        error: errors.join(" | ").slice(0, 2000),
      },
    });

    return { itemsScanned, newListings: newListingsTotal, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.scanRun.update({
      where: { id: run.id },
      data: { status: "error", finishedAt: new Date(), error: message },
    });
    return { itemsScanned, newListings: newListingsTotal, errors: [message] };
  }
}
