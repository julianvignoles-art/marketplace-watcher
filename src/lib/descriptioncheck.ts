// Heuristics for the classic Marketplace bait tactic: list an eye-catching
// low price on the card, then put the real price or a "come see it, it's
// rough" condition disclaimer in the description where search results don't
// show it. None of this is exact science — it's regex/keyword heuristics
// over whatever text is on the item's page, so it flags rather than silently
// hides anything it isn't certain about (see flagListing below).

const DEFAULT_RED_FLAGS = [
  "extremely worn",
  "heavily used",
  "heavy wear",
  "as-is",
  "as is",
  "for parts",
  "parts only",
  "doesn't work",
  "does not work",
  "not working",
  "no refunds",
  "no returns",
  "cracked",
  "water damage",
  "missing parts",
  "missing pieces",
  "needs repair",
  "needs work",
];

export interface DescriptionCheckResult {
  excluded: boolean; // hard rule-out (matched the wishlist item's own exclude words)
  flagged: boolean; // soft warning (price mismatch or a default red-flag phrase)
  reasons: string[];
}

function extractDollarAmounts(text: string): number[] {
  const matches = text.matchAll(/\$\s?([\d,]+(?:\.\d{1,2})?)/g);
  const amounts: number[] = [];
  for (const m of matches) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n)) amounts.push(n);
  }
  return amounts;
}

export function checkDescription(params: {
  pageText: string;
  listedPrice: number | null;
  maxPrice: number | null;
  excludeWords: string; // comma-separated, from the wishlist item
}): DescriptionCheckResult {
  const text = params.pageText.toLowerCase();
  const reasons: string[] = [];
  let excluded = false;
  let flagged = false;

  const userExcludes = params.excludeWords
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  for (const word of userExcludes) {
    if (text.includes(word)) {
      excluded = true;
      reasons.push(`Description matches your excluded word "${word}"`);
    }
  }

  if (!excluded) {
    for (const phrase of DEFAULT_RED_FLAGS) {
      if (text.includes(phrase)) {
        flagged = true;
        reasons.push(`Description mentions "${phrase}"`);
      }
    }

    if (params.listedPrice != null) {
      const amounts = extractDollarAmounts(params.pageText);
      const higher = amounts.filter(
        (amt) =>
          amt > params.listedPrice! * 1.3 &&
          (params.maxPrice == null || amt > params.maxPrice)
      );
      if (higher.length > 0) {
        flagged = true;
        const top = Math.max(...higher);
        reasons.push(
          `Listed at $${params.listedPrice} but the page mentions $${top} — might be the real price`
        );
      }
    }
  }

  return { excluded, flagged, reasons };
}
