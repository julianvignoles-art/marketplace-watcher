"use client";

import { useEffect, useState } from "react";

const DAYS: { key: string; label: string }[] = [
  { key: "sun", label: "Sun" },
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
];

const INTERVAL_OPTIONS = [
  { minutes: 30, label: "Every 30 minutes" },
  { minutes: 60, label: "Every hour" },
  { minutes: 120, label: "Every 2 hours" },
  { minutes: 360, label: "Every 6 hours" },
  { minutes: 720, label: "Every 12 hours" },
  { minutes: 1440, label: "Once a day" },
];

export default function SettingsPage() {
  const [cookieJson, setCookieJson] = useState("");
  const [sessionStatus, setSessionStatus] = useState<{ configured: boolean; updatedAt: string | null } | null>(
    null
  );
  const [homeLocation, setHomeLocation] = useState("");
  const [homeRadius, setHomeRadius] = useState("25");
  const [scanDays, setScanDays] = useState<Set<string>>(new Set(DAYS.map((d) => d.key)));
  const [scanInterval, setScanInterval] = useState("120");
  const [ntfyTopic, setNtfyTopic] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const [savingCookies, setSavingCookies] = useState(false);
  const [savingArea, setSavingArea] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then(setSessionStatus);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings ?? {};
        setWebhookUrl(s.webhook_url ?? "");
        setNtfyTopic(s.ntfy_topic ?? "");
        setHomeLocation(s.home_location ?? "");
        setHomeRadius(s.home_radius_miles || "25");
        setScanInterval(s.scan_interval_minutes || "120");
        if (s.scan_days) setScanDays(new Set(s.scan_days.split(",")));
      });
  }, []);

  async function saveCookies(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    let cookies;
    try {
      cookies = JSON.parse(cookieJson);
    } catch {
      setError("That's not valid JSON. Paste the exported cookie array as-is.");
      return;
    }
    setSavingCookies(true);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cookies }),
    });
    setSavingCookies(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save session.");
      return;
    }
    const data = await res.json();
    setMessage(`Saved ${data.count} cookies.`);
    setCookieJson("");
    fetch("/api/session")
      .then((r) => r.json())
      .then(setSessionStatus);
  }

  async function clearSession() {
    await fetch("/api/session", { method: "DELETE" });
    setSessionStatus({ configured: false, updatedAt: null });
  }

  async function saveArea(e: React.FormEvent) {
    e.preventDefault();
    setSavingArea(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ home_location: homeLocation, home_radius_miles: homeRadius }),
    });
    setSavingArea(false);
  }

  function toggleDay(key: string) {
    setScanDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function saveSchedule() {
    setSavingSchedule(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scan_days: Array.from(scanDays).join(","),
        scan_interval_minutes: scanInterval,
      }),
    });
    setSavingSchedule(false);
  }

  async function saveNotify(e: React.FormEvent) {
    e.preventDefault();
    setSavingNotify(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ntfy_topic: ntfyTopic, webhook_url: webhookUrl }),
    });
    setSavingNotify(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-950">Settings</h1>
        <p className="mt-1 text-sm text-ink-600">
          Everything here is a one-time setup. No account needed for any of it.
        </p>
      </div>

      <section className="panel space-y-4 p-6">
        <div>
          <h2 className="font-display text-lg text-ink-950">Search area</h2>
          <p className="mt-1 text-sm text-ink-600">
            Where to look and how far to search. Applies to every want ad.
          </p>
        </div>
        <form onSubmit={saveArea} className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div>
            <label className="field-label">Location</label>
            <input
              className="field-input"
              placeholder="e.g. Oakland, CA or 94612"
              value={homeLocation}
              onChange={(e) => setHomeLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Distance (miles)</label>
            <input
              type="number"
              className="field-input"
              value={homeRadius}
              onChange={(e) => setHomeRadius(e.target.value)}
            />
          </div>
          <button type="submit" disabled={savingArea} className="btn-primary">
            {savingArea ? "Saving…" : "Save"}
          </button>
        </form>
      </section>

      <section className="panel space-y-4 p-6">
        <div>
          <h2 className="font-display text-lg text-ink-950">Facebook session</h2>
          <p className="mt-1 text-sm text-ink-600">
            This app reuses your own logged-in browser session — it never asks for your Facebook
            password. In Chrome/Firefox, install a cookie-export extension (e.g. "Cookie-Editor"),
            open facebook.com while logged in, export cookies for the facebook.com domain as JSON,
            and paste that array below. Treat it like a password: whoever has it can act as your
            Marketplace account, so only paste it into an instance you trust and run over HTTPS.
          </p>
        </div>

        <p className="text-sm">
          Status:{" "}
          {sessionStatus?.configured ? (
            <span className="text-brass">
              connected{sessionStatus.updatedAt ? ` · updated ${new Date(sessionStatus.updatedAt).toLocaleString()}` : ""}
            </span>
          ) : (
            <span className="text-pin">not connected</span>
          )}
        </p>

        <form onSubmit={saveCookies} className="space-y-3">
          <textarea
            className="field-input h-32 font-mono text-xs"
            placeholder='[{"name":"c_user","value":"...","domain":".facebook.com","path":"/"}, ...]'
            value={cookieJson}
            onChange={(e) => setCookieJson(e.target.value)}
          />
          {error && <p className="text-sm text-pin">{error}</p>}
          {message && <p className="text-sm text-brass">{message}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={savingCookies || !cookieJson} className="btn-primary">
              {savingCookies ? "Saving…" : "Save session"}
            </button>
            {sessionStatus?.configured && (
              <button type="button" onClick={clearSession} className="btn-ghost">
                Disconnect
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel space-y-4 p-6">
        <div>
          <h2 className="font-display text-lg text-ink-950">Schedule</h2>
          <p className="mt-1 text-sm text-ink-600">Which days to look, and how often on those days.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => toggleDay(d.key)}
              className={`rounded-xl2 border px-3 py-1.5 text-sm transition-colors ${
                scanDays.has(d.key)
                  ? "border-pin bg-pin text-paper-card"
                  : "border-rule text-ink-600 hover:border-ink-400"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="field-label">Frequency</label>
            <select
              className="field-input"
              value={scanInterval}
              onChange={(e) => setScanInterval(e.target.value)}
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.minutes} value={opt.minutes}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={saveSchedule} disabled={savingSchedule} className="btn-primary">
            {savingSchedule ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </section>

      <section className="panel space-y-4 p-6">
        <div>
          <h2 className="font-display text-lg text-ink-950">Get pinged</h2>
          <p className="mt-1 text-sm text-ink-600">
            Free, no account needed: install the{" "}
            <a
              href="https://ntfy.sh"
              target="_blank"
              rel="noreferrer noopener"
              className="text-pin underline"
            >
              ntfy
            </a>{" "}
            app (iOS/Android) or just open ntfy.sh in a browser tab, subscribe to a topic name you
            make up (keep it obscure — anyone who knows it can subscribe too), and put the same
            name here.
          </p>
        </div>
        <form onSubmit={saveNotify} className="space-y-3">
          <div>
            <label className="field-label">ntfy topic</label>
            <input
              className="field-input"
              placeholder="e.g. julian-marketplace-8x2k"
              value={ntfyTopic}
              onChange={(e) => setNtfyTopic(e.target.value)}
            />
          </div>
          <details className="text-xs text-ink-400">
            <summary className="cursor-pointer select-none hover:text-ink-600">
              Advanced: send to Discord/Slack instead
            </summary>
            <div className="mt-2">
              <label className="field-label">Webhook URL</label>
              <input
                className="field-input"
                placeholder="https://discord.com/api/webhooks/…"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
          </details>
          <button type="submit" disabled={savingNotify} className="btn-primary">
            {savingNotify ? "Saving…" : "Save"}
          </button>
        </form>
      </section>
    </div>
  );
}
