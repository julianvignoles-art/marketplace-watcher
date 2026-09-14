import { prisma } from "./db";

export interface NotifyMatch {
  title: string;
  price: number | null;
  currency: string;
  url: string;
  wishlistLabel: string;
}

export async function sendWebhookNotification(matches: NotifyMatch[]): Promise<void> {
  if (matches.length === 0) return;
  const setting = await prisma.setting.findUnique({ where: { key: "webhook_url" } });
  const url = setting?.value?.trim();
  if (!url) return;

  const lines = matches
    .map((m) => {
      const price = m.price != null ? `${m.currency} ${m.price}` : "price n/a";
      return `• [${m.wishlistLabel}] ${m.title} — ${price}\n${m.url}`;
    })
    .join("\n\n");

  const body = {
    content: `Marketplace Watcher found ${matches.length} new match${matches.length === 1 ? "" : "es"}:\n\n${lines}`,
    text: `Marketplace Watcher found ${matches.length} new match(es):\n\n${lines}`,
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
