"use client";

import dynamic from "next/dynamic";

// Leaflet needs window/document, so we load it client-side only
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] items-center justify-center rounded-xl border border-border bg-card">
      <span className="text-muted animate-pulse">Načítání mapy...</span>
    </div>
  ),
});

export default function MapaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cenová mapa</h1>
        <p className="mt-2 text-muted">
          Prodejní ceny z cenové mapy Sreality a nabídkové ceny inzerátů na
          mapě.
        </p>
      </div>

      <MapView />
    </div>
  );
}
