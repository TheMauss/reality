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

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getStats() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/stats`, { cache: "no-store" });
  return res.json();
}

async function getDrops(sp: Record<string, string>) {
  const params = new URLSearchParams();
  if (sp.category) params.set("category", sp.category);
  if (sp.min_drop)  params.set("min_drop",  sp.min_drop);
  if (sp.location)  params.set("location",  sp.location);
  if (sp.page)      params.set("page",      sp.page);
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
    return images.slice(0, 6)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((img: any) =>
        img._links?.view?.href ||
        img._links?.dynamicDown?.href?.replace("{width}", "800").replace("{height}", "600") ||
        img._links?.gallery?.href || null
      )
      .filter(Boolean);
  } catch { return []; }
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero({ stats }: { stats: { totalListings: number; totalDrops: number; avgDrop: number } }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/6 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-purple-600/5 blur-3xl" />
        {/* Grid dots */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle, #818CF8 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }} />
      </div>

      <div className="relative px-8 py-12 md:px-16 md:py-16 text-center">
        {/* Live badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/8 px-4 py-1.5 text-[12px] font-semibold text-accent-light">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-light" />
          Živé sledování trhu · aktualizujeme každý den
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl lg:text-[56px] font-extrabold tracking-tight text-foreground leading-[1.1]">
          Sledujte trh.{" "}
          <span className="text-gradient">Kupujte levněji.</span>
        </h1>

        <p className="mt-5 max-w-xl mx-auto text-[15px] md:text-base text-muted leading-relaxed">
          Monitorujeme cenové propady nemovitostí po celé České republice v&nbsp;reálném čase.
          Nikdy nezmeškejte výhodnou nabídku.
        </p>

        {/* CTA buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/inzerce?sort=newest" className="btn-primary text-[14px] px-6 py-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Procházet nemovitosti
          </Link>
          <Link href="/mapa" className="btn-outline text-[14px] px-6 py-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            Mapa cen
          </Link>
          <Link href="/prodeje" className="btn-outline text-[14px] px-6 py-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Tržní data
          </Link>
        </div>

        {/* Inline stat bar */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-8">
          {[
            { value: stats.totalListings?.toLocaleString("cs-CZ") ?? "—", label: "nemovitostí" },
            { value: stats.totalDrops?.toLocaleString("cs-CZ") ?? "—",   label: "propadů cen" },
            { value: `${(stats.avgDrop ?? 0).toFixed(1)}%`,               label: "průměrný propad" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-extrabold text-foreground tabular-nums">{s.value}</div>
              <div className="text-[11px] text-muted mt-0.5 uppercase tracking-wide font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Trust signals */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-muted">
          {["Bez registrace", "Propady v reálném čase", "Porovnání s prodejními cenami", "Kompletní tržní data"].map(s => (
            <span key={s} className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green shrink-0">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  label, title, badge, href, hrefLabel,
}: {
  label: string; title: string; badge?: string; href?: string; hrefLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="section-label mb-1.5">{label}</p>
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          {badge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-dim border border-red/20 px-2.5 py-0.5 text-[10px] font-extrabold text-red uppercase tracking-wide">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
              </svg>
              {badge}
            </span>
          )}
        </div>
      </div>
      {href && hrefLabel && (
        <a href={href} className="text-[12px] text-accent-light hover:text-accent transition-colors font-medium whitespace-nowrap">
          {hrefLabel} →
        </a>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const isFiltered = !!(sp.category || sp.min_drop || sp.location);
  const currentPage = parseInt(sp.page || "1", 10);

  const [stats, dropsData, hotDropsRaw] = await Promise.all([
    getStats(),
    getDrops(sp),
    isFiltered ? Promise.resolve([]) : getHotDrops(),
  ]);

  const thumbsArr = await Promise.all((hotDropsRaw as Drop[]).map(d => fetchThumbs(d.listing_id)));
  const hotDrops: Drop[] = (hotDropsRaw as Drop[]).map((d, i) => ({ ...d, thumbs: thumbsArr[i] }));

  return (
    <div className="space-y-12">

      {/* ── Hero ── */}
      {!isFiltered && (
        <Hero stats={stats} />
      )}

      {/* ── Stats ── */}
      {!isFiltered && (
        <section>
          <SectionHeader label="Aktuální data" title="Přehled trhu" />
          <div className="mt-4">
            <StatsCards stats={stats} />
          </div>
        </section>
      )}

      {/* ── Hot drops ── */}
      {!isFiltered && hotDrops.length > 0 && (
        <section>
          <SectionHeader
            label="Největší propady cen"
            title="Hot nabídky"
            badge="Aktuální"
            href="/?min_drop=8"
            hrefLabel="Zobrazit vše"
          />
          <div className="mt-5">
            <HotSection drops={hotDrops} />
          </div>
        </section>
      )}

      {/* ── Price drops feed ── */}
      <section className="space-y-5">
        <SectionHeader
          label={isFiltered ? "Výsledky hledání" : "Cenové propady"}
          title={isFiltered ? "Nalezené nemovitosti" : "Nejnovější propady"}
          href={!isFiltered ? undefined : undefined}
        />

        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted">
            <span className="font-semibold text-foreground tabular-nums">
              {(dropsData.total || 0).toLocaleString("cs-CZ")}
            </span>{" "}
            výsledků
          </span>
        </div>

        <Suspense fallback={null}>
          <Filters />
        </Suspense>

        {(dropsData.drops?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-card-hover">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-muted">Žádné propady pro zadané filtry</p>
            <Link href="/" className="mt-3 text-[12px] text-accent-light hover:text-accent transition-colors">
              Zrušit filtry
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {dropsData.drops?.map((drop: any) => (
              <PriceDropCard key={drop.id} drop={drop} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {dropsData.pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            {currentPage > 1 && (
              <a href={`/?${new URLSearchParams({ ...sp, page: String(currentPage - 1) })}`}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-[12px] font-semibold text-foreground transition-all hover:border-border-light hover:bg-card-hover">
                ← Předchozí
              </a>
            )}
            <span className="px-4 py-2.5 text-[12px] text-muted">
              Strana{" "}
              <span className="font-semibold text-foreground">{currentPage}</span>
              {" "}z{" "}
              <span className="font-semibold text-foreground">{dropsData.pages}</span>
            </span>
            {currentPage < dropsData.pages && (
              <a href={`/?${new URLSearchParams({ ...sp, page: String(currentPage + 1) })}`}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-[12px] font-semibold text-foreground transition-all hover:border-border-light hover:bg-card-hover">
                Další →
              </a>
            )}
          </div>
        )}
      </section>

      {/* ── Sell CTA ── */}
      {!isFiltered && (
        <section className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="relative overflow-hidden px-8 py-10 md:px-14 md:py-12">
            {/* Decoration */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />

            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="max-w-lg">
                <p className="section-label mb-2">Prodáváte nemovitost?</p>
                <h2 className="text-2xl font-bold text-foreground leading-tight">
                  Zjistěte tržní hodnotu{" "}
                  <span className="text-gradient">vaší nemovitosti</span>
                </h2>
                <p className="mt-3 text-[14px] text-muted leading-relaxed">
                  Porovnejte s aktuálními prodejními cenami v okolí. Bezplatná analýza trhu
                  s reálnými daty z tisíců transakcí.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/prodeje" className="btn-primary text-[13px] px-5 py-2.5">
                    Tržní analýza
                  </Link>
                  <Link href="/data" className="btn-outline text-[13px] px-5 py-2.5">
                    Datový přehled
                  </Link>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 shrink-0 w-full md:w-auto">
                {[
                  { n: "14", sub: "krajů pokrytých" },
                  { n: "77", sub: "sledovaných okresů" },
                  { n: "100%", sub: "bezplatné" },
                  { n: "denně", sub: "aktualizováno" },
                ].map(s => (
                  <div key={s.sub} className="rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-center">
                    <div className="text-xl font-extrabold text-foreground">{s.n}</div>
                    <div className="text-[10px] text-muted mt-0.5 uppercase tracking-wide">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
