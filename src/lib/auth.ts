import crypto from "node:crypto";
import { timingSafeEqualStr } from "./crypto";

const SESSION_COOKIE = "mw_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(payload: string): string {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("APP_SECRET env var must be set (>=16 chars) to sign session cookies.");
  }
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionCookieValue(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `ok.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSessionCookieValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [tag, expiresStr, sig] = parts;
  const payload = `${tag}.${expiresStr}`;
  if (!timingSafeEqualStr(sig, sign(payload))) return false;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;
  return tag === "ok";
}

export function checkAppPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected) return false;
  return timingSafeEqualStr(candidate, expected);
}

export function checkScanApiKey(candidate: string | null): boolean {
  const expected = process.env.SCAN_API_KEY ?? "";
  if (!expected || !candidate) return false;
  return timingSafeEqualStr(candidate, expected);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
