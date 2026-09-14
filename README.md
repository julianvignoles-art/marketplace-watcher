# Marketplace Watcher

Watches Facebook Marketplace near a location you set, for the things on a wishlist you
define, and pings your phone when it finds a match. No Facebook API key, no account
system, no login screen — set it up once and forget about it.

## Important: read this before you deploy

Facebook's Terms of Service prohibit automated data collection from Marketplace. This
tool doesn't do anything sneaky (no CAPTCHA solving, no proxy rotation, no fingerprint
spoofing) — it just drives a real browser with your session, slowly, to look up pages
you could look up yourself. But it is still outside what Facebook's terms allow, and
using it means accepting some risk that Facebook flags or restricts the account whose
session you use. Practical ways to keep that risk low:

- Don't set the scan frequency (Settings > Schedule) below ~30 minutes, and don't pin up
  so many want ads that a single look takes a long time to get through all of them.
- Consider using a secondary/alt Facebook account's session rather than your main one,
  if you have one you're comfortable using for this.

If Facebook ever shows a checkpoint/login page instead of Marketplace, the scraper
detects that and reports an error on the dashboard rather than silently failing —
re-export your cookies in Settings when that happens.

## There is no login — on purpose, with a tradeoff

This app has no password, no account, nothing to sign into. Open the URL, it works.
The tradeoff: **anyone who has the URL can open the dashboard, change your want ads, or
replace your Facebook session.** They can't extract your actual Facebook cookies through
the app (they're encrypted at rest and the API never returns the raw value), but they
could mess with your setup or point the scanner at their own account's session instead
of yours. For a personal deployment this is a reasonable trade — just don't post the
URL publicly, and use a host that gives you a hard-to-guess URL (Render's default
`*.onrender.com` subdomains are fine for this).

## What's actually running

- **Next.js** app (UI + API routes) — no auth layer at all.
- **Playwright** (headless Chromium) does the actual page loads and scraping.
- **SQLite** (via Prisma) stores your want ads, found listings, and your encrypted
  Facebook cookies.
- **OpenStreetMap's Nominatim** (free, no API key, no signup) turns the location you
  type in Settings into coordinates, cached so it's only looked up once.
- An **internal scheduler** checks every minute whether today is one of your chosen
  days and enough time has passed since the last look — both set in Settings, no
  redeploy needed to change them.
- **ntfy.sh** (free, no account) is the default way to get pinged when something's
  found. A Discord/Slack webhook is also supported as an "advanced" alternative.
- A **`POST /api/scan`** endpoint exists for triggering a look from outside (e.g. a
  Claude scheduled task) — entirely optional, see below.

This needs a host that can run one persistent Node/Docker process (Playwright needs a
real, long-lived browser process — it does not work on a serverless/edge platform like
Vercel's default runtime). Render, Railway, and Fly.io are the common options; a
`render.yaml` is included as one path. Check each provider's current pricing/free-tier
terms yourself since they change.

## Deploying (Render, using the included `render.yaml`)

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In Render: **New → Blueprint**, point it at this GitHub repo. It reads `render.yaml`
   and creates the web service with a persistent disk mounted at `/data`.
   `APP_SECRET` is auto-generated for you.
3. Deploy. First build takes a while (it's pulling the Playwright browser image).
4. Once it's live, open the URL Render gives you. That's it — no login.

### Deploying elsewhere (Railway / Fly.io / any Docker host)

The `Dockerfile` is self-contained. Any host that can run an arbitrary Docker image with
a mounted persistent volume works:

1. Point the platform at this repo / the `Dockerfile`.
2. Mount a persistent volume at `/data` (this is where the SQLite DB lives — without a
   persistent volume, your want ads and matches disappear on every redeploy).
3. Set `APP_SECRET` (generate with `openssl rand -hex 32`). That's the only required
   env var — see `.env.example` for the optional `SCAN_API_KEY`.
4. Expose port `3000`.

## First-time setup once it's deployed

1. **Settings → Search area**: type a city or zip code and how far you're willing to
   travel. This applies to every want ad — no need to repeat it per item.
2. **Settings → Facebook session**: install a cookie-export browser extension (e.g.
   "Cookie-Editor" for Chrome/Firefox), open facebook.com while logged into the account
   you want to search with, export cookies for the `facebook.com` domain as JSON, and
   paste the array into the box. This is stored encrypted (AES-256-GCM, keyed by
   `APP_SECRET`) in the SQLite database — never sent anywhere else.
3. **Want Ads**: pin up items — a label, comma-separated required keywords, optional
   excluded keywords, and an optional price range.
4. **Settings → Schedule**: pick which days to look and how often on those days.
5. **Settings → Get pinged**: install the free [ntfy](https://ntfy.sh) app (iOS/Android)
   or just open ntfy.sh in a browser tab, make up a topic name (keep it obscure — it's
   the only thing standing between someone else and your notifications), subscribe to
   it, and put that same name in Settings.
6. Click **Look now** on the dashboard to test it, or just wait for the schedule.

## Optional: triggering a look from outside (Claude scheduled task, cron, etc.)

The Settings > Schedule day/frequency picker is the primary way this app runs itself —
you don't need anything below this line unless you specifically want an outside trigger
too (for example, in addition to the built-in schedule).

Set `SCAN_API_KEY` as an environment variable, then:

```
curl -X POST https://your-app-url/api/scan \
  -H "x-api-key: YOUR_SCAN_API_KEY"
```

`POST /api/scan` starts a look and returns immediately (`202`); looks can take a few
minutes so it doesn't block on the run finishing. If `SCAN_API_KEY` is never set, this
endpoint is open (consistent with the rest of the app having no login) — fine for a
personal deployment, just know it's there.

## Local development

```
npm install
npx playwright install chromium
cp .env.example .env   # then edit APP_SECRET
npx prisma db push
npm run dev
```

## Known limitations

- Facebook's Marketplace markup changes periodically without notice; if scraping starts
  returning zero results, the CSS selectors in `src/lib/scraper.ts` (`extractListings`)
  are the first thing to check.
- The `latitude`/`longitude`/`radius` search parameters are not officially documented by
  Facebook and could change or be ignored; distance is treated as miles, which is an
  assumption, not a confirmed spec.
- This is a single shared setup, not a multi-tenant product: everyone who opens the app
  sees the same want ads, the same Facebook session, and the same search area.
