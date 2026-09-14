"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Login failed.");
      return;
    }
    router.push(params.get("next") ?? "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel w-full max-w-sm p-8">
      <p className="eyebrow text-pin">Private board</p>
      <h1 className="mt-1 font-display text-2xl text-ink-950">Marketplace Watcher</h1>
      <p className="mt-2 text-sm text-ink-600">Enter the password to see what&rsquo;s been found.</p>

      <div className="mt-6">
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          className="field-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="mt-3 text-sm text-pin">{error}</p>}

      <button type="submit" disabled={loading || !password} className="btn-primary mt-6 w-full">
        {loading ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}
