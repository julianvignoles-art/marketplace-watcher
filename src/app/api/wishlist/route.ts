import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const WishlistInput = z.object({
  label: z.string().min(1).max(120),
  keywords: z.string().min(1).max(300),
  excludeWords: z.string().max(300).optional().default(""),
  maxPrice: z.number().int().positive().nullable().optional(),
  minPrice: z.number().int().nonnegative().nullable().optional(),
  location: z.string().max(120).optional().default(""),
  radiusMiles: z.number().int().positive().max(500).optional().default(40),
  category: z.string().max(80).optional().default(""),
  active: z.boolean().optional().default(true),
});

export async function GET() {
  const items = await prisma.wishlistItem.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { listings: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = WishlistInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const item = await prisma.wishlistItem.create({ data: parsed.data });
  return NextResponse.json({ item }, { status: 201 });
}
