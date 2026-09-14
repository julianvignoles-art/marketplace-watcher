import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const dismissed = Boolean(body?.dismissed);
  try {
    const listing = await prisma.listing.update({ where: { id }, data: { dismissed } });
    return NextResponse.json({ listing });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
