"use client";

import { useEffect, useState, useCallback } from "react";

interface ScanRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  newMatches: number;
  error: string;
  trigger: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function ScanControl({ onScanComplete }: { onScanComplete?: () => void }) {
  const [runs, setRuns] = useState<ScanRun[]>([]);
  const [inFlight, setInFlight] = useState(false);
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/scan");
    if (!res.ok) return;
    const data = await res.json();
    setRuns(data.runs ?? []);
    setInFlight(Boolean(data.inFlight));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!inFlight && runs[0]?.status && runs[0].status !== "running") {
      onScanComplete?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inFlight, runs[0]?.id, runs[0]?.status]);

  async function triggerScan() {
    setStarting(true);
    await fetch("/api/scan", { method: "POST" });
    setStarting(false);
    refresh();
  }

  const latest = runs[0];
  const busy = inFlight || starting;

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {busy && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass opacity-60" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${busy ? "bg-brass" : "bg-ink-400"}`}
            />
          </span>
          <div>
            <h2 className="font-display text-lg text-ink-950">On watch</h2>
            <p className="mt-0.5 text-sm text-ink-600">
              {busy
                ? "Out checking the listings…"
                : latest
                  ? `Last look ${timeAgo(latest.startedAt)} — ${latest.status}${
                      latest.status === "ok" ? `, ${latest.newMatches} new` : ""
                    }`
                  : "Hasn't looked yet."}
            </p>
          </div>
        </div>
        <button onClick={triggerScan} disabled={busy} className="btn-primary shrink-0">
          {busy ? "Looking…" : "Look now"}
        </button>
      </div>

      {latest?.error && (
        <p className="mt-3 rounded-xl2 border border-pin/30 bg-pin/10 p-3 text-xs text-pin">
          {latest.error}
        </p>
      )}

      {runs.length > 0 && (
        <details className="mt-4 text-xs text-ink-600">
          <summary className="cursor-pointer select-none hover:text-ink-950">
            Past looks ({runs.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {runs.map((r) => (
              <li key={r.id} className="flex justify-between border-t border-dashed border-rule py-1">
                <span>
                  {timeAgo(r.startedAt)} · {r.trigger}
                </span>
                <span className={r.status === "error" ? "text-pin" : "text-brass"}>
                  {r.status} {r.status === "ok" ? `(${r.newMatches})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
