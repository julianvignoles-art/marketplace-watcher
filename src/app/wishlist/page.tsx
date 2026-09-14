"use client";

import { useEffect, useState, useCallback } from "react";

interface WishlistItem {
  id: string;
  label: string;
  keywords: string;
  excludeWords: string;
  maxPrice: number | null;
  minPrice: number | null;
  location: string;
  radiusMiles: number;
  category: string;
  active: boolean;
  _count: { listings: number };
}

const emptyForm = {
  label: "",
  keywords: "",
  excludeWords: "",
  maxPrice: "",
  minPrice: "",
  location: "",
  radiusMiles: "40",
  category: "",
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/wishlist");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      label: form.label,
      keywords: form.keywords,
      excludeWords: form.excludeWords,
      maxPrice: form.maxPrice ? Number(form.maxPrice) : null,
      minPrice: form.minPrice ? Number(form.minPrice) : null,
      location: form.location,
      radiusMiles: Number(form.radiusMiles) || 40,
      category: form.category,
    };

    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Could not save that item.");
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  async function toggleActive(item: WishlistItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: !i.active } : i)));
    await fetch(`/api/wishlist/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink-950">Want Ads</h1>
          <p className="mt-1 text-sm text-ink-600">
            Each ad runs its own Marketplace search every time the board is checked.
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
          {showForm ? "Close" : "Pin a want ad"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="panel space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Label</label>
              <input
                className="field-input"
                placeholder="e.g. Vintage road bike"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="field-label">Category (optional)</label>
              <input
                className="field-input"
                placeholder="e.g. bicycles"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Must include (comma-separated)</label>
              <input
                className="field-input"
                placeholder="e.g. bianchi, road bike"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Must NOT include (optional)</label>
              <input
                className="field-input"
                placeholder="e.g. parts only, frame only"
                value={form.excludeWords}
                onChange={(e) => setForm({ ...form, excludeWords: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">Min price (optional)</label>
              <input
                type="number"
                className="field-input"
                value={form.minPrice}
                onChange={(e) => setForm({ ...form, minPrice: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">Max price (optional)</label>
              <input
                type="number"
                className="field-input"
                value={form.maxPrice}
                onChange={(e) => setForm({ ...form, maxPrice: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">Location text (optional)</label>
              <input
                className="field-input"
                placeholder="Used for your own reference"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">Radius (miles)</label>
              <input
                type="number"
                className="field-input"
                value={form.radiusMiles}
                onChange={(e) => setForm({ ...form, radiusMiles: e.target.value })}
              />
            </div>
          </div>

          {error && <p className="text-sm text-pin">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Pinning…" : "Pin it up"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="panel p-10 text-center">
            <p className="font-display text-lg text-ink-950">No want ads yet</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-ink-600">
              Pin one up to start watching for it.
            </p>
          </div>
        )}

        {items.map((item) => (
          <div key={item.id} className="panel flex items-start justify-between gap-4 p-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg text-ink-950">{item.label}</h3>
                {!item.active && (
                  <span className="rounded-full bg-paper-deep px-2 py-0.5 text-xs uppercase tracking-wide text-ink-600">
                    paused
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-600">
                includes: <span className="text-ink-950">{item.keywords}</span>
                {item.excludeWords && (
                  <>
                    {" "}
                    · excludes: <span className="text-ink-950">{item.excludeWords}</span>
                  </>
                )}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                {item.minPrice != null || item.maxPrice != null
                  ? `price ${item.minPrice ?? "0"}–${item.maxPrice ?? "∞"}`
                  : "no price limit"}
                {" · "}
                {item._count.listings} found so far
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button onClick={() => toggleActive(item)} className="btn-ghost">
                {item.active ? "Pause" : "Resume"}
              </button>
              <button
                onClick={() => remove(item.id)}
                className="btn-ghost hover:border-pin/60 hover:text-pin"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
