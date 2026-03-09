"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import ListingCard from "./ListingCard";
import ListingsFilters from "./ListingsFilters";
import type { ListingPin } from "./ListingsMap";

const ListingsMap = dynamic(() => import("./ListingsMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-card rounded-xl border border-border">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="text-sm text-muted">Načítání mapy…</span>
      </div>
    </div>
  ),
});

interface Listing {
  id: string;
  title: string;
  url: string;
  location: string;
  area_m2: number | null;
  category: string;
  price: number;
  price_m2: number | null;
  first_seen_at: string;
}

interface SrealityDetail {
  images: string[];
  description: string;
}

interface Props {
  listings: Listing[];
  total: number;
  pages: number;
  currentPage: number;
  sp: Record<string, string>;
  promo?: React.ReactNode;
  defaultSplit?: boolean;
}

function formatPrice(p: number) {
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(1)} M Kč`;
  return `${Math.round(p).toLocaleString("cs-CZ")} Kč`;
}

function extractSrealityId(url: string): string | null {
  return url.match(/\/(\d+)\/?(?:\?.*)?$/)?.[1] ?? null;
}

// ── Inline expanded card (left panel) ──────────────────────────────────────
function ExpandedCard({
  pin,
  detail,
  loading,
  carouselIdx,
  setCarouselIdx,
  onClose,
}: {
  pin: ListingPin;
  detail: SrealityDetail | null;
  loading: boolean;
  carouselIdx: number;
  setCarouselIdx: (i: number) => void;
  onClose: () => void;
}) {
  const images = detail?.images ?? [];
  const img = images[carouselIdx] ?? null;
  const hasPrev = carouselIdx > 0;
  const hasNext = carouselIdx < images.length - 1;

  return (
    <div className="mt-2 rounded-xl border border-accent/40 bg-card overflow-hidden shadow-xl shadow-accent/5">
      {/* Photo */}
      <div className="relative aspect-video w-full bg-muted/20">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}
        {img && (
          <img
            src={img}
            alt={pin.title}
            className="w-full h-full object-cover"
          />
        )}
        {!img && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-20">🏠</div>
        )}
        {images.length > 1 && (
          <>
            <button
              onClick={() => hasPrev && setCarouselIdx(carouselIdx - 1)}
              disabled={!hasPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-lg leading-none disabled:opacity-30 transition-colors"
            >
              ‹
            </button>
            <button
              onClick={() => hasNext && setCarouselIdx(carouselIdx + 1)}
              disabled={!hasNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-lg leading-none disabled:opacity-30 transition-colors"
            >
              ›
            </button>
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs rounded px-2 py-0.5">
              {carouselIdx + 1}/{images.length}
            </div>
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-foreground text-base">{formatPrice(pin.price)}</div>
            {pin.price_m2 && (
              <div className="text-xs text-accent-light">{Math.round(pin.price_m2).toLocaleString("cs-CZ")} Kč/m²</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full w-7 h-7 flex items-center justify-center text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="text-sm text-foreground line-clamp-2">{pin.title}</div>
        <div className="text-xs text-muted">{pin.location}</div>
        {detail?.description && (
          <p className="text-xs text-muted/80 line-clamp-3">{detail.description}</p>
        )}
        <div className="flex gap-2 pt-1">
          <a
            href={`/listing/${pin.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-accent text-white text-xs font-semibold text-center py-2 px-3 hover:bg-accent/90 transition-colors"
          >
            Zobrazit detail ↗
          </a>
          <a
            href={pin.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border text-xs text-muted py-2 px-3 hover:bg-card-hover transition-colors"
          >
            Sreality ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Map overlay popup (bottom of map panel) ────────────────────────────────
function MapOverlay({
  pin,
  detail,
  loading,
  carouselIdx,
  setCarouselIdx,
  onClose,
}: {
  pin: ListingPin;
  detail: SrealityDetail | null;
  loading: boolean;
  carouselIdx: number;
  setCarouselIdx: (i: number) => void;
  onClose: () => void;
}) {
  const images = detail?.images ?? [];
  const img = images[carouselIdx] ?? null;
  const hasPrev = carouselIdx > 0;
  const hasNext = carouselIdx < images.length - 1;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[500] bg-background/96 backdrop-blur-xl border-t border-border/50 rounded-b-2xl shadow-2xl shadow-black/40">
      <div className="flex gap-3 p-3" style={{ maxHeight: 176 }}>
        {/* Photo with carousel */}
        <div className="relative w-36 shrink-0 rounded-lg overflow-hidden bg-muted/20 self-stretch">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}
          {img && (
            <img src={img} alt={pin.title} className="w-full h-full object-cover" />
          )}
          {!img && !loading && (
            <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-20">🏠</div>
          )}
          {images.length > 1 && (
            <>
              <button
                onClick={() => hasPrev && setCarouselIdx(carouselIdx - 1)}
                disabled={!hasPrev}
                className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-base leading-none disabled:opacity-30 transition-colors"
              >
                ‹
              </button>
              <button
                onClick={() => hasNext && setCarouselIdx(carouselIdx + 1)}
                disabled={!hasNext}
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-base leading-none disabled:opacity-30 transition-colors"
              >
                ›
              </button>
              <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] rounded px-1.5 py-0.5">
                {carouselIdx + 1}/{images.length}
              </div>
            </>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-foreground">{formatPrice(pin.price)}</div>
              {pin.price_m2 && (
                <div className="text-xs text-accent-light">{Math.round(pin.price_m2).toLocaleString("cs-CZ")} Kč/m²</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-full w-6 h-6 flex items-center justify-center text-muted hover:text-foreground hover:bg-card-hover transition-colors text-sm"
            >
              ✕
            </button>
          </div>
          <div className="text-xs text-foreground line-clamp-1">{pin.title}</div>
          <div className="text-xs text-muted line-clamp-1">{pin.location}</div>
          {detail?.description && (
            <p className="text-xs text-muted/70 line-clamp-2 mt-0.5">{detail.description}</p>
          )}
          <div className="flex gap-2 mt-auto">
            <a
              href={`/listing/${pin.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-accent text-white text-xs font-semibold py-1.5 px-3 hover:bg-accent/90 transition-colors"
            >
              Zobrazit detail ↗
            </a>
            <a
              href={pin.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border text-xs text-muted py-1.5 px-2.5 hover:bg-card-hover transition-colors"
            >
              Sreality ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InzerceClient({ listings, total, pages, currentPage, sp, promo, defaultSplit }: Props) {
  const [view, setView] = useState<"list" | "map">(defaultSplit ? "map" : "list");
  const [selectedPin, setSelectedPin] = useState<ListingPin | null>(null);
  const [detail, setDetail] = useState<SrealityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Use ref so Leaflet marker callbacks always see the latest selectedPin
  const selectedPinRef = useRef<ListingPin | null>(null);
  selectedPinRef.current = selectedPin;

  const handlePinClick = useCallback((pin: ListingPin) => {
    // Toggle off if same pin clicked again (read from ref to avoid stale closure)
    if (selectedPinRef.current?.id === pin.id) {
      setSelectedPin(null);
      return;
    }
    setSelectedPin(pin);
    setDetail(null);
    setCarouselIdx(0);
    setDetailLoading(true);

    const srId = extractSrealityId(pin.url);
    if (srId) {
      fetch(`/api/sreality-detail?id=${srId}`)
        .then(r => r.json())
        .then(data => setDetail(data))
        .catch(() => {})
        .finally(() => setDetailLoading(false));
    } else {
      setDetailLoading(false);
    }
  // stable — intentionally no deps; reads selectedPin via ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll left panel to selected card when it's in current page
  useEffect(() => {
    if (!selectedPin) return;
    const el = cardRefs.current[selectedPin.id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedPin]);

  const handleClose = useCallback(() => {
    setSelectedPin(null);
    setDetail(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">{total.toLocaleString("cs-CZ")}</span>
          <span className="text-sm text-muted">
            {total === 1 ? "inzerát" : total < 5 ? "inzeráty" : "inzerátů"}
            {sp.location && <> · <span className="font-medium text-foreground/80">{sp.location}</span></>}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              view === "list"
                ? "bg-accent text-white shadow-md shadow-accent/30"
                : "text-muted hover:text-foreground"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            Seznam
          </button>
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              view === "map"
                ? "bg-accent text-white shadow-md shadow-accent/30"
                : "text-muted hover:text-foreground"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
            Mapa
          </button>
        </div>
      </div>

      {/* Filters */}
      <ListingsFilters />

      {/* Map split view */}
      {view === "map" ? (
        <div className="flex gap-4" style={{ height: "calc(100vh - 220px)", minHeight: 560 }}>

          {/* ── Left: listing cards ─────────────────────────── */}
          <div className="w-[42%] shrink-0 flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-background">
            {/* Panel header */}
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 shrink-0 bg-card/60 backdrop-blur-sm">
              <div className="text-sm font-semibold text-foreground">
                {sp.location
                  ? <><span className="text-muted font-normal">Inzeráty · </span>{sp.location}</>
                  : "Inzeráty"}
              </div>
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent-light tabular-nums">
                {total.toLocaleString("cs-CZ")}
              </span>
            </div>

            {/* Scrollable cards */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
              {/* Pin selected from map but not in current page → show at top */}
              {selectedPin && !listings.some(l => l.id === selectedPin.id) && (
                <div data-expanded-card="" className="rounded-xl ring-2 ring-accent shadow-lg shadow-accent/10">
                  <ExpandedCard
                    pin={selectedPin}
                    detail={detail}
                    loading={detailLoading}
                    carouselIdx={carouselIdx}
                    setCarouselIdx={setCarouselIdx}
                    onClose={handleClose}
                  />
                </div>
              )}

              {listings.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="text-3xl opacity-20">🏠</div>
                    <p className="text-sm text-muted">Žádné inzeráty</p>
                  </div>
                </div>
              ) : (
                listings.map((l) => (
                  <div
                    key={l.id}
                    ref={el => { cardRefs.current[l.id] = el; }}
                    className={`rounded-xl transition-all duration-200 cursor-pointer ${selectedPin?.id === l.id ? "ring-2 ring-accent shadow-lg shadow-accent/10" : ""}`}
                    onClick={(e) => {
                      // Intercept internal anchor clicks → expand inline instead of navigating
                      const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
                      if (anchor && anchor.target !== "_blank") {
                        e.preventDefault();
                      }
                      // Don't collapse when clicking inside the ExpandedCard itself
                      if ((e.target as HTMLElement).closest("[data-expanded-card]")) return;
                      handlePinClick({ id: l.id, title: l.title, url: l.url, location: l.location, price: l.price, price_m2: l.price_m2, area_m2: l.area_m2, category: l.category, lat: 0, lon: 0 });
                    }}
                  >
                    <ListingCard listing={l} compact />
                    {selectedPin?.id === l.id && (
                      <div data-expanded-card="">
                        <ExpandedCard
                          pin={selectedPin}
                          detail={detail}
                          loading={detailLoading}
                          carouselIdx={carouselIdx}
                          setCarouselIdx={setCarouselIdx}
                          onClose={handleClose}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="border-t border-border/60 bg-card/60 px-4 py-2.5 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  {currentPage > 1 ? (
                    <a href={`/inzerce?${new URLSearchParams({ ...sp, page: String(currentPage - 1) })}`}
                      className="rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted transition-all hover:border-accent/40 hover:text-foreground">← Předchozí</a>
                  ) : <div />}
                  <span className="text-xs text-muted tabular-nums">{currentPage} / {pages}</span>
                  {currentPage < pages ? (
                    <a href={`/inzerce?${new URLSearchParams({ ...sp, page: String(currentPage + 1) })}`}
                      className="rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted transition-all hover:border-accent/40 hover:text-foreground">Další →</a>
                  ) : <div />}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: map ──────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-2xl border border-border/70">
            {/* Map header */}
            <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/60 backdrop-blur-sm px-4 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                <span className="text-sm font-semibold text-foreground">Mapa inzerátů</span>
              </div>
              <a href="/mapa" className="text-xs text-accent-light/70 hover:text-accent-light transition-colors">
                Cenová mapa ČR →
              </a>
            </div>
            <div className="flex-1 min-h-0 relative">
              <ListingsMap
                category={sp.category}
                location={sp.location}
                minPrice={sp.min_price}
                maxPrice={sp.max_price}
                minArea={sp.min_area}
                maxArea={sp.max_area}
                layout={sp.layout}
                selectedId={selectedPin?.id}
                onPinClick={handlePinClick}
              />
              {selectedPin && (
                <MapOverlay
                  pin={selectedPin}
                  detail={detail}
                  loading={detailLoading}
                  carouselIdx={carouselIdx}
                  setCarouselIdx={setCarouselIdx}
                  onClose={handleClose}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-card py-20 text-center">
              <div className="text-5xl opacity-15">🏠</div>
              <div>
                <p className="text-base font-semibold text-foreground mb-1">Žádné výsledky</p>
                <p className="text-sm text-muted">Zkuste upravit nebo zrušit filtry</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l, i) => (
                <React.Fragment key={l.id}>
                  <ListingCard listing={l} />
                  {promo && i === 5 && (
                    <div className="sm:col-span-2 lg:col-span-3">{promo}</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (() => {
            const win = 2;
            const start = Math.max(1, currentPage - win);
            const end = Math.min(pages, currentPage + win);
            const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            const makeHref = (p: number) => `/inzerce?${new URLSearchParams({ ...sp, page: String(p) })}`;
            return (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {currentPage > 1 && (
                  <a href={makeHref(currentPage - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted transition-all hover:border-accent/40 hover:text-foreground">←</a>
                )}
                {start > 1 && <>
                  <a href={makeHref(1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted transition-all hover:border-accent/40 hover:text-foreground">1</a>
                  {start > 2 && <span className="px-1 text-muted">…</span>}
                </>}
                {nums.map(n => (
                  <a key={n} href={makeHref(n)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition-all ${
                      n === currentPage
                        ? "border-accent bg-accent text-white shadow-lg shadow-accent/25"
                        : "border-border/70 bg-card text-muted hover:border-accent/40 hover:text-foreground"
                    }`}>{n}</a>
                ))}
                {end < pages && <>
                  {end < pages - 1 && <span className="px-1 text-muted">…</span>}
                  <a href={makeHref(pages)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted transition-all hover:border-accent/40 hover:text-foreground">{pages}</a>
                </>}
                {currentPage < pages && (
                  <a href={makeHref(currentPage + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted transition-all hover:border-accent/40 hover:text-foreground">→</a>
                )}
              </div>
            );
          })()}
        </>
      )}

    </div>
  );
}
