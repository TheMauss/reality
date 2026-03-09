"use client";

import dynamic from "next/dynamic";

const PriceMap = dynamic(() => import("@/components/PriceMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-xl border border-border bg-card"
      style={{ height: "calc(100vh - 180px)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="text-sm text-muted">Načítání mapy…</span>
      </div>
    </div>
  ),
});

export default function MapaPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cenová mapa</h1>
        <p className="mt-1 text-sm text-muted">
          Průměrné prodejní ceny dle krajů a okresů · přiblížením zobrazíte jednotlivé transakce
        </p>
      </div>
      <PriceMap />
    </div>
  );
}
