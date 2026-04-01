import { notFound } from "next/navigation";
import { fixSrealityUrl } from "@/lib/sreality-url";
import SrealityDetail from "@/components/SrealityDetail";
import BezrealitkuDetail from "@/components/BezrealitkuDetail";

interface Listing {
  id: string;
  title: string;
  url: string;
  location: string;
  area_m2: number | null;
  category: string;
  price: number;
  first_seen_at: string;
}

interface HistoryEntry { price: number; recorded_at: string; }
interface Drop { id: number; old_price: number; new_price: number; drop_pct: number; detected_at: string; }
interface Change { id: number; field: string; old_value: string | null; new_value: string | null; detected_at: string; }
interface Source { source: string; source_id: string; url: string; first_seen_at: string; removed_at: string | null; }

function fmtPrice(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} M Kč`;
  return price.toLocaleString("cs-CZ") + " Kč";
}

const CAT: Record<string, string> = {
  "byty-prodej": "Byt · Prodej",
  "byty-najem": "Byt · Nájem",
  "domy-prodej": "Dům · Prodej",
  "domy-najem": "Dům · Nájem",
};

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("cs-CZ", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("cs-CZ", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

async function getListingData(id: string) {
  const { baseUrl } = await import("@/lib/base-url");
  const base = await baseUrl();
  const res = await fetch(`${base}/api/listing?id=${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getListingData(id);
  if (!data) notFound();

  const listing: Listing = data.listing;
  const history: HistoryEntry[] = data.history;
  const drops: Drop[] = data.drops;
  const changes: Change[] = data.changes || [];
  const sources: Source[] = data.sources || [];

  const minPrice = history.length ? Math.min(...history.map((h) => h.price)) : listing.price;
  const maxPrice = history.length ? Math.max(...history.map((h) => h.price)) : listing.price;
  const pricePerM2 = listing.area_m2 && listing.area_m2 > 0 ? Math.round(listing.price / listing.area_m2) : null;
  const activeSources = sources.filter(s => !s.removed_at);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[12px] text-text-tertiary">
        <a href="/" className="hover:text-text-secondary transition-colors">Propady</a>
        <span>/</span>
        <a href="/inzerce" className="hover:text-text-secondary transition-colors">Inzerce</a>
        <span>/</span>
        <span className="text-text-secondary truncate max-w-[200px]">{listing.title}</span>
      </nav>

      {/* Header — title + meta */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded-md bg-surface-3 px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
            {CAT[listing.category] ?? listing.category}
          </span>
          {listing.area_m2 && (
            <span className="text-[11px] text-text-tertiary">{listing.area_m2} m²</span>
          )}
        </div>

        <h1 className="text-xl font-semibold text-foreground leading-snug">{listing.title}</h1>

        {listing.location && (
          <p className="mt-1.5 text-[13px] text-text-secondary">{listing.location}</p>
        )}

        <p className="mt-1 text-[11px] text-text-tertiary">
          Sledujeme od {fmtDate(listing.first_seen_at)}
        </p>
      </div>

      {/* Two-column layout: content + sticky price sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left — main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Photos / API detail */}
          {listing.id.startsWith("bz_") ? (
            <BezrealitkuDetail listingId={listing.id} />
          ) : (
            <>
              <SrealityDetail listingId={listing.id} />
              {sources.find(s => s.source === "bezrealitky") && (
                <BezrealitkuDetail listingId={listing.id}
                  sourceId={sources.find(s => s.source === "bezrealitky")!.source_id} />
              )}
            </>
          )}

          {/* Price chart */}
          {history.length > 1 && (
            <div className="rounded-lg border border-border bg-surface-1 p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Cenový vývoj</h2>
              <div className="flex items-end gap-1" style={{ height: 140 }}>
                {history.map((h, i) => {
                  const range = maxPrice - minPrice || 1;
                  const heightPct = ((h.price - minPrice) / range) * 70 + 30;
                  const isLast = i === history.length - 1;
                  return (
                    <div key={i} className="group relative flex flex-1 flex-col items-center">
                      <div
                        className={`w-full max-w-[36px] rounded-t transition-colors ${
                          isLast ? "bg-accent" : "bg-accent/20"
                        } group-hover:bg-accent-light`}
                        style={{ height: `${heightPct}%` }}
                        title={`${fmtPrice(h.price)} — ${fmtDate(h.recorded_at)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-text-tertiary tabular-nums">
                <span>{fmtPrice(minPrice)}</span>
                <span>{fmtPrice(maxPrice)}</span>
              </div>
            </div>
          )}

          {/* Price drops */}
          {drops.length > 0 && (
            <div className="rounded-lg border border-border bg-surface-1 p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Cenové propady</h2>
              <div className="space-y-2">
                {drops.map((drop) => (
                  <div key={drop.id}
                    className="flex items-center justify-between rounded-md bg-surface-2 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-red/10 px-2 py-0.5 text-[12px] font-semibold text-red tabular-nums">
                        -{drop.drop_pct.toFixed(1)}%
                      </span>
                      <div className="text-[13px]">
                        <span className="text-text-tertiary line-through tabular-nums">{fmtPrice(drop.old_price)}</span>
                        <span className="text-text-tertiary mx-1.5">→</span>
                        <span className="font-medium text-green tabular-nums">{fmtPrice(drop.new_price)}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-text-tertiary">{fmtDate(drop.detected_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Changes */}
          {changes.length > 0 && (
            <div className="rounded-lg border border-border bg-surface-1 p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Změny v inzerátu</h2>
              <div className="space-y-1.5">
                {changes.map((c) => (
                  <div key={c.id}
                    className="flex items-center justify-between rounded-md bg-surface-2 px-4 py-2.5 text-[13px]">
                    <div className="flex items-center gap-3">
                      <span className="rounded bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-light">{c.field}</span>
                      <span className="text-text-tertiary line-through">{c.old_value || "—"}</span>
                      <span className="text-text-tertiary">→</span>
                      <span className="font-medium text-foreground">{c.new_value || "—"}</span>
                    </div>
                    <span className="text-[11px] text-text-tertiary">{fmtDate(c.detected_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full history table */}
          {history.length > 0 && (
            <div className="rounded-lg border border-border bg-surface-1 p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Kompletní cenová historie</h2>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th className="text-right">Cena</th>
                      <th className="text-right">Změna</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => {
                      const prev = i > 0 ? history[i - 1].price : null;
                      const diff = prev ? h.price - prev : 0;
                      return (
                        <tr key={i}>
                          <td className="text-text-secondary">{fmtDateTime(h.recorded_at)}</td>
                          <td className="text-right font-medium text-foreground tabular-nums">{fmtPrice(h.price)}</td>
                          <td className="text-right tabular-nums">
                            {diff !== 0 ? (
                              <span className={diff < 0 ? "text-green" : "text-red"}>
                                {diff < 0 ? "" : "+"}{fmtPrice(diff)}
                              </span>
                            ) : (
                              <span className="text-text-tertiary">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right — sticky price sidebar (desktop only) */}
        <div className="shrink-0 lg:w-72 lg:sticky lg:top-16 lg:self-start">
          <div className="rounded-lg border border-border bg-surface-1 p-5 space-y-4">
            <div>
              <div className="text-2xl font-semibold text-foreground tabular-nums">
                {fmtPrice(listing.price)}
              </div>
              {pricePerM2 && (
                <div className="text-[13px] text-text-tertiary mt-0.5 tabular-nums">
                  {pricePerM2.toLocaleString("cs-CZ")} Kč/m²
                </div>
              )}
            </div>

            {/* Price range summary */}
            {history.length > 1 && minPrice !== maxPrice && (
              <div className="border-t border-border pt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-tertiary">Minimum</span>
                  <span className="font-medium text-green tabular-nums">{fmtPrice(minPrice)}</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-tertiary">Maximum</span>
                  <span className="font-medium text-text-secondary tabular-nums">{fmtPrice(maxPrice)}</span>
                </div>
                {drops.length > 0 && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-text-tertiary">Propadů</span>
                    <span className="font-medium text-red tabular-nums">{drops.length}×</span>
                  </div>
                )}
              </div>
            )}

            {/* Source links */}
            <div className="flex flex-col gap-2">
              {activeSources.length > 0 ? (
                activeSources.map(s => {
                  const href = s.source === "sreality"
                    ? fixSrealityUrl(s.url, listing.id, listing.title, listing.location, listing.category)
                    : s.url;
                  return (
                    <a key={s.source} href={href} target="_blank" rel="noopener noreferrer"
                      className="btn-primary py-2 px-4 text-[12px] text-center">
                      {s.source === "sreality" ? "Sreality" : s.source === "bezrealitky" ? "Bezrealitky" : s.source} ↗
                    </a>
                  );
                })
              ) : listing.url ? (
                <a href={listing.id.startsWith("bz_") ? listing.url : (fixSrealityUrl(listing.url, listing.id, listing.title, listing.location, listing.category) ?? listing.url)}
                  target="_blank" rel="noopener noreferrer"
                  className="btn-primary py-2 px-4 text-[12px] text-center">
                  {listing.id.startsWith("bz_") ? "Bezrealitky" : "Sreality"} ↗
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
