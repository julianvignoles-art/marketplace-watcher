import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const showDismissed = req.nextUrl.searchParams.get("dismissed") === "true";
  const listings = await prisma.listing.findMany({
    where: { dismissed: showDismissed },
    orderBy: { firstSeenAt: "desc" },
    include: { wishlistItem: { select: { label: true } } },
    take: 200,
  });
  return NextResponse.json({ listings });
}
