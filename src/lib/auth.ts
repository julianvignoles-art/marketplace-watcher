import { timingSafeEqualStr } from "./crypto";

// Optional: only checked if SCAN_API_KEY is set, so an external scheduler
// (a Claude scheduled task, a free cron service) can be given a secret to
// call POST /api/scan with. If it's left unset, that endpoint is open —
// consistent with the rest of the app having no login at all.
export function checkScanApiKey(candidate: string | null): boolean {
  const expected = process.env.SCAN_API_KEY ?? "";
  if (!expected) return true;
  if (!candidate) return false;
  return timingSafeEqualStr(candidate, expected);
}
