"use client";

import { useEffect, useState } from "react";
import ImageGallery from "./ImageGallery";

interface BRData {
  images: string[];
  description: string;
  items: { name: string; value: string }[];
  map: { lat: number; lon: number } | null;
}

export default function BezrealitkuDetail({ listingId, sourceId: explicitSourceId }: { listingId: string; sourceId?: string }) {
  const [data, setData] = useState<BRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllParams, setShowAllParams] = useState(false);

  const sourceId = explicitSourceId ?? (listingId.startsWith("bz_") ? listingId.slice(3) : null);

  useEffect(() => {
    if (!sourceId) { setLoading(false); return; }
    fetch(`/api/bezrealitky-detail?id=${sourceId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [sourceId]);

  if (!sourceId) return null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-xl bg-border/20" />
        <div className="h-32 animate-pulse rounded-xl bg-border/20" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {data.images.length > 0 && (
        <ImageGallery images={data.images.map(url => `/api/img-proxy?url=${encodeURIComponent(url)}`)} />
      )}

      {data.items.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Parametry</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(showAllParams ? data.items : data.items.slice(0, 8)).map((item) => (
              <div key={item.name} className="rounded-lg bg-background p-3">
                <div className="text-xs text-muted">{item.name}</div>
                <div className="mt-0.5 text-sm font-medium">{item.value}</div>
              </div>
            ))}
          </div>
          {data.items.length > 8 && (
            <button
              onClick={() => setShowAllParams(!showAllParams)}
              className="mt-4 text-sm text-accent-light transition-colors hover:text-accent"
            >
              {showAllParams ? "Skrýt další parametry" : `Zobrazit všech ${data.items.length} parametrů`}
            </button>
          )}
        </div>
      )}

      {data.description && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Popis</h2>
          <div className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">
            {data.description}
          </div>
        </div>
      )}

      {data.map && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Mapa</h2>
          <a
            href={`https://mapy.cz/zakladni?y=${data.map.lat}&x=${data.map.lon}&z=16`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-2 text-sm font-medium text-accent-light transition-colors hover:bg-accent/20"
          >
            Zobrazit na Mapy.cz ↗
          </a>
          <span className="ml-3 text-xs text-muted">
            {data.map.lat.toFixed(6)}, {data.map.lon.toFixed(6)}
          </span>
        </div>
      )}
    </div>
  );
}
