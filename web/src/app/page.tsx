import { Suspense } from "react";
import Link from "next/link";
import StatsCards from "@/components/StatsCards";
import Filters from "@/components/Filters";
import PriceDropCard from "@/components/PriceDropCard";
import HotSection from "@/components/HotSection";
import { getDB } from "@/lib/db";

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

/* ── Data fetching (direct DB queries) ────────────────────────── */

async function getStats() {
  const db = getDB();

  const totalListings = (
    await db.prepare("SELECT COUNT(*) as c FROM listings").get() as unknown as { c: number }
  ).c;

  const totalDrops = (
    await db.prepare("SELECT COUNT(*) as c FROM price_drops").get() as unknown as { c: number }
  ).c;

  const avgDrop = (
    await db.prepare("SELECT AVG(drop_pct) as avg FROM price_drops").get() as unknown as { avg: number | null }
  ).avg;

  const categories = await db
    .prepare("SELECT category, COUNT(*) as count FROM listings GROUP BY category ORDER BY count DESC")
    .all() as unknown as { category: string; count: number }[];

  return {
    totalListings,
    totalDrops,
    avgDrop: avgDrop ? Math.round(avgDrop * 100) / 100 : 0,
    categories,
  };
}

async function getDrops(sp: Record<string, string>) {
  const db = getDB();
  const category = sp.category || "";
  const minDrop = parseFloat(sp.min_drop || "0");
  const location = sp.location || "";
  const page = Math.max(1, parseInt(sp.page || "1", 10));
  const perPage = 30;
  const offset = (page - 1) * perPage;

  let where = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (category) { where += " AND pd.category = ?"; params.push(category); }
  if (minDrop > 0) { where += " AND pd.drop_pct >= ?"; params.push(minDrop); }
  if (location) { where += " AND pd.location LIKE ?"; params.push(`%${location}%`); }

  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM price_drops pd ${where}`)
    .get(...params) as unknown as { total: number };

  const rows = await db
    .prepare(
      `SELECT pd.*, l.price as current_price, l.url as listing_url, l.first_seen_at,
        (SELECT json_group_array(json_object('source', source, 'url', url))
         FROM listing_sources WHERE listing_id = l.id AND removed_at IS NULL) as sources_json
       FROM price_drops pd
       LEFT JOIN listings l ON l.id = pd.listing_id
       ${where}
       ORDER BY pd.detected_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, perPage, offset);

  return {
    drops: rows,
    total: countRow.total,
    page,
    pages: Math.ceil(countRow.total / perPage),
  };
}

async function getHotDrops(): Promise<Drop[]> {
  const db = getDB();
  const rows = await db
    .prepare(
      `SELECT pd.*, l.price as current_price, l.url as listing_url, l.first_seen_at,
        (SELECT json_group_array(json_object('source', source, 'url', url))
         FROM listing_sources WHERE listing_id = l.id AND removed_at IS NULL) as sources_json
       FROM price_drops pd
       LEFT JOIN listings l ON l.id = pd.listing_id
       WHERE pd.drop_pct >= 8
       ORDER BY pd.detected_at DESC
       LIMIT 6`
    )
    .all();
  return rows as unknown as Drop[];
}

async function fetchThumbs(id: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://www.sreality.cz/api/cs/v2/estates/${id}`,
      { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const images: any[] = data._embedded?.images ?? [];
    return images.slice(0, 6).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (img: any) =>
        img._links?.view?.href ||
        img._links?.dynamicDown?.href?.replace("{width}", "800").replace("{height}", "600") ||
        img._links?.gallery?.href || null,
    ).filter(Boolean);
  } catch { return []; }
}

