import { runScan } from "./scraper";

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  const minutes = Number(process.env.SCAN_INTERVAL_MINUTES ?? "60");
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.log("[scheduler] SCAN_INTERVAL_MINUTES disabled; internal timer will not run.");
    return;
  }

  const intervalMs = minutes * 60_000;
  setInterval(async () => {
    console.log(`[scheduler] running scan (every ${minutes}m)`);
    try {
      const result = await runScan("internal-cron");
      console.log(
        `[scheduler] scan finished: ${result.itemsScanned} items, ${result.newListings} new, ${result.errors.length} errors`
      );
    } catch (err) {
      console.error("[scheduler] scan crashed", err);
    }
  }, intervalMs);

  console.log(`[scheduler] internal timer armed, every ${minutes} minute(s).`);
}
