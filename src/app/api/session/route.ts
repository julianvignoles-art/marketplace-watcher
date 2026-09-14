import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

interface RawCookie {
  name?: string;
  value?: string;
  domain?: string;
  path?: string;
}

export async function GET() {
  const row = await prisma.setting.findUnique({ where: { key: "fb_cookies" } });
  const updated = await prisma.setting.findUnique({ where: { key: "fb_cookies_updated_at" } });
  return NextResponse.json({ configured: Boolean(row), updatedAt: updated?.value ?? null });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const cookies = body?.cookies;

  if (!Array.isArray(cookies) || cookies.length === 0) {
    return NextResponse.json(
      { error: "Expected a non-empty JSON array of cookie objects (name, value, domain, path)." },
      { status: 400 }
    );
  }

  const normalized = (cookies as RawCookie[])
    .filter((c) => typeof c.name === "string" && typeof c.value === "string")
    .map((c) => ({
      name: c.name as string,
      value: c.value as string,
      domain: c.domain && c.domain.length > 0 ? c.domain : ".facebook.com",
      path: c.path && c.path.length > 0 ? c.path : "/",
    }));

  if (normalized.length === 0) {
    return NextResponse.json({ error: "No valid cookies found in payload." }, { status: 400 });
  }

  const encrypted = encryptSecret(JSON.stringify(normalized));
  await prisma.setting.upsert({
    where: { key: "fb_cookies" },
    update: { value: encrypted },
    create: { key: "fb_cookies", value: encrypted },
  });
  await prisma.setting.upsert({
    where: { key: "fb_cookies_updated_at" },
    update: { value: new Date().toISOString() },
    create: { key: "fb_cookies_updated_at", value: new Date().toISOString() },
  });

  return NextResponse.json({ ok: true, count: normalized.length });
}

export async function DELETE() {
  await prisma.setting.deleteMany({ where: { key: { in: ["fb_cookies", "fb_cookies_updated_at"] } } });
  return NextResponse.json({ ok: true });
}
