"use client";

import { useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";

interface Listing {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  url: string;
  imageUrl: string;
  locationText: string;
  firstSeenAt: string;
  flagged: boolean;
  flagReason: string;
  wishlistItem: { label: string };
}

export interface ListingGridHandle {
  refresh: () => void;
}

export const ListingGrid = forwardRef<ListingGridHandle>(function ListingGrid(_props, ref) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/listings");
    if (res.ok) {
      const data = await res.json();
      setListings(data.listings ?? []);
    }
    setLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  useEffect(() => {
    load();
  }, [load]);

  async function dismiss(id: string) {
    setListings((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    });
  }

  if (loading) {
    return <p className="text-sm text-ink-600">Reading the board…</p>;
  }

  if (listings.length === 0) {
    return (
      <div className="panel p-10 text-center">
        <p className="font-display text-lg text-ink-950">Board&rsquo;s empty</p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink-600">
          Pin a want ad and run a scan — anything that matches gets tacked up here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 pt-2 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((l) => (
        <div
          key={l.id}
          className={`pinned-card group flex flex-col transition-transform hover:!rotate-0 hover:z-10 ${
            l.flagged ? "outline outline-2 outline-brass/70" : ""
          }`}
        >
          {l.flagged && (
            <div
              className="rounded-t-xl2 border-b border-brass/40 bg-brass/15 px-3 py-1.5 text-xs text-brass"
              title={l.flagReason}
            >
              ⚠ {l.flagReason || "Worth a second look"}
            </div>
          )}
          <a href={l.url} target="_blank" rel="noreferrer noopener" className="flex flex-1 flex-col">
            <div
              className={`aspect-[4/3] w-full overflow-hidden border-b border-rule/70 bg-paper-deep ${
                l.flagged ? "" : "rounded-t-xl2"
              }`}
            >
              {l.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.imageUrl}
                  alt={l.title}
                  className="h-full w-full object-cover grayscale-[15%] transition-all duration-300 group-hover:grayscale-0"
                />
              ) : (
                <div className="flex h-full items-center justify-center font-display text-xs uppercase tracking-widest text-ink-400">
                  no photo
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-4">
              <span className="eyebrow text-pin">{l.wishlistItem.label}</span>
              <h3 className="line-clamp-2 text-[0.95rem] font-semibold leading-snug text-ink-950">
                {l.title}
              </h3>
              <div className="mt-auto flex items-end justify-between pt-3">
                <span className="font-display text-lg text-brass">
                  {l.price != null ? `${l.currency} ${l.price}` : "n/a"}
                </span>
                <span className="text-xs text-ink-400">{l.locationText}</span>
              </div>
            </div>
          </a>
          <button
            onClick={() => dismiss(l.id)}
            className="rounded-b-xl2 border-t border-dashed border-rule py-2 text-xs uppercase tracking-wide text-ink-400 hover:bg-paper-deep/60 hover:text-pin"
          >
            Take it down
          </button>
        </div>
      ))}
    </div>
  );
});
