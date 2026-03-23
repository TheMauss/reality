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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M Kč`;
  return `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
}

const CAT: Record<string, { label: string; color: string }> = {
  "byty-prodej": { label: "Byt · Prodej",  color: "#818CF8" },
  "byty-najem":  { label: "Byt · Nájem",   color: "#10B981" },
  "domy-prodej": { label: "Dům · Prodej",  color: "#F97316" },
  "domy-najem":  { label: "Dům · Nájem",   color: "#F59E0B" },
};

// ── Dots ─────────────────────────────────────────────────────────────────────

function Dots({ count, cur }: { count: number; cur: number }) {
  if (count <= 1) return null;
  return (
    <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1 pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={`h-1 rounded-full transition-all duration-200 ${i === cur ? "w-4 bg-white" : "w-1 bg-white/40"}`} />
      ))}
    </div>
  );
}

// ── HotCard ───────────────────────────────────────────────────────────────────

function HotCard({ drop, selected, onSelect }: { drop: HotDrop; selected: boolean; onSelect: () => void }) {
  const [idx, setIdx] = useState(0);
  const thumbs = drop.thumbs;
  const cat = CAT[drop.category] ?? { label: drop.category, color: "#71717A" };
  const saved = drop.old_price - drop.new_price;

  return (
    <div onClick={onSelect}
      className={`group flex flex-col rounded-2xl border bg-card overflow-hidden cursor-pointer transition-all duration-200 ${
        selected
          ? "border-accent/50 shadow-2xl shadow-accent/10 -translate-y-0.5"
          : "border-border hover:border-border-light hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5"
      }`}>

      {/* Photo */}
      <div className="relative h-48 shrink-0 overflow-hidden bg-card-hover">
        {thumbs.length > 0
          ? <img src={thumbs[idx]} alt={drop.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
          : (
            <div className="h-full w-full flex items-center justify-center"
              style={{ background: `linear-gradient(145deg, #0D0C14, ${cat.color}12)` }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-border/50">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          )}

        {/* Carousel arrows */}
        {thumbs.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + thumbs.length) % thumbs.length); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % thumbs.length); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </>
        )}

        <Dots count={thumbs.length} cur={idx} />

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3">
          <span className="drop-badge">↓ {drop.drop_pct.toFixed(1)}%</span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm"
            style={{ color: cat.color, background: `${cat.color}25` }}>
            {cat.label}
          </span>
        </div>

        {/* Price overlay */}
        <div className="absolute bottom-0 inset-x-0 px-3.5 pb-3 pt-8">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-lg font-extrabold text-white tabular-nums leading-none">{fmtPrice(drop.new_price)}</div>
              <div className="text-xs text-white/45 line-through mt-0.5">{fmtPrice(drop.old_price)}</div>
            </div>
            {drop.area_m2 && (
              <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-white/75 backdrop-blur-sm">
                {drop.area_m2} m²
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2.5">
        <h3 className="text-[13px] font-semibold text-foreground line-clamp-2 leading-snug">
          {drop.title || `Nemovitost ${drop.listing_id}`}
        </h3>
        {drop.location && (
          <p className="text-[11px] text-muted flex items-center gap-1">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="truncate">{drop.location}</span>
          </p>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <span className="text-[11px] text-muted">Úspora</span>
          <span className="text-[12px] font-bold text-green tabular-nums">−{fmtPrice(saved)}</span>
        </div>
      </div>
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────────────────────────────

function DetailPanel({ drop, onClose }: { drop: HotDrop; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const thumbs = drop.thumbs;
  const cat = CAT[drop.category] ?? { label: drop.category, color: "#71717A" };
  const saved = drop.old_price - drop.new_price;

  return (
    <div className="col-span-full animate-slide-up">
      <div className="relative rounded-2xl border border-accent/25 bg-card overflow-hidden shadow-2xl shadow-black/50">
        <button onClick={onClose}
          className="absolute top-3.5 right-3.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/60 hover:text-white transition-colors backdrop-blur-sm">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="flex flex-col md:flex-row">
          {/* Image */}
          <div className="relative md:w-[46%] shrink-0 h-60 md:h-72 overflow-hidden bg-card-hover">
            {thumbs.length > 0
              ? <img src={thumbs[idx]} alt={drop.title} className="h-full w-full object-cover" />
              : (
                <div className="h-full w-full flex items-center justify-center"
                  style={{ background: `linear-gradient(145deg, #0D0C14, ${cat.color}12)` }}>
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7" className="text-border/50">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
              )}

            {thumbs.length > 1 && (
              <>
                <button onClick={() => setIdx(i => (i - 1 + thumbs.length) % thumbs.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button onClick={() => setIdx(i => (i + 1) % thumbs.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <Dots count={thumbs.length} cur={idx} />
                <div className="absolute bottom-8 inset-x-0 flex justify-center gap-1.5 px-4 pointer-events-none">
                  {thumbs.slice(0, 5).map((t, i) => (
                    <button key={i} onClick={() => setIdx(i)}
                      className={`pointer-events-auto h-10 w-14 shrink-0 overflow-hidden rounded border-2 transition-all ${
                        i === idx ? "border-white" : "border-transparent opacity-60 hover:opacity-90"
                      }`}>
                      <img src={t} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="absolute top-3.5 left-3.5">
              <span className="drop-badge text-base">↓ {drop.drop_pct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col justify-between p-6 md:p-8">
            <div>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold mb-4"
                style={{ color: cat.color, background: `${cat.color}20` }}>
                {cat.label}
              </span>

              <h2 className="text-lg font-bold text-foreground leading-snug mb-2">
                {drop.title}
              </h2>

              {drop.location && (
                <p className="flex items-center gap-1.5 text-sm text-muted mb-5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  {drop.location}
                </p>
              )}

              {/* Price breakdown */}
              <div className="rounded-2xl border border-border/60 bg-background/50 divide-y divide-border/40 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[12px] text-muted">Nová cena</span>
                  <span className="text-xl font-extrabold text-green tabular-nums">{fmtPrice(drop.new_price)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[12px] text-muted">Původní cena</span>
                  <span className="text-sm text-muted line-through tabular-nums">{fmtPrice(drop.old_price)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[12px] text-muted">Úspora</span>
                  <span className="text-sm font-bold text-green tabular-nums">−{fmtPrice(saved)}</span>
                </div>
                {drop.area_m2 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[12px] text-muted">Plocha</span>
                    <span className="text-sm font-semibold text-foreground">{drop.area_m2} m²</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <a href={`/listing/${drop.listing_id}`}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-light hover:shadow-accent/30 hover:-translate-y-0.5">
                Zobrazit detail
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
              <button onClick={onClose}
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted hover:text-foreground hover:border-border-light transition-colors">
                Zavřít
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── HotSection ────────────────────────────────────────────────────────────────

export default function HotSection({ drops }: { drops: HotDrop[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedDrop = drops.find(d => d.id === selectedId) ?? null;

  const rows: HotDrop[][] = [];
  for (let i = 0; i < drops.length; i += 3) rows.push(drops.slice(i, i + 3));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row, ri) => (
        <>
          {row.map(drop => (
            <HotCard key={drop.id} drop={drop}
              selected={drop.id === selectedId}
              onSelect={() => setSelectedId(drop.id === selectedId ? null : drop.id)} />
          ))}
          {selectedDrop && row.some(d => d.id === selectedId) && (
            <DetailPanel key={`dp-${ri}`} drop={selectedDrop} onClose={() => setSelectedId(null)} />
          )}
        </>
      ))}
    </div>
  );
}
