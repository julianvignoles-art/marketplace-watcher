import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ALLOWED_KEYS = ["webhook_url"];

export async function GET() {
  const rows = await prisma.setting.findMany({ where: { key: { in: ALLOWED_KEYS } } });
  const out: Record<string, string> = {};
  for (const row of rows) out[row.key] = row.value;
  return NextResponse.json({ settings: out });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  for (const key of ALLOWED_KEYS) {
    if (key in body) {
      const value = String(body[key] ?? "").trim();
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