/* ── Page ──────────────────────────────────────────────────────── */

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

  const thumbsArr = await Promise.all(
    (hotDropsRaw as Drop[]).map((d) => fetchThumbs(d.listing_id)),
  );
  const hotDrops: Drop[] = (hotDropsRaw as Drop[]).map((d, i) => ({
    ...d,
    thumbs: thumbsArr[i],
  }));

  return (
    <div className="space-y-10">

      {/* ── Hero ── */}
      {!isFiltered && (
        <section className="relative overflow-hidden rounded-lg border border-border bg-surface-1">
          <div className="px-8 py-12 md:px-14 md:py-16 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-green/10 px-3 py-1 text-[11px] font-medium text-green mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
              Živé sledování trhu
            </div>

            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground leading-[1.15]">
              Cenové propady nemovitostí
              <span className="text-gradient"> v reálném čase</span>
            </h1>

            <p className="mt-4 text-[15px] text-text-secondary leading-relaxed max-w-lg">
              Agregujeme data ze Sreality a Bezrealitky. Sledujeme každou změnu ceny
              a okamžitě detekujeme propady. Porovnáváme s&nbsp;reálnými prodejními cenami z katastru.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/inzerce?sort=newest" className="btn-primary px-5 py-2.5 text-[13px]">
                Procházet inzeráty
              </Link>
              <Link href="/mapa" className="btn-outline px-5 py-2.5 text-[13px]">
                Mapa
              </Link>
              <Link href="/prodeje" className="btn-outline px-5 py-2.5 text-[13px]">
                Tržní data
              </Link>
            </div>
          </div>

          {/* Background gradient */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-accent/[0.03] to-transparent" />
        </section>
      )}

      {/* ── Stats ── */}
      {!isFiltered && (
        <section>
          <StatsCards stats={stats} />
        </section>
      )}

      {/* ── Hot drops ── */}
      {!isFiltered && hotDrops.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Největší propady</h2>
              <p className="text-[13px] text-text-tertiary mt-0.5">Nemovitosti s propadem ceny nad 8 %</p>
            </div>
            <a href="/?min_drop=8" className="text-[12px] text-accent-light hover:text-accent transition-colors">
              Zobrazit vše →
            </a>
          </div>
          <HotSection drops={hotDrops} />
        </section>
      )}

      {/* ── Watchdog promo ── */}
      {!isFiltered && (
        <section className="rounded-lg border border-border bg-surface-1 overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Left — text */}
            <div className="flex-1 p-8 md:p-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent-light mb-4">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                Hlídací pes
              </div>
              <h2 className="text-xl font-semibold text-foreground leading-snug">
                Nechte trh hlídat za vás
              </h2>
              <p className="mt-2 text-[14px] text-text-secondary leading-relaxed max-w-md">
                Nastavte si kritéria — lokalitu, cenu, dispozici — a dostávejte
                upozornění na nové inzeráty i cenové propady. E-mailem nebo na Telegram.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] text-text-tertiary max-w-sm">
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  Nové inzeráty
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  Cenové propady
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  Podhodnocené nabídky
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  Vrácené inzeráty
                </span>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <Link href="/watchdog" className="btn-primary px-5 py-2.5 text-[13px]">
                  Vytvořit hlídacího psa
                </Link>
                <span className="text-[11px] text-text-tertiary">Zdarma · bez limitu</span>
              </div>
            </div>
            {/* Right — visual */}
            <div className="hidden md:flex w-[280px] shrink-0 items-center justify-center bg-gradient-to-br from-accent/[0.04] to-transparent p-8">
              <div className="space-y-3 w-full">
                {[
                  { type: "Nový inzerát", detail: "2+kk · Vinohrady · 6.2 M Kč", time: "před 3 min" },
                  { type: "Propad ceny", detail: "3+1 · Karlín · -12.5 %", time: "před 1h" },
                  { type: "Pod tržní cenou", detail: "2+kk · Žižkov · -8 % vs. katastr", time: "před 2h" },
                ].map((n) => (
                  <div key={n.type} className="rounded-md border border-border bg-surface-1 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-accent-light">{n.type}</span>
                      <span className="text-[9px] text-text-tertiary">{n.time}</span>
                    </div>
                    <div className="text-[11px] text-text-secondary">{n.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Separator ── */}
      {!isFiltered && <div className="h-px bg-border" />}

      {/* ── Drops feed ── */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isFiltered ? "Výsledky" : "Nejnovější propady"}
            </h2>
            <p className="text-[13px] text-text-tertiary mt-0.5">
              <span className="tabular-nums font-medium text-text-secondary">
                {(dropsData.total || 0).toLocaleString("cs-CZ")}
              </span>{" "}
              {isFiltered ? "nalezených nemovitostí" : "cenových propadů celkem"}
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <Filters />
        </Suspense>

        {(dropsData.drops?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-1 py-16">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              className="text-text-tertiary mb-3">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="text-sm text-text-secondary">Žádné výsledky pro zadané filtry</p>
            <Link href="/" className="mt-2 text-[12px] text-accent-light hover:text-accent transition-colors">
              Zrušit filtry
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
              <a
                href={`/?${new URLSearchParams({ ...sp, page: String(currentPage - 1) })}`}
                className="btn-outline py-2 px-4 text-[12px]"
              >
                ← Předchozí
              </a>
            )}
            <span className="px-4 py-2 text-[12px] text-text-tertiary tabular-nums">
              {currentPage} / {dropsData.pages}
            </span>
            {currentPage < dropsData.pages && (
              <a
                href={`/?${new URLSearchParams({ ...sp, page: String(currentPage + 1) })}`}
                className="btn-outline py-2 px-4 text-[12px]"
              >
                Další →
              </a>
            )}
          </div>
        )}
      </section>

      {/* ── Bottom CTA ── */}
      {!isFiltered && (
        <section className="rounded-lg border border-border bg-surface-1 p-8 md:p-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-lg">
              <h2 className="text-xl font-semibold text-foreground">
                Porovnejte s reálnými prodejními cenami
              </h2>
              <p className="mt-2 text-[14px] text-text-secondary leading-relaxed">
                Data z katastru nemovitostí — skutečné transakce, ne nabídkové ceny.
                Zjistěte, jestli je inzerát pod nebo nad tržní cenou.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link href="/prodeje" className="btn-primary px-5 py-2.5 text-[13px]">
                Tržní data
              </Link>
              <Link href="/data" className="btn-outline px-5 py-2.5 text-[13px]">
                Analýzy
              </Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
            {[
              { n: "14", label: "krajů" },
              { n: "77", label: "okresů" },
              { n: "6 250+", label: "obcí" },
              { n: "Denně", label: "aktualizováno" },
            ].map((s) => (
              <div key={s.label} className="bg-surface-2 px-4 py-3 text-center">
                <div className="text-base font-semibold text-foreground">{s.n}</div>
                <div className="text-[11px] text-text-tertiary mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
