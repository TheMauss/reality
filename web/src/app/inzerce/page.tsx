import { Suspense } from "react";
import Link from "next/link";
import InzerceClient from "@/components/InzerceClient";
import SearchHero from "@/components/SearchHero";
import NewestCard from "@/components/NewestCard";

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

import { baseUrl } from "@/lib/base-url";

async function getListingsData(searchParams: Record<string, string>) {
  const base = await baseUrl();
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(searchParams)) {
    if (val) params.set(key, val);
  }
  const res = await fetch(`${base}/api/listings?${params}`, { cache: "no-store" });
  return res.json();
}

async function getNewest(category: string, limit = 6): Promise<Listing[]> {
  const base = await baseUrl();
  const params = new URLSearchParams({ sort: "newest", page: "1" });
  if (category) params.set("category", category);
  const res = await fetch(`${base}/api/listings?${params}`, { cache: "no-store" });
  const data = await res.json();
  return (data.listings || []).slice(0, limit);
}

interface NewestSection {
  label: string;
  category: string;
  listings: Listing[];
}

async function getNewestSections(category: string): Promise<NewestSection[]> {
  const CATEGORIES: { cat: string; label: string }[] = [
    { cat: "byty-prodej",    label: "Nejnovější byty k prodeji" },
    { cat: "byty-najem",     label: "Nejnovější pronájmy bytů" },
    { cat: "domy-prodej",    label: "Nejnovější domy k prodeji" },
    { cat: "domy-najem",     label: "Nejnovější pronájmy domů" },
  ];

  if (category) {
    const label = CATEGORIES.find(c => c.cat === category)?.label ?? "Právě přidáno";
    const listings = await getNewest(category, 6);
    const thumbs = await Promise.all(listings.map((l: Listing) => fetchThumb(l.id)));
    return [{ label, category, listings: listings.map((l: Listing, i: number) => ({ ...l, thumb: thumbs[i] })) }];
  }

  const sections = await Promise.all(
    CATEGORIES.map(async ({ cat, label }) => {
      const listings = await getNewest(cat, 3);
      const thumbs = await Promise.all(listings.map((l: Listing) => fetchThumb(l.id)));
      return { label, category: cat, listings: listings.map((l: Listing, i: number) => ({ ...l, thumb: thumbs[i] })) };
    })
  );
  return sections.filter(s => s.listings.length > 0);
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


// ── Static data ──────────────────────────────────────────

const HOT_PLACES = [
  { label: "Praha",           sublabel: "Hlavní město" },
  { label: "Brno",            sublabel: "Jihomoravský kraj" },
  { label: "Ostrava",         sublabel: "Moravskoslezský kraj" },
  { label: "Plzeň",           sublabel: "Plzeňský kraj" },
  { label: "Liberec",         sublabel: "Liberecký kraj" },
  { label: "Olomouc",         sublabel: "Olomoucký kraj" },
  { label: "Hradec Králové",  sublabel: "Královéhradecký kraj" },
  { label: "Zlín",            sublabel: "Zlínský kraj" },
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
          { value: "148 000 Kč/m²", label: "Průměr Praha" },
          { value: "78 000 Kč/m²",  label: "Průměr ČR" },
          { value: `${total.toLocaleString("cs-CZ")}`, label: "Dostupných bytů" },
          { value: "+4.2 %",        label: "Meziročně Praha" },
        ],
      };
    case "byty-najem":
      return {
        heading: "Trh pronájmů bytů",
        stats: [
          { value: "350 Kč/m²",    label: "Nájem Praha" },
          { value: "180 Kč/m²",    label: "Nájem ČR" },
          { value: `${total.toLocaleString("cs-CZ")}`, label: "Nabídek pronájmu" },
          { value: "Denně",         label: "Aktualizováno" },
        ],
      };
    case "domy-prodej":
      return {
        heading: "Trh domů k prodeji",
        stats: [
          { value: "11.5 M Kč",    label: "Průměr Praha" },
          { value: "5.2 M Kč",     label: "Průměr ČR" },
          { value: `${total.toLocaleString("cs-CZ")}`, label: "Domů k prodeji" },
          { value: "+3.8 %",        label: "Meziročně Praha" },
        ],
      };
    case "domy-najem":
      return {
        heading: "Trh pronájmů domů",
        stats: [
          { value: "45 000 Kč/měs", label: "Pronájem Praha" },
          { value: "22 000 Kč/měs", label: "Pronájem ČR" },
          { value: `${total.toLocaleString("cs-CZ")}`, label: "Domů k pronájmu" },
          { value: "Rodinné domy",  label: "Vily, chaty i chalupy" },
        ],
      };
    case "pozemky-prodej":
      return {
        heading: "Trh pozemků",
        stats: [
          { value: "8 000 Kč/m²",  label: "Průměr Praha" },
          { value: "1 500 Kč/m²",  label: "Průměr ČR" },
          { value: `${total.toLocaleString("cs-CZ")}`, label: "Pozemků" },
          { value: "Stavební + zemědělské", label: "Typy" },
        ],
      };
    default:
      return {
        heading: "Trh v číslech",
        stats: [
          { value: `${total.toLocaleString("cs-CZ")}`, label: "Nemovitostí celkem" },
          { value: "14 000+",       label: "Cenových propadů" },
          { value: "Denně",         label: "Aktualizujeme" },
          { value: "6",             label: "Kategorií" },
        ],
      };
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
  return [
    {
      title: "Jak koupit byt krok za krokem",
      desc: "Od první prohlídky po podpis kupní smlouvy. Kompletní průvodce pro kupující.",
      cta: "/prodeje",
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

  const [data, newestSections] = await Promise.all([
    getListingsData(sp),
    hasFilter ? Promise.resolve([]) : getNewestSections(sp.category || ""),
  ]);

  const currentPage = parseInt(sp.page || "1", 10);
  const cat = sp.category || "";
  const marketStats = getMarketStats(cat, data.total || 0);
  const popularSearches = getPopularSearches(cat);
  const guides = getGuides(cat);

  // ── Compact results mode (after search / filter) ──
  if (hasFilter) {
    return (
      <Suspense
        fallback={
          <div className="h-96 flex items-center justify-center text-text-secondary text-[13px]">
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
          compactMode
        />
      </Suspense>
    );
  }

  // ── Landing page mode ──
  return (
    <div className="space-y-10">

      {/* Search hero */}
      <SearchHero activeCategory={sp.category} activeLocation={sp.location} />

      {!hasFilter && (
        <>
          {/* Market stats */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-4">{marketStats.heading}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
              {marketStats.stats.map((s) => (
                <div key={s.label} className="bg-surface-1 px-5 py-4">
                  <div className="text-lg font-semibold text-foreground tabular-nums">{s.value}</div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Newest listings sections */}
          {(newestSections as NewestSection[]).map((section) => (
            <section key={section.category}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-semibold text-foreground">{section.label}</h2>
                  <span className="inline-flex items-center gap-1 rounded-md bg-green/10 px-2 py-0.5 text-[10px] font-medium text-green">
                    <span className="h-1 w-1 rounded-full bg-green animate-pulse" />
                    Právě přidáno
                  </span>
                </div>
                <a
                  href={`/inzerce?sort=newest&category=${section.category}`}
                  className="text-[12px] text-accent-light hover:text-accent transition-colors"
                >
                  Zobrazit vše →
                </a>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.listings.map((l) => (
                  <NewestCard key={l.id} listing={l} />
                ))}
              </div>
            </section>
          ))}

          {/* Explore by location */}
          <section className="space-y-5">
            <h2 className="text-sm font-semibold text-foreground">Prozkoumejte podle lokality</h2>

            {/* Major cities */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-px bg-border rounded-lg overflow-hidden">
              {HOT_PLACES.map((place) => {
                const href = cat
                  ? `/inzerce?location=${encodeURIComponent(place.label)}&category=${cat}`
                  : `/inzerce?location=${encodeURIComponent(place.label)}`;
                return (
                  <a
                    key={place.label}
                    href={href}
                    className="bg-surface-1 px-3 py-3.5 text-center transition-colors hover:bg-surface-2"
                  >
                    <div className="text-[13px] font-medium text-foreground">{place.label}</div>
                    <div className="text-[10px] text-text-tertiary mt-0.5">{place.sublabel}</div>
                  </a>
                );
              })}
            </div>

            {/* Prague districts */}
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[12px] font-medium text-text-secondary">Části Prahy</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRAGUE_AREAS.map((area) => {
                  const href = cat
                    ? `/inzerce?location=${encodeURIComponent(area)}&category=${cat}`
                    : `/inzerce?location=${encodeURIComponent(area)}`;
                  return (
                    <a
                      key={area}
                      href={href}
                      className="rounded-md border border-border bg-surface-1 px-3 py-1.5 text-[12px] text-text-secondary transition-all hover:border-border-hover hover:text-foreground"
                    >
                      {area}
                    </a>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Popular searches */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">Nejčastěji hledáte</h2>
            <div className="flex flex-wrap gap-1.5">
              {popularSearches.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="rounded-md border border-border bg-surface-1 px-3 py-1.5 text-[12px] text-text-secondary transition-all hover:border-border-hover hover:text-foreground"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </section>

          {/* Guides */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-4">Průvodci a rady</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {guides.map((g) => (
                <div
                  key={g.title}
                  className="rounded-lg border border-border bg-surface-1 p-5 card-lift"
                >
                  <h3 className="text-[13px] font-medium text-foreground leading-snug mb-2">
                    {g.title}
                  </h3>
                  <p className="text-[12px] text-text-tertiary leading-relaxed mb-4">{g.desc}</p>
                  <Link
                    href={g.cta}
                    className="text-[12px] font-medium text-accent-light hover:text-accent transition-colors"
                  >
                    Číst více →
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="rounded-lg border border-border bg-surface-1 p-8 md:p-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="max-w-lg">
                <h2 className="text-xl font-semibold text-foreground">
                  Porovnejte s reálnými cenami z katastru
                </h2>
                <p className="mt-2 text-[14px] text-text-secondary leading-relaxed">
                  Data ze skutečných transakcí — ne nabídkové ceny. Zjistěte, jestli je inzerát pod nebo nad tržní cenou.
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
          </section>
        </>
      )}

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Full filterable grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Všechny inzeráty</h2>
            <p className="text-[12px] text-text-tertiary mt-0.5">
              <span className="tabular-nums font-medium text-text-secondary">
                {(data.total || 0).toLocaleString("cs-CZ")}
              </span>{" "}
              inzerátů celkem
            </p>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="h-96 flex items-center justify-center text-text-secondary text-[13px]">
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
      </section>
    </div>
  );
}
