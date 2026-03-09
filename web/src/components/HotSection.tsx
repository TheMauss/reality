"use client";

import { useState } from "react";

export interface HotDrop {
  id: number;
  listing_id: string;
  old_price: number;
  new_price: number;
  drop_pct: number;
  title: string;
  location: string;
  category: string;
  area_m2: number | null;
  thumbs: string[];
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)} M Kč`;
  return `${Math.round(price).toLocaleString("cs-CZ")} Kč`;
}

function getCatColor(cat: string): string {
  const map: Record<string, string> = {
    "byty-prodej": "#818cf8",
    "byty-najem": "#22c55e",
    "domy-prodej": "#f97316",
    "domy-najem": "#eab308",
  };
  return map[cat] || "#6b7280";
}

function getCatLabel(cat: string): string {
  const map: Record<string, string> = {
    "byty-prodej": "Byt · Prodej",
    "byty-najem": "Byt · Nájem",
    "domy-prodej": "Dům · Prodej",
    "domy-najem": "Dům · Nájem",
  };
  return map[cat] || cat;
}

// ── Carousel dots ───────────────────────────────────────────────────────────

function CarouselDots({ count, current }: { count: number; current: number }) {
  if (count <= 1) return null;
  return (
    <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1 pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`h-1 rounded-full transition-all duration-200 ${
            i === current ? "w-4 bg-white" : "w-1 bg-white/40"
          }`}
        />
      ))}
    </div>
  );
}

// ── HotCard ──────────────────────────────────────────────────────────────────

function HotCard({
  drop,
  selected,
  onSelect,
}: {
  drop: HotDrop;
  selected: boolean;
  onSelect: () => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const thumbs = drop.thumbs;
  const color = getCatColor(drop.category);

  function prev(e: React.MouseEvent) {
    e.stopPropagation();
    setImgIdx((i) => (i - 1 + thumbs.length) % thumbs.length);
  }
  function next(e: React.MouseEvent) {
    e.stopPropagation();
    setImgIdx((i) => (i + 1) % thumbs.length);
  }

  return (
    <div
      onClick={onSelect}
      className={`group flex flex-col rounded-xl border bg-card overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
        selected
          ? "border-accent/50 shadow-2xl shadow-accent/10 -translate-y-0.5"
          : "border-border hover:border-accent/30 hover:shadow-xl hover:shadow-black/30"
      }`}
    >
      {/* Image + carousel */}
      <div className="relative h-44 shrink-0 overflow-hidden bg-card-hover">
        {thumbs.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbs[imgIdx]}
            alt={drop.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, #1a1d27 0%, ${color}15 100%)` }}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-border">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        )}

        {/* Prev / Next arrows */}
        {thumbs.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </>
        )}

        <CarouselDots count={thumbs.length} current={imgIdx} />

        {/* Drop badge */}
        <div className="absolute top-3 left-3">
          <span className="rounded-lg bg-red px-2.5 py-1 text-sm font-bold text-white shadow-lg shadow-red/40">
            −{drop.drop_pct.toFixed(1)}%
          </span>
        </div>

        {/* Category */}
        <div className="absolute top-3 right-3">
          <span
            className="rounded-md px-2 py-0.5 text-xs font-semibold backdrop-blur-sm"
            style={{ color, background: `${color}25` }}
          >
            {getCatLabel(drop.category)}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4">
        <h3 className="text-sm font-semibold text-foreground line-clamp-2 mb-2">
          {drop.title || `Nemovitost ${drop.listing_id}`}
        </h3>
        {drop.location && (
          <p className="text-xs text-muted flex items-center gap-1 mb-3">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="truncate">{drop.location}</span>
          </p>
        )}
        <div className="mt-auto border-t border-border/50 pt-3 flex items-end justify-between gap-2">
          <div>
            <div className="text-xl font-bold text-green">{formatPrice(drop.new_price)}</div>
            <div className="text-xs text-muted line-through">{formatPrice(drop.old_price)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-green/80">−{formatPrice(drop.old_price - drop.new_price)}</div>
            {drop.area_m2 && <div className="text-xs text-muted">{drop.area_m2} m²</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail panel (spans full grid row) ──────────────────────────────────────

function DetailPanel({ drop, onClose }: { drop: HotDrop; onClose: () => void }) {
  const [imgIdx, setImgIdx] = useState(0);
  const thumbs = drop.thumbs;
  const color = getCatColor(drop.category);
  const saved = drop.old_price - drop.new_price;

  return (
    <div className="col-span-full animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="relative rounded-xl border border-accent/30 bg-card overflow-hidden shadow-2xl shadow-black/40">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/70 hover:text-white transition-colors backdrop-blur-sm"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="flex flex-col md:flex-row gap-0">
          {/* Left: large image carousel */}
          <div className="relative md:w-[45%] shrink-0 h-56 md:h-72 overflow-hidden bg-card-hover">
            {thumbs.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbs[imgIdx]}
                alt={drop.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, #1a1d27, ${color}15)` }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7" className="text-border/60">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
            )}

            {thumbs.length > 1 && (
              <>
                <button
                  onClick={() => setImgIdx((i) => (i - 1 + thumbs.length) % thumbs.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button
                  onClick={() => setImgIdx((i) => (i + 1) % thumbs.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <CarouselDots count={thumbs.length} current={imgIdx} />

                {/* Thumbnail strip */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-1.5 px-4 pointer-events-none">
                  {thumbs.slice(0, 5).map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      className={`pointer-events-auto h-10 w-14 shrink-0 overflow-hidden rounded border-2 transition-all ${
                        i === imgIdx ? "border-white" : "border-transparent opacity-60 hover:opacity-90"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Drop badge overlay */}
            <div className="absolute top-3 left-3">
              <span className="rounded-lg bg-red px-3 py-1.5 text-base font-extrabold text-white shadow-lg shadow-red/40">
                −{drop.drop_pct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Right: info */}
          <div className="flex flex-1 flex-col justify-between p-5 md:p-7">
            <div>
              {/* Category tag */}
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold mb-3"
                style={{ color, background: `${color}20` }}
              >
                {getCatLabel(drop.category)}
              </span>

              <h2 className="text-lg font-bold text-foreground leading-snug mb-2">
                {drop.title || `Nemovitost ${drop.listing_id}`}
              </h2>

              {drop.location && (
                <p className="flex items-center gap-1.5 text-sm text-muted mb-4">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  {drop.location}
                </p>
              )}

              {/* Price block */}
              <div className="rounded-xl border border-border/60 bg-background/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Nová cena</span>
                  <span className="text-2xl font-extrabold text-green tabular-nums">{formatPrice(drop.new_price)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/40 pt-2">
                  <span className="text-xs text-muted">Původní cena</span>
                  <span className="text-sm text-muted line-through tabular-nums">{formatPrice(drop.old_price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Úspora</span>
                  <span className="text-sm font-bold text-green/80 tabular-nums">−{formatPrice(saved)}</span>
                </div>
                {drop.area_m2 && (
                  <div className="flex items-center justify-between border-t border-border/40 pt-2">
                    <span className="text-xs text-muted">Plocha</span>
                    <span className="text-sm font-semibold text-foreground">{drop.area_m2} m²</span>
                  </div>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-5 flex items-center gap-3">
              <a
                href={`/listing/${drop.listing_id}`}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-light"
              >
                Zobrazit detail
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
              <button
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted hover:text-foreground hover:border-border/80 transition-colors"
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── HotSection ───────────────────────────────────────────────────────────────

const COLS = 3;

export default function HotSection({ drops }: { drops: HotDrop[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedDrop = drops.find((d) => d.id === selectedId) ?? null;

  // Split drops into rows of COLS
  const rows: HotDrop[][] = [];
  for (let i = 0; i < drops.length; i += COLS) {
    rows.push(drops.slice(i, i + COLS));
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row, rowIdx) => (
        <>
          {row.map((drop) => (
            <HotCard
              key={drop.id}
              drop={drop}
              selected={drop.id === selectedId}
              onSelect={() => setSelectedId(drop.id === selectedId ? null : drop.id)}
            />
          ))}
          {/* Inline expansion — spans full row if a card in this row is selected */}
          {selectedDrop && row.some((d) => d.id === selectedId) && (
            <DetailPanel
              key={`detail-${rowIdx}`}
              drop={selectedDrop}
              onClose={() => setSelectedId(null)}
            />
          )}
        </>
      ))}
    </div>
  );
}
