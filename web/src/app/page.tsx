import { Suspense } from "react";
import Link from "next/link";
import StatsCards from "@/components/StatsCards";
import Filters from "@/components/Filters";
import PriceDropCard from "@/components/PriceDropCard";
import HotSection from "@/components/HotSection";

interface Drop {
  id: number;
  listing_id: string;
  old_price: number;
  new_price: number;
  drop_pct: number;
  detected_at: string;
  title: string;
  url: string;
  listing_url: string;
  location: string;
  category: string;
  area_m2: number | null;
  thumbs: string[];
}

const AGENTS = [
  {
    name: "Ing. Petra Dvořáková",
    phone: "+420 777 123 456",
    spec: "Praha a Středočeský kraj",
    txCount: 47,
    initials: "PD",
    color: "#818cf8",
  },
  {
    name: "Mgr. Jan Kovář",
    phone: "+420 602 456 789",
    spec: "Brno a Jihomoravský kraj",
    txCount: 83,
    initials: "JK",
    color: "#22c55e",
  },
  {
    name: "Tomáš Novotný",
    phone: "+420 731 567 890",
    spec: "Středočeský kraj",
    txCount: 31,
    initials: "TN",
    color: "#f97316",
  },
];

async function getStats() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/stats`, { cache: "no-store" });
  return res.json();
}

async function getDrops(searchParams: Record<string, string>) {
  const params = new URLSearchParams();
  if (searchParams.category) params.set("category", searchParams.category);
  if (searchParams.min_drop) params.set("min_drop", searchParams.min_drop);
  if (searchParams.location) params.set("location", searchParams.location);
  if (searchParams.page) params.set("page", searchParams.page);
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/drops?${params}`, { cache: "no-store" });
  return res.json();
}

