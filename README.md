# Marketplace Watcher

Watches Facebook Marketplace for listings that match a wishlist you define (keywords,
price range, category) and shows new matches in a small dashboard — optionally pinging
a Discord/Slack webhook too. It logs in by reusing cookies from your own already-logged-in
browser session, so no Facebook API key or password is ever stored.

## Important: read this before you deploy

Facebook's Terms of Service prohibit automated data collection from Marketplace. This
tool doesn't do anything sneaky (no CAPTCHA solving, no proxy rotation, no fingerprint
spoofing) — it just drives a real browser with your session, slowly, to look up pages
you could look up yourself. But it is still outside what Facebook's terms allow, and
using it means accepting some risk that Facebook flags or restricts the account whose
session you use. Practical ways to keep that risk low:

- Don't set `SCAN_INTERVAL_MINUTES` below ~30–60 and don't add so many wishlist items
  that scans run back-to-back all day.
- Consider using a secondary/alt Facebook account's session rather than your main one,
  if you have one you're comfortable using for this.
- Treat this as a personal tool. It has no built-in limit on how many people can use one
  deployment, but running it for a crowd multiplies the traffic hitting Facebook from one
  session and the risk that goes with it.

If Facebook ever shows a checkpoint/login page instead of Marketplace, the scraper
detects that and reports an error rather than silently failing — re-export your cookies
in Settings when that happens.

## What's actually running

- **Next.js** app (UI + API routes), password-gated behind a single shared login.
- **Playwright** (headless Chromium) does the actual page loads and scraping.
- **SQLite** (via Prisma) stores your wishlist, found listings, and encrypted FB cookies.
- An **internal scheduler** (`node-cron`) triggers a scan every `SCAN_INTERVAL_MINUTES`.
- A **`POST /api/scan`** endpoint, guarded by an API key header, so an external
  scheduler — including a Claude scheduled task — can also trigger a scan on demand.

This needs a host that can run one persistent Node/Docker process (Playwright needs a
real, long-lived browser process — it does not work on a serverless/edge platform like
Vercel's default runtime). Render, Railway, and Fly.io are the common options; a
`render.yaml` is included as one path. Check each provider's current pricing/free-tier
terms yourself since they change.

## Deploying (Render, using the included `render.yaml`)

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In Render: **New → Blueprint**, point it at this GitHub repo. It will read
   `render.yaml` and create the web service with a persistent disk mounted at `/data`.
3. Render will prompt you for `APP_PASSWORD` (the one value marked `sync: false`) —
   set it to whatever password you want to use to log into the app. `APP_SECRET` and
   `SCAN_API_KEY` are auto-generated.
4. Deploy. First build takes a while (it's pulling the Playwright browser image).
5. Once it's live, open the URL, log in with `APP_PASSWORD`, and go to **Settings**.

### Deploying elsewhere (Railway / Fly.io / any Docker host)

The `Dockerfile` is self-contained. Any host that can run an arbitrary Docker image with
a mounted persistent volume works:

1. Point the platform at this repo / the `Dockerfile`.
2. Mount a persistent volume at `/data` (this is where the SQLite DB lives — without a
   persistent volume, your wishlist and matches disappear on every redeploy).
3. Set env vars from `.env.example`: `APP_PASSWORD`, `APP_SECRET`, `SCAN_API_KEY`,
   `SCAN_INTERVAL_MINUTES`. Generate the two secrets with `openssl rand -hex 32`.
4. Expose port `3000`.

## First-time setup once it's deployed

1. **Log in** with `APP_PASSWORD`.
2. **Settings → Facebook session**: install a cookie-export browser extension (e.g.
   "Cookie-Editor" for Chrome/Firefox), open facebook.com while logged into the account
   you want to search with, export cookies for the `facebook.com` domain as JSON, and
   paste the array into the box. This is stored encrypted (AES-256-GCM, keyed by
   `APP_SECRET`) in the SQLite database — never sent anywhere else.
3. **Wishlist**: add items — a label, comma-separated required keywords, optional
   excluded keywords, and an optional price range.
4. Click **Run scan now** on the dashboard to test it, or just wait for the internal
   timer.
5. Optional — **Settings → Notifications**: paste a Discord or Slack incoming-webhook
   URL to get pinged when new matches show up, instead of having to check the dashboard.

## Wiring up a Claude scheduled task (the "web key" part)

`POST /api/scan` starts a scan and returns immediately (`202`); scans can take a few
minutes so it doesn't block on the run finishing. It's guarded by the `SCAN_API_KEY`
you set:

```
curl -X POST https://your-app-url/api/scan \
  -H "x-api-key: YOUR_SCAN_API_KEY"
```

To have Claude trigger this on a schedule, set up a scheduled task in Claude (Pro/Max
plans support scheduled/recurring prompts) whose instruction is essentially "send that
curl request" — give it the URL and the key value from your deployment's environment
variables. This is on top of, not instead of, the app's own internal timer
(`SCAN_INTERVAL_MINUTES`) — you can rely on just the internal timer and skip external
scheduling entirely if you'd rather not wire anything else up.

## Local development

```
npm install
npx playwright install chromium
cp .env.example .env   # then edit the values
npx prisma db push
npm run dev
```

## Known limitations

- Facebook's Marketplace markup changes periodically without notice; if scraping starts
  returning zero results, the CSS selectors in `src/lib/scraper.ts` (`extractListings`)
  are the first thing to check.
- Location/radius targeting relies on Facebook's own query parameters and your account's
  default location — there's no independent geocoding here.
- This is a single-shared-login app, not a multi-tenant product: everyone who has the
  `APP_PASSWORD` sees the same wishlist and the same Facebook session.
