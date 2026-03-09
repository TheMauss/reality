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

interface HistoryEntry {
  price: number;
  recorded_at: string;
}

interface Drop {
  id: number;
  old_price: number;
  new_price: number;
  drop_pct: number;
  detected_at: string;
}

interface Change {
  id: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  detected_at: string;
}

interface Source {
  source: string;
  source_id: string;
  url: string;
  first_seen_at: string;
  removed_at: string | null;
}

function formatPrice(price: number): string {
  return price.toLocaleString("cs-CZ") + " Kč";
}

function formatCategory(cat: string): string {
  const map: Record<string, string> = {
    "byty-prodej": "Byt · Prodej",
    "byty-najem": "Byt · Nájem",
    "domy-prodej": "Dům · Prodej",
    "domy-najem": "Dům · Nájem",
  };
  return map[cat] || cat;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function getListingData(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/listing?id=${id}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getListingData(id);

  if (!data) notFound();

  const listing: Listing = data.listing;
  const history: HistoryEntry[] = data.history;
  const drops: Drop[] = data.drops;
  const changes: Change[] = data.changes || [];
  const sources: Source[] = data.sources || [];

  const minPrice = history.length
    ? Math.min(...history.map((h) => h.price))
    : listing.price;
  const maxPrice = history.length
    ? Math.max(...history.map((h) => h.price))
    : listing.price;
  const pricePerM2 =
    listing.area_m2 && listing.area_m2 > 0
      ? Math.round(listing.price / listing.area_m2)
      : null;

  return (
    <div className="space-y-8">
      {/* Back */}
      <a
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        ← Zpět na přehled
      </a>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{listing.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              {listing.location && <span>📍 {listing.location}</span>}
              {listing.category && (
                <>
                  <span className="text-border">·</span>
                  <span>{formatCategory(listing.category)}</span>
                </>
              )}
              {listing.area_m2 && (
                <>
                  <span className="text-border">·</span>
                  <span>{listing.area_m2} m²</span>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              V databázi od {formatDate(listing.first_seen_at)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="text-3xl font-bold text-green">
              {formatPrice(listing.price)}
            </div>
            {pricePerM2 && (
              <div className="text-sm text-muted">
                {pricePerM2.toLocaleString("cs-CZ")} Kč/m²
              </div>
            )}
            {sources.filter(s => !s.removed_at).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sources.filter(s => !s.removed_at).map(s => {
                  const isSreality = s.source === "sreality";
                  const isBezrealitky = s.source === "bezrealitky";
                  const label = isSreality
                    ? "Sreality ↗"
                    : isBezrealitky
                    ? "Bezrealitky ↗"
                    : `${s.source} ↗`;
                  const href = isSreality
                    ? fixSrealityUrl(s.url, listing.id, listing.title, listing.location, listing.category)
                    : s.url;
                  const colorClass = isBezrealitky
                    ? "bg-amber-500 hover:bg-amber-400"
                    : "bg-accent hover:bg-accent-light";
                  return (
                    <a
                      key={s.source}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${colorClass}`}
                    >
                      {label}
                    </a>
                  );
                })}
              </div>
            ) : listing.url ? (
              <a
                href={fixSrealityUrl(listing.url, listing.id, listing.title, listing.location, listing.category)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light"
              >
                Zobrazit na Sreality ↗
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Photos, params, description */}
      {listing.id.startsWith("bz_") ? (
        <BezrealitkuDetail listingId={listing.id} />
      ) : (
        <>
          <SrealityDetail listingId={listing.id} />
          {sources.find(s => s.source === "bezrealitky") && (
            <BezrealitkuDetail
              listingId={listing.id}
              sourceId={sources.find(s => s.source === "bezrealitky")!.source_id}
            />
          )}
        </>
      )}

      {/* Price chart (simple bar visualization) */}
      {history.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Cenový vývoj</h2>
          <div className="flex items-end gap-1" style={{ height: 160 }}>
            {history.map((h, i) => {
              const range = maxPrice - minPrice || 1;
              const heightPct =
                ((h.price - minPrice) / range) * 70 + 30;
              const isLast = i === history.length - 1;
              return (
                <div
                  key={i}
                  className="group relative flex flex-1 flex-col items-center"
                >
                  <div
                    className={`w-full max-w-[40px] rounded-t transition-colors ${
                      isLast ? "bg-accent" : "bg-accent/30"
                    } group-hover:bg-accent-light`}
                    style={{ height: `${heightPct}%` }}
                    title={`${formatPrice(h.price)} – ${formatDate(h.recorded_at)}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{formatPrice(minPrice)}</span>
            <span>{formatPrice(maxPrice)}</span>
          </div>
        </div>
      )}

      {/* Price drops history */}
      {drops.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Historie propadů</h2>
          <div className="space-y-3">
            {drops.map((drop) => (
              <div
                key={drop.id}
                className="flex items-center justify-between rounded-lg bg-background p-4"
              >
                <div className="flex items-center gap-4">
                  <span className="rounded-lg bg-red/10 px-2.5 py-1 text-sm font-bold text-red">
                    −{drop.drop_pct.toFixed(1)}%
                  </span>
                  <div className="text-sm">
                    <span className="text-muted line-through">
                      {formatPrice(drop.old_price)}
                    </span>{" "}
                    →{" "}
                    <span className="font-semibold text-green">
                      {formatPrice(drop.new_price)}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted">
                  {formatDate(drop.detected_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field changes log */}
      {changes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Historie změn</h2>
          <div className="space-y-2">
            {changes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg bg-background p-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-light">
                    {c.field}
                  </span>
                  <span className="text-muted line-through">
                    {c.old_value || "—"}
                  </span>
                  <span className="text-muted">→</span>
                  <span className="font-medium">{c.new_value || "—"}</span>
                </div>
                <span className="text-xs text-muted">
                  {formatDate(c.detected_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All price history table */}
      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Kompletní cenová historie
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Datum</th>
                  <th className="pb-2 text-right font-medium">Cena</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const prev = i > 0 ? history[i - 1].price : null;
                  const diff = prev ? h.price - prev : 0;
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2">
                        {formatDate(h.recorded_at)}
                      </td>
                      <td className="py-2 text-right">
                        <span className="font-medium">
                          {formatPrice(h.price)}
                        </span>
                        {diff !== 0 && (
                          <span
                            className={`ml-2 text-xs ${
                              diff < 0 ? "text-green" : "text-red"
                            }`}
                          >
                            {diff < 0 ? "" : "+"}
                            {formatPrice(diff)}
                          </span>
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
  );
}
