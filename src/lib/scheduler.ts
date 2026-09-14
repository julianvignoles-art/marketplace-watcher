import { prisma } from "./db";
import { runScan } from "./scraper";

let started = false;

const DAY_ABBR = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DEFAULT_DAYS = DAY_ABBR.join(",");
const DEFAULT_INTERVAL_MINUTES = 120;
const TICK_MS = 60_000;

export function startScheduler(): void {
  if (started) return;
  started = true;

  let lastRun = 0;

  prisma.scanRun
    .findFirst({ orderBy: { startedAt: "desc" } })
    .then((last) => {
      if (last) lastRun = last.startedAt.getTime();
    })
    .catch(() => {
      // First boot before the table exists yet — fine, treat as never-run.
    });

  setInterval(async () => {
    try {
      const [daysSetting, intervalSetting] = await Promise.all([
        prisma.setting.findUnique({ where: { key: "scan_days" } }),
        prisma.setting.findUnique({ where: { key: "scan_interval_minutes" } }),
      ]);

      const activeDays = new Set(
        (daysSetting?.value || DEFAULT_DAYS).split(",").map((d) => d.trim().toLowerCase())
      );
      const intervalMinutes = Number(intervalSetting?.value) || DEFAULT_INTERVAL_MINUTES;

      const today = DAY_ABBR[new Date().getDay()];
      if (!activeDays.has(today)) return;

      const now = Date.now();
      if (now - lastRun < intervalMinutes * 60_000) return;
      lastRun = now;

      console.log(`[scheduler] running scan (day ${today} ok, every ${intervalMinutes}m)`);
      const result = await runScan("internal-cron");
      console.log(
        `[scheduler] scan finished: ${result.itemsScanned} items, ${result.newListings} new, ${result.errors.length} errors`
      );
    } catch (err) {
      console.error("[scheduler] tick crashed", err);
    }
  }, TICK_MS);

  console.log("[scheduler] armed — checks every minute whether today/interval call for a scan.");
}
