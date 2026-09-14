import { prisma } from "./db";

export interface LatLon {
  lat: number;
  lon: number;
}

// OpenStreetMap's Nominatim needs no API key/account, only a descriptive
// User-Agent per its usage policy: https://operations.osmfoundation.org/policies/nominatim/
const USER_AGENT = "marketplace-watcher (personal self-hosted app)";

export async function geocodeLocation(rawText: string): Promise<LatLon | null> {
  const text = rawText.trim().toLowerCase();
  if (!text) return null;

  const cached = await prisma.geocodeCache.findUnique({ where: { query: text } });
  if (cached) return { lat: cached.lat, lon: cached.lon };

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Location lookup failed (${res.status}). Try a more specific city/zip.`);
  }
  const results = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (results.length === 0) {
    throw new Error(`Couldn't find "${rawText}" — try a nearby city name or zip code instead.`);
  }

  const lat = Number(results[0].lat);
  const lon = Number(results[0].lon);
  await prisma.geocodeCache.upsert({
    where: { query: text },
    update: { lat, lon },
    create: { query: text, lat, lon },
  });
  return { lat, lon };
}
