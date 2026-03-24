"use client";

import React, { useState } from "react";

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

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M Kč`;
  return `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
}

function HotCard({ drop, selected, onSelect }: {
  drop: HotDrop; selected: boolean; onSelect: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const thumbs = drop.thumbs;
  const saved = drop.old_price - drop.new_price;

  return (
    <div
      onClick={onSelect}
      className={`group flex flex-col rounded-lg border overflow-hidden cursor-pointer transition-all ${
        selected
          ? "border-accent bg-surface-1 shadow-lg shadow-accent/5"
          : "border-border bg-surface-1 hover:border-border-hover"
      }`}
    >
      {/* Photo */}
      <div className="relative h-40 shrink-0 overflow-hidden bg-surface-2">
        {thumbs.length > 0 ? (
          <img src={thumbs[idx]} alt={drop.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-surface-4">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        )}

        {/* Nav arrows */}
        {thumbs.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + thumbs.length) % thumbs.length); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % thumbs.length); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="absolute top-3 left-3">
          <span className="drop-badge">-{drop.drop_pct.toFixed(1)}%</span>
        </div>

        <div className="absolute bottom-0 inset-x-0 px-3.5 pb-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-base font-semibold text-white tabular-nums leading-none">
                {fmtPrice(drop.new_price)}
              </div>
              <div className="text-[10px] text-white/40 line-through mt-0.5">
                {fmtPrice(drop.old_price)}
              </div>
            </div>
            {drop.area_m2 && (
              <span className="text-[10px] text-white/50 tabular-nums">{drop.area_m2} m²</span>
            )}
          </div>
        </div>

        {/* Dots */}
        {thumbs.length > 1 && (
          <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 pointer-events-none">
            {thumbs.map((_, i) => (
              <span key={i} className={`h-1 rounded-full transition-all ${i === idx ? "w-3 bg-white" : "w-1 bg-white/30"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5 space-y-2">
        <h3 className="text-[13px] font-medium text-foreground/90 line-clamp-2 leading-snug">
          {drop.title || `Nemovitost ${drop.listing_id}`}
        </h3>
        {drop.location && (
          <p className="text-[11px] text-text-tertiary truncate">{drop.location}</p>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-[11px] text-text-tertiary">Úspora</span>
          <span className="text-[12px] font-semibold text-green tabular-nums">-{fmtPrice(saved)}</span>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ drop, onClose }: { drop: HotDrop; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const thumbs = drop.thumbs;
  const saved = drop.old_price - drop.new_price;

  return (
    <div className="col-span-full animate-slide-up">
      <div className="relative rounded-lg border border-accent/20 bg-surface-1 overflow-hidden">
        <button onClick={onClose}
          className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-surface-3 text-text-secondary hover:text-foreground transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="flex flex-col md:flex-row">
          {/* Image */}
          <div className="relative md:w-[45%] shrink-0 h-52 md:h-64 overflow-hidden bg-surface-2">
            {thumbs.length > 0 ? (
              <img src={thumbs[idx]} alt={drop.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7" className="text-surface-4">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
            )}
            {thumbs.length > 1 && (
              <>
                <button onClick={() => setIdx((i) => (i - 1 + thumbs.length) % thumbs.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md bg-black/50 text-white hover:bg-black/70 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button onClick={() => setIdx((i) => (i + 1) % thumbs.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md bg-black/50 text-white hover:bg-black/70 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </>
            )}
            <div className="absolute top-3 left-3">
              <span className="drop-badge text-sm">-{drop.drop_pct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col justify-between p-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground leading-snug mb-1">{drop.title}</h2>
              {drop.location && (
                <p className="text-sm text-text-secondary mb-5">{drop.location}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-surface-2 px-4 py-3">
                  <div className="text-xl font-semibold text-green tabular-nums">{fmtPrice(drop.new_price)}</div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">Nová cena</div>
                </div>
                <div className="rounded-lg bg-surface-2 px-4 py-3">
                  <div className="text-sm text-text-secondary line-through tabular-nums">{fmtPrice(drop.old_price)}</div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">Původní cena</div>
                </div>
                <div className="rounded-lg bg-surface-2 px-4 py-3">
                  <div className="text-sm font-semibold text-green tabular-nums">-{fmtPrice(saved)}</div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">Úspora</div>
                </div>
                {drop.area_m2 && (
                  <div className="rounded-lg bg-surface-2 px-4 py-3">
                    <div className="text-sm font-semibold text-foreground">{drop.area_m2} m²</div>
                    <div className="text-[11px] text-text-tertiary mt-0.5">Plocha</div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <a href={`/listing/${drop.listing_id}`}
                className="btn-primary flex-1 py-2.5 text-[13px]">
                Zobrazit detail
              </a>
              <button onClick={onClose} className="btn-outline py-2.5 text-[13px]">
                Zavřít
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HotSection({ drops }: { drops: HotDrop[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedDrop = drops.find((d) => d.id === selectedId) ?? null;

  const rows: HotDrop[][] = [];
  for (let i = 0; i < drops.length; i += 3) rows.push(drops.slice(i, i + 3));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row, ri) => (
        <React.Fragment key={ri}>
          {row.map((drop) => (
            <HotCard
              key={drop.id}
              drop={drop}
              selected={drop.id === selectedId}
              onSelect={() => setSelectedId(drop.id === selectedId ? null : drop.id)}
            />
          ))}
          {selectedDrop && row.some((d) => d.id === selectedId) && (
            <DetailPanel drop={selectedDrop} onClose={() => setSelectedId(null)} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
