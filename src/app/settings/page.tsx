"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [cookieJson, setCookieJson] = useState("");
  const [sessionStatus, setSessionStatus] = useState<{ configured: boolean; updatedAt: string | null } | null>(
    null
  );
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savingCookies, setSavingCookies] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then(setSessionStatus);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setWebhookUrl(d.settings?.webhook_url ?? ""));
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

  async function saveWebhook(e: React.FormEvent) {
    e.preventDefault();
    setSavingWebhook(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ webhook_url: webhookUrl }),
    });
    setSavingWebhook(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-950">Settings</h1>
        <p className="mt-1 text-sm text-ink-600">
          Connect your Facebook session and choose how you hear about new finds.
        </p>
      </div>

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
          <h2 className="font-display text-lg text-ink-950">Notifications</h2>
          <p className="mt-1 text-sm text-ink-600">
            Optional. Paste a Discord or Slack incoming-webhook URL and new finds get posted there
            automatically after every look.
          </p>
        </div>
        <form onSubmit={saveWebhook} className="flex gap-2">
          <input
            className="field-input"
            placeholder="https://discord.com/api/webhooks/…"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <button type="submit" disabled={savingWebhook} className="btn-primary shrink-0">
            {savingWebhook ? "Saving…" : "Save"}
          </button>
        </form>
      </section>

      <section className="panel space-y-3 p-6">
        <h2 className="font-display text-lg text-ink-950">Scheduling scans</h2>
        <p className="text-sm text-ink-600">
          By default this app checks Marketplace on its own internal timer
          (<code>SCAN_INTERVAL_MINUTES</code>, set during deployment). To also trigger a look from
          an outside scheduler — like a Claude scheduled task, or a free cron service — send an
          authenticated request to this app's scan endpoint:
        </p>
        <pre className="overflow-x-auto rounded-xl2 border border-rule/70 bg-ink-950 p-4 text-xs text-paper">
{`curl -X POST https://YOUR-DEPLOYED-DOMAIN/api/scan \\
  -H "x-api-key: YOUR_SCAN_API_KEY"`}
        </pre>
        <p className="text-sm text-ink-600">
          <code>YOUR_SCAN_API_KEY</code> is whatever you set the <code>SCAN_API_KEY</code>{" "}
          environment variable to when you deployed. Full instructions are in the README.
        </p>
      </section>
    </div>
  );
}
