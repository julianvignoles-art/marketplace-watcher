import { NextRequest, NextResponse } from "next/server";
import { checkScanApiKey } from "@/lib/auth";
import { runScan } from "@/lib/scraper";
import { prisma } from "@/lib/db";

let scanInFlight = false;

// Scans can take minutes (several searches, each rate-limited). We kick the
// scan off in the background and return immediately so callers — including a
// reverse proxy's own request timeout — never have to hold the connection
// open for the full run. Poll GET /api/scan for status.
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!checkScanApiKey(apiKey)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (scanInFlight) {
    return NextResponse.json({ error: "A scan is already running." }, { status: 409 });
  }

  scanInFlight = true;
  runScan(apiKey ? "external" : "manual")
    .catch((err) => {
      console.error("[scan] uncaught error", err);
    })
    .finally(() => {
      scanInFlight = false;
    });

  return NextResponse.json({ started: true }, { status: 202 });
}

export async function GET() {
  const runs = await prisma.scanRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ runs, inFlight: scanInFlight });
}
