import { Suspense } from "react";
import InzerceClient from "@/components/InzerceClient";
import SearchHero from "@/components/SearchHero";

interface Listing {
  id: string;
  title: string;
  location: string;
  area_m2: number | null;
  category: string;
  price: number;
  price_m2: number | null;
  first_seen_at: string;
  thumb?: string | null;
}

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

async function getListingsData(searchParams: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(searchParams)) {
    if (val) params.set(key, val);
  }
  const res = await fetch(`${BASE}/api/listings?${params}`, { cache: "no-store" });
  return res.json();
}

async function getNewest(category: string): Promise<Listing[]> {
  const params = new URLSearchParams({ sort: "newest", page: "1" });
  if (category) params.set("category", category);
  const res = await fetch(`${BASE}/api/listings?${params}`, { cache: "no-store" });
  const data = await res.json();
  return (data.listings || []).slice(0, 6);
}

async function fetchThumb(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.sreality.cz/api/cs/v2/estates/${id}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const img = data._embedded?.images?.[0];
    if (!img) return null;
    return (
      img._links?.view?.href ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (img._links?.dynamicDown as any)?.href?.replace("{width}", "600").replace("{height}", "400") ||
      img._links?.gallery?.href ||
      null
    );
  } catch {
    return null;
  }
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)} M Kč`;
  return `${Math.round(price).toLocaleString("cs-CZ")} Kč`;
}

function daysAgo(dateStr: string): string {
  const elapsed = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (elapsed < 60) return `Před ${elapsed} min`;
  if (elapsed < 1440) return `Před ${Math.floor(elapsed / 60)}h`;
  const days = Math.floor(elapsed / 1440);
  if (days === 1) return "Včera";
  return `Před ${days} dny`;
}

function NewestCard({ listing }: { listing: Listing }) {
  const timeLabel = daysAgo(listing.first_seen_at);

  return (
    <a
      href={`/listing/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-accent/30 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative h-52 shrink-0 overflow-hidden bg-card-hover">
        {listing.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.thumb}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(135deg,#13151f,#1a1d2e)" }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-border">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        )}
        {/* Badges */}
        <div className="absolute top-2.5 left-2.5">
          <span className="rounded-md bg-green/90 px-2 py-0.5 text-[10px] font-bold text-black tracking-wide">
            NOVÉ
          </span>
        </div>
        <div className="absolute top-2.5 right-2.5">
          <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
            {timeLabel}
          </span>
        </div>
        {/* Area badge bottom right */}
        {listing.area_m2 && (
          <div className="absolute bottom-2.5 right-2.5">
            <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">
              {listing.area_m2} m²
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent-light transition-colors mb-2">
          {listing.title}
        </p>
        {listing.location && (
          <p className="mb-3 flex items-center gap-1.5 truncate text-xs text-muted">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {listing.location}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2">
          <span className="text-base font-bold">{formatPrice(listing.price)}</span>
          {listing.price_m2 && (
            <span className="text-xs text-muted">{Math.round(listing.price_m2).toLocaleString("cs-CZ")} Kč/m²</span>
          )}
        </div>
      </div>
    </a>
  );
}

// ── Static data ──────────────────────────────────────────

const HOT_PLACES = [
  { label: "Praha",           sublabel: "Hlavní město",        emoji: "🏙️" },
  { label: "Brno",            sublabel: "Jihomoravský kraj",   emoji: "🏛️" },
  { label: "Ostrava",         sublabel: "Moravskoslezský kraj",emoji: "🏭" },
  { label: "Plzeň",           sublabel: "Plzeňský kraj",       emoji: "🍺" },
  { label: "Liberec",         sublabel: "Liberecký kraj",      emoji: "⛰️" },
  { label: "Olomouc",         sublabel: "Olomoucký kraj",      emoji: "🏰" },
  { label: "Hradec Králové",  sublabel: "Královéhradecký kraj",emoji: "👑" },
  { label: "Zlín",            sublabel: "Zlínský kraj",        emoji: "🏔️" },
];

const PRAGUE_AREAS = [
  "Praha 1", "Praha 2", "Praha 3", "Praha 4", "Praha 5",
  "Praha 6", "Praha 7", "Praha 8", "Praha 9", "Praha 10",
  "Vinohrady", "Žižkov", "Smíchov", "Dejvice", "Holešovice", "Karlín",
];

function getMarketStats(category: string, total: number) {
  switch (category) {
    case "byty-prodej":
      return {
        heading: "Trh bytů k prodeji",
        stats: [
          { value: "148 000 Kč/m²", label: "Průměr Praha", sub: "byty · prodej" },
          { value: "78 000 Kč/m²",  label: "Průměr ČR",    sub: "byty · prodej" },
          { value: `${total.toLocaleString("cs-CZ")}`, label: "dostupných bytů", sub: "aktuálně" },
          { value: "+4.2 %",        label: "Meziročně",     sub: "Praha" },
        ],
      };
    case "byty-najem":
      return {
        heading: "Trh pronájmů bytů",
        stats: [
          { value: "350 Kč/m²",    label: "Nájem Praha",   sub: "byty · pronájem" },
          { value: "180 Kč/m²",    label: "Nájem ČR",      sub: "byty · pronájem" },
          { value: `${total.toLocaleString("cs-CZ")}`, label: "nabídek pronájmu", sub: "aktuálně" },
          { value: "Dnes",          label: "Aktualizováno", sub: "Sledujeme v reálném čase" },
        ],
      };
    case "domy-prodej":
      return {
        heading: "Trh domů k prodeji",
        stats: [
          { value: "11.5 M Kč",    label: "Průměr Praha",  sub: "rodinné domy" },
          { value: "5.2 M Kč",     label: "Průměr ČR",     sub: "rodinné domy" },
          { value: `${total.toLocaleString("cs-CZ")}`, label: "domů k prodeji", sub: "aktuálně" },
          { value: "+3.8 %",        label: "Meziročně",     sub: "Praha" },
        ],
      };
    case "domy-najem":
      return {
        heading: "Trh pronájmů domů",
        stats: [
          { value: "45 000 Kč/měs", label: "Pronájem Praha", sub: "rodinné domy" },
          { value: "22 000 Kč/měs", label: "Pronájem ČR",    sub: "rodinné domy" },
          { value: `${total.toLocaleString("cs-CZ")}`, label: "domů k pronájmu", sub: "aktuálně" },
          { value: "Rodinné domy",  label: "Kategorie",        sub: "Vily, chaty i chalupy" },
        ],
      };
    case "pozemky-prodej":
      return {
        heading: "Trh pozemků",
        stats: [
          { value: "8 000 Kč/m²",  label: "Průměr Praha",  sub: "stavební pozemky" },
          { value: "1 500 Kč/m²",  label: "Průměr ČR",     sub: "pozemky" },
          { value: `${total.toLocaleString("cs-CZ")}`, label: "pozemků", sub: "aktuálně" },
          { value: "Stavební + zemědělské", label: "Typy", sub: "Vše v jednom místě" },
        ],
      };
    default:
      return {
        heading: "Trh v číslech",
        stats: [
          { value: `${total.toLocaleString("cs-CZ")}`, label: "nemovitostí celkem", sub: "aktuálně" },
          { value: "14 000+",       label: "cenových propadů",  sub: "sledujeme" },
          { value: "Denně",         label: "Aktualizujeme",     sub: "Sreality.cz v reálném čase" },
          { value: "6",             label: "kategorií",         sub: "byty, domy, pozemky…" },
        ],
      };
  }
}

function getNewestLabel(category: string) {
  switch (category) {
    case "byty-prodej":  return "Nejnovější byty k prodeji";
    case "byty-najem":   return "Nejnovější pronájmy bytů";
    case "domy-prodej":  return "Nejnovější domy k prodeji";
    case "domy-najem":   return "Nejnovější pronájmy domů";
    case "pozemky-prodej": return "Nejnovější pozemky";
    default:             return "Právě přidáno";
  }
}

function getPopularSearches(category: string) {
  switch (category) {
    case "byty-prodej":
      return [
        { label: "2+kk Praha",        href: "/inzerce?location=Praha&layout=2%2Bkk&category=byty-prodej" },
        { label: "3+1 Praha",          href: "/inzerce?location=Praha&layout=3%2B1&category=byty-prodej" },
        { label: "2+kk Brno",          href: "/inzerce?location=Brno&layout=2%2Bkk&category=byty-prodej" },
        { label: "Byt Praha pod 5 M",  href: "/inzerce?location=Praha&max_price=5000000&category=byty-prodej" },
        { label: "Byt Praha pod 10 M", href: "/inzerce?location=Praha&max_price=10000000&category=byty-prodej" },
        { label: "Novostavba Praha",   href: "/inzerce?location=Praha&category=byty-prodej" },
      ];
    case "byty-najem":
      return [
        { label: "Pronájem 2+kk Praha", href: "/inzerce?location=Praha&layout=2%2Bkk&category=byty-najem" },
        { label: "Pronájem 3+1 Praha",  href: "/inzerce?location=Praha&layout=3%2B1&category=byty-najem" },
        { label: "Pronájem Brno",        href: "/inzerce?location=Brno&category=byty-najem" },
        { label: "Pronájem pod 20 000 Kč",href: "/inzerce?max_price=20000&category=byty-najem" },
        { label: "Pronájem Vinohrady",   href: "/inzerce?location=Vinohrady&category=byty-najem" },
      ];
    case "domy-prodej":
      return [
        { label: "Rodinný dům Praha",   href: "/inzerce?location=Praha&category=domy-prodej" },
        { label: "Dům Středočeský kraj",href: "/inzerce?location=Středočeský&category=domy-prodej" },
        { label: "Vila Praha",           href: "/inzerce?location=Praha&category=domy-prodej" },
        { label: "Dům Brno",             href: "/inzerce?location=Brno&category=domy-prodej" },
      ];
    default:
      return [
        { label: "Byty Praha",    href: "/inzerce?location=Praha&category=byty-prodej" },
        { label: "Pronájem Praha",href: "/inzerce?location=Praha&category=byty-najem" },
        { label: "Byty Brno",     href: "/inzerce?location=Brno&category=byty-prodej" },
        { label: "Domy Praha",    href: "/inzerce?location=Praha&category=domy-prodej" },
      ];
  }
}

function getGuides(category: string) {
  if (category?.includes("najem")) {
    return [
      {
        title: "Jak najít ideální pronájem",
        desc: "Co sledovat při výběru bytu a jak rychle reagovat na inzeráty v konkurenčním trhu.",
        cta: "/prodeje",
      },
      {
        title: "Na co si dát pozor v nájemní smlouvě",
        desc: "Klíčové klauzule, kauce a zákonná ochrana nájemce v české legislativě.",
        cta: "/prodeje",
      },
      {
        title: "Práva nájemce v ČR",
        desc: "Co vám pronajímatel nesmí zakázat a jak řešit spory. Přehled zákonných práv.",
        cta: "/prodeje",
      },
    ];
  }
  if (category?.includes("prodej") || !category) {
    return [
      {
        title: "Jak koupit byt krok za krokem",
        desc: "Od prvního prohlídky po podpis kupní smlouvy. Kompletní průvodce pro kupující.",
        cta: "/prodej",
      },
      {
        title: "Jak financovat nemovitost",
        desc: "Hypotéky, úrokové sazby, fixace a co vám banky neřeknou. Aktuální srovnání.",
        cta: "/prodeje",
      },
      {
        title: "Co zkontrolovat před koupí",
        desc: "Katastr, věcná břemena, technický stav a skryté vady. Checklist pro kupující.",
        cta: "/prodeje",
      },
    ];
  }
  return [
    {
      title: "Jak koupit nemovitost",
      desc: "Průvodce celým procesem koupě od vyhledání po předání klíčů.",
      cta: "/prodej",
    },
    {
      title: "Jak financovat koupi",
      desc: "Hypotéky a alternativní financování – aktuální srovnání bank.",
      cta: "/prodeje",
    },
    {
      title: "Kdy prodat nemovitost",
      desc: "Analýza sezónnosti trhu a vliv úrokových sazeb na nabídku.",
      cta: "/prodeje",
    },
  ];
}

const GuideIconSearch = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const GuideIconDoc = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);
const GuideIconKey = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
);

const GUIDE_ICONS = [GuideIconSearch, GuideIconDoc, GuideIconKey];

// ── Page ─────────────────────────────────────────────────

export default async function InzercePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const hasFilter = !!(
    sp.location || sp.min_price || sp.max_price ||
    sp.min_area || sp.max_area || sp.layout || sp.page
  );

  const [data, newestRaw] = await Promise.all([
    getListingsData(sp),
    getNewest(sp.category || ""),
  ]);

  const thumbs = await Promise.all(newestRaw.map((l: Listing) => fetchThumb(l.id)));
  const newest: Listing[] = newestRaw.map((l: Listing, i: number) => ({ ...l, thumb: thumbs[i] }));

  const currentPage = parseInt(sp.page || "1", 10);
  const cat = sp.category || "";
  const marketStats = getMarketStats(cat, data.total || 0);
  const popularSearches = getPopularSearches(cat);
  const guides = getGuides(cat);
  const newestLabel = getNewestLabel(cat);

  return (
    <div className="space-y-10">

      {/* ── Search hero ──────────────────────────────────────── */}
      <SearchHero activeCategory={sp.category} activeLocation={sp.location} />

      {/* ── Landing page sections (no filter) ───────────────── */}
      {!hasFilter && (
        <>
          {/* ── B) Market stats bar ── */}
          <section>
            <h2 className="mb-4 text-lg font-bold">{marketStats.heading}</h2>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {marketStats.stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="text-xl font-bold text-accent-light leading-tight">{s.value}</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{s.label}</div>
                  <div className="mt-0.5 text-xs text-muted">{s.sub}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── C) Newest listings ── */}
          {newest.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold">{newestLabel}</h2>
                  <span className="rounded-full bg-green/10 px-2.5 py-0.5 text-xs font-bold text-green outline outline-1 outline-green/20">
                    Právě přidáno
                  </span>
                </div>
                <a
                  href={`/inzerce?sort=newest${cat ? `&category=${cat}` : ""}`}
                  className="text-sm text-accent-light hover:text-accent transition-colors"
                >
                  Zobrazit vše →
                </a>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                {newest.map((l) => (
                  <NewestCard key={l.id} listing={l} />
                ))}
              </div>
            </section>
          )}

          {/* ── D) Explore by city / district ── */}
          <section className="space-y-6">
            <h2 className="text-lg font-bold">Prozkoumejte podle lokality</h2>

            {/* Major cities grid */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
              {HOT_PLACES.map((place) => {
                const href = cat
                  ? `/inzerce?location=${encodeURIComponent(place.label)}&category=${cat}`
                  : `/inzerce?location=${encodeURIComponent(place.label)}`;
                return (
                  <a
                    key={place.label}
                    href={href}
                    className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:border-accent/30 hover:bg-card-hover hover:-translate-y-0.5"
                  >
                    <span className="text-2xl">{place.emoji}</span>
                    <div>
                      <div className="text-sm font-semibold text-foreground group-hover:text-accent-light transition-colors">
                        {place.label}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5">{place.sublabel}</div>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Prague districts */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Části Prahy</span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="flex flex-wrap gap-2">
                {PRAGUE_AREAS.map((area) => {
                  const href = cat
                    ? `/inzerce?location=${encodeURIComponent(area)}&category=${cat}`
                    : `/inzerce?location=${encodeURIComponent(area)}`;
                  return (
                    <a
                      key={area}
                      href={href}
                      className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted transition-all hover:border-accent/30 hover:text-foreground"
                    >
                      {area}
                    </a>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── E) Popular searches ── */}
          <section>
            <h2 className="mb-4 text-lg font-bold">Nejčastěji hledáte</h2>
            <div className="flex flex-wrap gap-2">
              {popularSearches.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted transition-all hover:border-accent/30 hover:text-foreground"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </section>

          {/* ── F) Guides ── */}
          <section>
            <h2 className="mb-4 text-lg font-bold">Průvodci a rady</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {guides.map((g, i) => {
                const Icon = GUIDE_ICONS[i % GUIDE_ICONS.length];
                return (
                  <div
                    key={g.title}
                    className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/30 hover:shadow-lg hover:shadow-black/20"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted">
                      <Icon />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground group-hover:text-accent-light transition-colors leading-snug mb-1.5">
                        {g.title}
                      </h3>
                      <p className="text-xs text-muted leading-relaxed">{g.desc}</p>
                    </div>
                    <a
                      href={g.cta}
                      className="mt-auto text-xs font-semibold text-accent-light hover:underline"
                    >
                      Číst →
                    </a>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* ── Divider ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">
          {(data.total || 0).toLocaleString("cs-CZ")} inzerátů
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {/* ── Full filterable grid ──────────────────────────────── */}
      <Suspense
        fallback={
          <div className="h-96 flex items-center justify-center text-muted text-sm">
            Načítání…
          </div>
        }
      >
        <InzerceClient
          listings={data.listings || []}
          total={data.total || 0}
          pages={data.pages || 1}
          currentPage={currentPage}
          sp={sp}
          defaultSplit={!!(sp.location || sp.min_price || sp.max_price || sp.min_area || sp.max_area || sp.layout)}
        />
      </Suspense>
    </div>
  );
}
