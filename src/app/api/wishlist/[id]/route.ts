import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const WishlistPatch = z.object({
  label: z.string().min(1).max(120).optional(),
  keywords: z.string().min(1).max(300).optional(),
  excludeWords: z.string().max(300).optional(),
  maxPrice: z.number().int().positive().nullable().optional(),
  minPrice: z.number().int().nonnegative().nullable().optional(),
  location: z.string().max(120).optional(),
  radiusMiles: z.number().int().positive().max(500).optional(),
  category: z.string().max(80).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = WishlistPatch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const item = await prisma.wishlistItem.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.wishlistItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
