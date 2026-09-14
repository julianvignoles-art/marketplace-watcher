"use client";

import { useRef } from "react";
import { ScanControl } from "@/components/ScanControl";
import { ListingGrid, type ListingGridHandle } from "@/components/ListingGrid";

export default function DashboardPage() {
  const gridRef = useRef<ListingGridHandle>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-950">The Board</h1>
        <p className="mt-1 text-sm text-ink-600">
          Everything from Marketplace that matches a want ad, newest first.
        </p>
      </div>

      <ScanControl onScanComplete={() => gridRef.current?.refresh()} />

      <ListingGrid ref={gridRef} />
    </div>
  );
}