async function getHotDrops(): Promise<Drop[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/drops?min_drop=8&page=1`, { cache: "no-store" });
  const data = await res.json();
  return (data.drops || []).slice(0, 6);
}

async function fetchThumbs(id: string): Promise<string[]> {
  try {
    const res = await fetch(`https://www.sreality.cz/api/cs/v2/estates/${id}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const images: any[] = data._embedded?.images ?? [];
    return images
      .slice(0, 6)
      .map((img) =>
        img._links?.view?.href ||
        img._links?.dynamicDown?.href?.replace("{width}", "800").replace("{height}", "600") ||
        img._links?.gallery?.href ||
        null
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}


function AgentCard({ agent }: { agent: typeof AGENTS[0] }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-background/60 p-4 transition-colors hover:bg-card">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
        style={{ background: `linear-gradient(135deg, ${agent.color}cc, ${agent.color}66)` }}
      >
        {agent.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm text-foreground truncate">{agent.name}</div>
        <div className="text-xs text-muted mt-0.5 mb-2.5">{agent.spec}</div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-accent-light">{agent.phone}</span>
          <span className="text-xs text-muted">{agent.txCount} prodejů</span>
        </div>
      </div>
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const isFiltered = !!(sp.category || sp.min_drop || sp.location);

  const [stats, dropsData, hotDropsRaw] = await Promise.all([
    getStats(),
    getDrops(sp),
    isFiltered ? Promise.resolve([]) : getHotDrops(),
  ]);

  // Pre-fetch thumbnails for hot reality cards (server-side, cached 1h)
  const thumbsArr = await Promise.all((hotDropsRaw as Drop[]).map((d) => fetchThumbs(d.listing_id)));
  const hotDrops: Drop[] = (hotDropsRaw as Drop[]).map((d, i) => ({ ...d, thumbs: thumbsArr[i] }));

  const currentPage = parseInt(sp.page || "1", 10);

  return (
    <div className="space-y-12">
      {/* ── Hero ─────────────────────────────────────────────── */}
      {!isFiltered && (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-accent/5 px-8 py-10 md:px-14 md:py-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/6 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 right-1/3 h-56 w-56 rounded-full bg-purple-600/5 blur-2xl" />

          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent-light">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-light" />
              Živé sledování Sreality.cz · aktualizujeme denně
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl leading-tight">
              Najděte svůj{" "}
              <span className="bg-gradient-to-r from-accent-light via-purple-400 to-pink-400 bg-clip-text text-transparent">
                domov
              </span>{" "}
              za nejlepší cenu
            </h1>

            <p className="mt-4 text-base text-muted md:text-lg">
              Sledujeme propady cen nemovitostí v reálném čase. Nikdy nezmeškejte výhodnou nabídku.
            </p>

            {/* Quick action tabs */}
            <div className="mt-8 flex items-center justify-center gap-2 flex-wrap">
              <Link
                href="/inzerce?sort=newest"
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-light hover:shadow-accent/30"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                Koupit nemovitost
              </Link>
              <Link
                href="/inzerce?category=byty-najem&sort=newest"
                className="flex items-center gap-2 rounded-xl border border-border bg-card/80 px-5 py-3 text-sm font-semibold text-foreground transition-all hover:border-accent/30 hover:bg-card"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                Pronajmout bydlení
              </Link>
              <Link
                href="/prodej"
                className="flex items-center gap-2 rounded-xl border border-border bg-card/80 px-5 py-3 text-sm font-semibold text-foreground transition-all hover:border-accent/30 hover:bg-card"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                Prodat nemovitost
              </Link>
            </div>

            {/* Trust bar */}
            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green"><polyline points="20 6 9 17 4 12"/></svg>
                Bez registrace
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green"><polyline points="20 6 9 17 4 12"/></svg>
                Propady cen v reálném čase
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green"><polyline points="20 6 9 17 4 12"/></svg>
                Porovnání s prodejními cenami
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats ────────────────────────────────────────────── */}
      <StatsCards stats={stats} />

      {/* ── Hot Reality ──────────────────────────────────────── */}
      {!isFiltered && hotDrops.length > 0 && (
        <section>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Hot Reality</h2>
              <span className="flex items-center gap-1.5 rounded-full bg-red/10 px-2.5 py-1 text-xs font-bold text-red ring-1 ring-red/20">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                Největší propady
              </span>
            </div>
            <Link href="/?min_drop=8" className="text-sm text-accent-light hover:text-accent transition-colors">
              Zobrazit vše →
            </Link>
          </div>
          <HotSection drops={hotDrops} />
        </section>
      )}

      {/* ── Price Drops Feed ─────────────────────────────────── */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">
            {isFiltered ? "Výsledky hledání" : "Nejnovější propady"}
          </h2>
          <span className="text-sm text-muted">
            <span className="font-semibold text-foreground">
              {(dropsData.total || 0).toLocaleString("cs-CZ")}
            </span>{" "}
            výsledků
          </span>
        </div>

        <Suspense fallback={null}>
          <Filters />
        </Suspense>

        {(dropsData.drops?.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-border bg-card p-14 text-center">
            <div className="mb-3 flex justify-center opacity-20">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <p className="text-muted">Žádné cenové propady pro zadané filtry.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {dropsData.drops?.map((drop: any) => (
              <PriceDropCard key={drop.id} drop={drop} />
            ))}
          </div>
        )}

        {dropsData.pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {currentPage > 1 && (
              <a
                href={`/?${new URLSearchParams({ ...sp, page: String(currentPage - 1) })}`}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-card-hover"
              >
                ← Předchozí
              </a>
            )}
            <span className="px-4 py-2 text-sm text-muted">
              {currentPage} / {dropsData.pages}
            </span>
            {currentPage < dropsData.pages && (
              <a
                href={`/?${new URLSearchParams({ ...sp, page: String(currentPage + 1) })}`}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-card-hover"
              >
                Další →
              </a>
            )}
          </div>
        )}
      </section>

      {/* ── Agent CTA ────────────────────────────────────────── */}
      {!isFiltered && (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative overflow-hidden border-b border-border bg-gradient-to-r from-accent/8 via-transparent to-purple-600/5 px-8 py-7">
            <div className="pointer-events-none absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-accent/5 to-transparent" />
            <div className="relative">
              <h2 className="text-2xl font-bold tracking-tight">Chcete prodat?</h2>
              <p className="mt-1.5 max-w-lg text-sm text-muted">
                Kontaktujte ověřené realitní makléře z naší sítě. Bezplatná konzultace a rychlý prodej za nejlepší cenu.
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-3">
            {AGENTS.map((agent) => (
              <AgentCard key={agent.name} agent={agent} />
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border/50 px-8 py-4">
            <p className="text-xs text-muted">
              Makléři jsou vybíráni na základě počtu úspěšných transakcí a recenzí.
            </p>
            <button className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/30 hover:text-foreground">
              Stát se makléřem →
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
