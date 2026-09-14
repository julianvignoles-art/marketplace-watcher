export interface ScrapedListing {
  fbItemId: string;
  url: string;
  title: string;
  priceText: string;
  location: string;
  image: string;
}

export interface WishlistCriteria {
  keywords: string; // comma-separated, ANDed
  excludeWords: string; // comma-separated, none may match
  maxPrice: number | null;
  minPrice: number | null;
}

export function parsePrice(priceText: string): number | null {
  const cleaned = priceText.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function tokens(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function matchesCriteria(listing: ScrapedListing, criteria: WishlistCriteria): boolean {
  const title = listing.title.toLowerCase();
  const must = tokens(criteria.keywords);
  const mustNot = tokens(criteria.excludeWords);

  if (must.length > 0 && !must.every((kw) => title.includes(kw))) return false;
  if (mustNot.some((kw) => title.includes(kw))) return false;

  const price = parsePrice(listing.priceText);
  if (criteria.maxPrice != null && price != null && price > criteria.maxPrice) return false;
  if (criteria.minPrice != null && price != null && price < criteria.minPrice) return false;

  return true;
}
