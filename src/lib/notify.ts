import { prisma } from "./db";

export interface NotifyMatch {
  title: string;
  price: number | null;
  currency: string;
  url: string;
  wishlistLabel: string;
}

function formatMatches(matches: NotifyMatch[]): string {
  return matches
    .map((m) => {
      const price = m.price != null ? `${m.currency} ${m.price}` : "price n/a";
      return `[${m.wishlistLabel}] ${m.title} — ${price}\n${m.url}`;
    })
    .join("\n\n");
}

async function sendNtfy(topic: string, matches: NotifyMatch[]): Promise<void> {
  const title =
    matches.length === 1 ? "Found something on the board" : `Found ${matches.length} things on the board`;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        Title: title,
        Tags: "pushpin",
        // ntfy click-through only supports a single URL, so link to the first match.
        Click: matches[0]?.url ?? "",
      },
      body: formatMatches(matches),
    });
  } catch {
    // Best-effort notification; a failed push should not fail the scan.
  }
}

async function sendWebhook(url: string, matches: NotifyMatch[]): Promise<void> {
  const body = {
    content: `Marketplace Watcher found ${matches.length} new match${matches.length === 1 ? "" : "es"}:\n\n${formatMatches(matches)}`,
    text: `Marketplace Watcher found ${matches.length} new match(es):\n\n${formatMatches(matches)}`,
  };
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Best-effort notification; a failed webhook should not fail the scan.
  }
}

export async function sendNotifications(matches: NotifyMatch[]): Promise<void> {
  if (matches.length === 0) return;

  const rows = await prisma.setting.findMany({
    where: { key: { in: ["ntfy_topic", "webhook_url"] } },
  });
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value.trim()]));

  await Promise.all([
    settings.ntfy_topic ? sendNtfy(settings.ntfy_topic, matches) : Promise.resolve(),
    settings.webhook_url ? sendWebhook(settings.webhook_url, matches) : Promise.resolve(),
  ]);
}
