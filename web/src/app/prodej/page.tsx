import Link from "next/link";

// ── Data ─────────────────────────────────────────────────

const AGENTS = [
  { initials: "PD", name: "Petra Dvořáková", agency: "Keller Williams Praha", spec: "Praha 1–5",   txCount: 47,  years: 12, rating: 4.9, reviews: 38,  color: "#818cf8" },
  { initials: "JK", name: "Jan Kovář",        agency: "RE/MAX Centrum",       spec: "Praha 6–10",  txCount: 83,  years: 18, rating: 4.8, reviews: 71,  color: "#22c55e" },
  { initials: "TN", name: "Tomáš Novotný",    agency: "Century 21 Prague",    spec: "Praha a okolí",txCount: 31, years: 7,  rating: 4.7, reviews: 24,  color: "#f97316" },
  { initials: "MH", name: "Monika Horáková",  agency: "Lexxus Norton",        spec: "Praha 11–15", txCount: 58,  years: 14, rating: 5.0, reviews: 52,  color: "#e879f9" },
  { initials: "RB", name: "Robert Blažek",    agency: "Berkshire Hathaway HS",spec: "Praha 2, 4",  txCount: 147, years: 24, rating: 4.9, reviews: 118, color: "#38bdf8" },
];

const SELLING_OPTIONS = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    label: "S makléřem",
    tag: "Doporučeno",
    tagColor: "#818cf8",
    headline: "Průměrně o 8–15 % vyšší cena s makléřem",
    bullets: [
      "Profesionální prezentace a fotografie",
      "Aktivní hledání kupce v databázi",
      "Právní servis a smlouvy v ceně",
      "Průměrná doba prodeje: 4–8 týdnů",
    ],
    priceNote: "Provize 2–4 % z ceny",
    cta: "Najít makléře",
    href: "#makler",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
    label: "Rychlý odkup",
    tag: "Bez starostí",
    tagColor: "#22c55e",
    headline: "Nabídka do 24 hodin, peníze do 2 týdnů",
    bullets: [
      "Žádné opravy ani přípravy",
      "Vy si vyberete datum předání",
      "Bez výpadku příjmů",
    ],
    priceNote: "Cca 85–93 % tržní ceny",
    cta: "Ověřit způsobilost",
    href: "#odkup",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    label: "Sám bez makléře",
    tag: "Max. výnos",
    tagColor: "#f97316",
    headline: "Ušetřete na provizi a nechte si 100 %",
    bullets: [
      "Kompletní kontrola nad procesem",
      "Průvodce krok za krokem",
      "Naše nástroje a cenová data",
    ],
    priceNote: "Žádná provize",
    cta: "Přidat inzerát",
    href: "#sam",
  },
];

const TESTIMONIALS = [
  {
    quote: "Prodali jsme byt za vyšší cenu než jsme čekali. Celý proces trval 5 týdnů a makléř se postaral o vše.",
    name: "Jana K.",
    location: "Praha 3",
    type: "Prodej bytu 3+1",
  },
  {
    quote: "Rychlý odkup byl přesně to, co jsme potřebovali po stěhování do zahraničí. Bez starostí.",
    name: "Michal V.",
    location: "Brno",
    type: "Rychlý odkup domu",
  },
  {
    quote: "Díky cenovým datům jsem si byt prodal sám a ušetřil 180 000 Kč na provizi.",
    name: "Tomáš L.",
    location: "Praha 6",
    type: "Prodej sám",
  },
];

const GUIDES = [
  {
    title: "Kdy je nejlepší čas prodat?",
    desc: "Analýza sezónnosti českého trhu nemovitostí a vliv úrokových sazeb.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    title: "Jak správně ocenit nemovitost?",
    desc: "Metodika srovnávací analýzy trhu. Jak číst cenové mapy.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    title: "Home staging: zvyšte atraktivitu",
    desc: "Jednoduché úpravy, které mohou zvýšit nabídkovou cenu o 3–7 %.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    title: "Právní průvodce prodávajícího",
    desc: "Kupní smlouva, daň z příjmu, převod vlastnictví. Krok za krokem.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
];

const FAQ = [
  {
    q: "Jak rychle lze prodat nemovitost?",
    a: "Průměrná doba od zveřejnění inzerátu po podpis kupní smlouvy je v ČR 2–4 měsíce. S profesionální prezentací, správnou cenou a aktivním makléřem lze urychlit na 4–6 týdnů. Rychlý odkup zajistí uzavření do 2 týdnů.",
  },
  {
    q: "Kolik stojí provize makléře?",
    a: "Standardní provize se pohybuje od 2 do 4 % z prodejní ceny a platí ji obvykle prodávající. Někteří makléři nabízejí pevný poplatek nebo provizi rozdělenou mezi kupujícího a prodávajícího. Vždy si předem ověřte, co je zahrnuto v ceně.",
  },
  {
    q: "Musím platit daň z prodeje nemovitosti?",
    a: "Pokud vlastníte nemovitost déle než 10 let nebo v ní máte trvalý pobyt alespoň 2 roky, příjem z prodeje je osvobozen od daně z příjmu. V ostatních případech podléhá zdanění jako ostatní příjmy (15 % fyzické osoby). Doporučujeme konzultaci s daňovým poradcem.",
  },
  {
    q: "Co je rychlý odkup nemovitosti?",
    a: "Rychlý odkup je přímý prodej nemovitosti investorovi nebo specializované společnosti bez nutnosti čekat na kupce na volném trhu. Výhodou je rychlost (uzavření do 2 týdnů) a absence příprav, oprav nebo prohlídek. Nevýhodou je nižší cena – obvykle 85–93 % tržní hodnoty.",
  },
  {
    q: "Jak zjistím tržní hodnotu mé nemovitosti?",
    a: "Nejpřesnější odhad poskytne licencovaný odhadce nebo srovnávací analýza trhu (CMA) od makléře. Pro orientační hodnotu můžete využít naši cenovou mapu ČR, která vychází z dat katastrálních zápisů a aktuálních nabídkových cen ve vaší lokalitě.",
  },
];

// ── Star rating helper ─────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <span className="text-amber text-sm tracking-tight" aria-label={`${rating} hvězd`}>
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full) return "★";
        if (i === full && hasHalf) return "½";
        return "☆";
      }).join("")}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────

export default function ProdejPage() {
  return (
    <div className="space-y-16">

      {/* ── A) Hero ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-accent/5 px-6 py-10 md:px-10 md:py-14">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/6 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-accent/5 blur-2xl" />

        <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
          {/* Left */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent-light">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-light" />
              Prodej nemovitosti
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl leading-tight">
              Prodejte za{" "}
              <span className="text-gradient">
                nejlepší cenu
              </span>{" "}
              na trhu
            </h1>
            <p className="mt-4 text-base text-muted leading-relaxed">
              Nabízíme tři osvědčené způsoby prodeje. Vyberte si cestu, která odpovídá vaší situaci, časovým možnostem a finančním cílům.
            </p>

            {/* Trust stats */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: "47 prodejů", label: "průměrně ročně" },
                { value: "3–6 týdnů", label: "průměrná doba prodeje" },
                { value: "Zdarma",    label: "konzultace" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-background p-3 text-center">
                  <div className="text-sm font-bold text-accent-light">{s.value}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{s.label}</div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#moznosti"
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-light"
              >
                Prozkoumat možnosti →
              </a>
              <Link
                href="/prodeje"
                className="rounded-xl border border-border bg-card/80 px-5 py-2.5 text-sm font-semibold transition-all hover:border-accent/30 hover:text-accent-light"
              >
                Cenová mapa ČR
              </Link>
            </div>
          </div>

          {/* Right: valuation card */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card-hover p-6 shadow-xl shadow-black/30">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent-light/70">Odhad ceny</p>
            <h2 className="text-lg font-bold text-foreground">Zjistěte hodnotu vaší nemovitosti</h2>
            <div className="mt-5 flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted">Adresa</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="např. Mánesova 12, Praha 2"
                    className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm placeholder:text-muted/50 outline-none transition-all focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted">Typ nemovitosti</label>
                <select className="w-full rounded-xl border border-border bg-background py-3 px-3.5 text-sm text-foreground outline-none transition-all focus:border-accent/60 focus:ring-2 focus:ring-accent/10">
                  <option value="">Vyberte typ…</option>
                  <option value="byt">Byt</option>
                  <option value="dum">Rodinný dům</option>
                  <option value="pozemek">Pozemek</option>
                  <option value="komerc">Komerční nemovitost</option>
                </select>
              </div>
              <button className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-light">
                Odhadnout cenu
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-muted/60">
              Orientační odhad na základě dat z katastrálních zápisů
            </p>
            <div className="mt-4 space-y-1.5">
              {[
                "Bez závazku · Zdarma",
                "Výsledek do 30 sekund",
                "Srovnání s okolím",
              ].map((b) => (
                <div key={b} className="flex items-center gap-2 text-xs text-muted">
                  <span className="text-green">✓</span>
                  {b}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── B) Process steps ──────────────────────────────────── */}
      <section>
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold">Jak to funguje</h2>
          <p className="mt-1.5 text-sm text-muted">Tři kroky k úspěšnému prodeji</p>
        </div>
        <div className="relative grid gap-6 lg:grid-cols-3">
          {/* Connecting line (desktop) */}
          <div className="pointer-events-none absolute top-8 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] hidden h-px bg-border/60 lg:block" />

          {[
            {
              n: "1",
              title: "Zjistěte hodnotu",
              desc: "Získejte orientační odhad ceny vaší nemovitosti na základě tržních dat z vašeho okolí.",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              ),
            },
            {
              n: "2",
              title: "Vyberte způsob prodeje",
              desc: "Porovnejte možnosti: s makléřem, rychlý odkup nebo sami. Každá varianta má jiné výhody.",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              ),
            },
            {
              n: "3",
              title: "Prodejte s jistotou",
              desc: "Náš tým vás provede celým procesem až po předání klíčů kupci.",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ),
            },
          ].map((step) => (
            <div key={step.n} className="flex flex-col items-center text-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card text-muted shadow-lg">
                {step.icon}
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                  {step.n}
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── C) Selling options ────────────────────────────────── */}
      <section id="moznosti" className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">Vyberte způsob prodeje</h2>
          <p className="mt-1 text-sm text-muted">Každá cesta má jiné výhody – vyberte tu správnou pro vás.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {SELLING_OPTIONS.map((opt) => (
            <div
              key={opt.label}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-accent/30 hover:shadow-xl hover:shadow-black/30"
            >
              {/* Thick colored top border */}
              <div className="h-1.5" style={{ background: opt.tagColor }} />

              <div className="flex flex-1 flex-col gap-4 p-6">
                {/* Icon + tag row */}
                <div className="flex items-start justify-between">
                  <div className="rounded-xl border border-border bg-background p-3 text-muted">
                    {opt.icon}
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-bold"
                    style={{ color: opt.tagColor, background: opt.tagColor + "18" }}
                  >
                    {opt.tag}
                  </span>
                </div>

                {/* Label + headline */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">{opt.label}</p>
                  <h3 className="text-base font-bold text-foreground leading-snug">{opt.headline}</h3>
                </div>

                {/* Bullets */}
                <ul className="flex-1 space-y-1.5">
                  {opt.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted">
                      <span className="mt-0.5 shrink-0 text-green">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>

                {/* Price note */}
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted">
                  <span className="font-semibold text-foreground">Náklady: </span>
                  {opt.priceNote}
                </div>

                {/* CTA */}
                <a
                  href={opt.href}
                  className="block rounded-xl border border-border py-2.5 text-center text-sm font-semibold text-foreground transition-all hover:border-accent/40 hover:text-accent-light hover:bg-accent/5"
                >
                  {opt.cta}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── D) Agent marketplace ──────────────────────────────── */}
      <section id="makler" className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Header */}
        <div
          className="relative overflow-hidden border-b border-border px-6 py-7"
          style={{ background: "linear-gradient(135deg, #13151f 0%, #1a1d2e 60%, #161828 100%)" }}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/8 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
            <div className="flex-1">
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent-light">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-light" />
                Najděte správného makléře
              </div>
              <h3 className="mt-2 text-2xl font-bold leading-tight">
                Makléři ověření daty<br />a hodnoceními klientů
              </h3>
              <p className="mt-2 text-sm text-muted">
                Porovnejte zkušenosti, specializaci a reálné výsledky. Bez závazků.
              </p>
            </div>
            {/* Address widget */}
            <div className="shrink-0 lg:w-72">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Adresa nemovitosti
                </label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="např. Mánesova 12, Praha 2"
                    className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm placeholder:text-muted/50 outline-none transition-all focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
                  />
                </div>
                <button className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-light">
                  Najít makléře v mé lokalitě
                </button>
                <p className="text-center text-[11px] text-muted/60">Bez závazku · Zdarma · Do 24 hodin</p>
              </div>
            </div>
          </div>
        </div>

        {/* Agent cards label */}
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Zkušení místní makléři · ukázka nabídek
          </p>
          <button className="text-xs text-accent-light hover:underline transition-colors">Zobrazit vše →</button>
        </div>

        {/* Scrollable agent cards */}
        <div className="flex overflow-x-auto">
          {AGENTS.map((a) => (
            <div
              key={a.name}
              className="group flex w-56 shrink-0 cursor-pointer flex-col border-r border-border/50 transition-colors hover:bg-card-hover last:border-r-0"
            >
              <div className="h-1 w-full" style={{ background: a.color }} />
              <div className="flex flex-col gap-3 p-5">
                {/* Avatar + name */}
                <div className="flex flex-col items-center gap-2 text-center">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full text-base font-bold text-white shadow-lg ring-2 ring-border"
                    style={{ background: `linear-gradient(135deg, ${a.color}dd, ${a.color}77)` }}
                  >
                    {a.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground group-hover:text-accent-light transition-colors leading-tight">
                      {a.name}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5 leading-tight">{a.agency}</div>
                  </div>
                </div>

                {/* Rating */}
                <div className="flex flex-col items-center gap-0.5">
                  <StarRating rating={a.rating} />
                  <span className="text-[11px] text-muted">{a.rating} · {a.reviews} hodnocení</span>
                </div>

                <div className="h-px bg-border/60" />

                {/* Stats */}
                <div className="flex justify-around text-center">
                  <div>
                    <div className="text-xl font-bold text-foreground">{a.txCount}</div>
                    <div className="text-[10px] text-muted leading-tight">Prodejů<br />za rok</div>
                  </div>
                  <div className="w-px bg-border/60" />
                  <div>
                    <div className="text-xl font-bold text-foreground">{a.years}</div>
                    <div className="text-[10px] text-muted leading-tight">Let<br />praxe</div>
                  </div>
                </div>

                {/* Spec */}
                <div className="rounded-lg bg-background border border-border px-2.5 py-1.5 text-center text-[11px] text-muted">
                  {a.spec}
                </div>

                <button className="w-full rounded-lg border border-border py-1.5 text-[11px] font-medium text-muted transition-all group-hover:border-accent/40 group-hover:text-accent-light group-hover:bg-accent/5">
                  Zobrazit profil
                </button>
              </div>
            </div>
          ))}

          {/* More agents placeholder */}
          <div className="flex w-44 shrink-0 flex-col items-center justify-center gap-3 p-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border text-muted">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <div className="text-xs text-muted leading-snug">Zobrazit<br />další makléře</div>
            <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/30 hover:text-accent-light">
              Zobrazit →
            </button>
          </div>
        </div>

        <div className="border-t border-border/50 bg-background/40 px-6 py-3">
          <p className="text-[11px] text-muted/60">
            Makléři jsou řazeni podle počtu úspěšných transakcí a hodnocení klientů ve vybrané lokalitě.
          </p>
        </div>
      </section>

      {/* ── E) Testimonials ───────────────────────────────────── */}
      <section>
        <h2 className="mb-5 text-2xl font-bold">Co říkají prodávající</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
            >
              {/* Quote icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent/40 shrink-0">
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
              </svg>

              <p className="flex-1 text-sm text-muted leading-relaxed">&ldquo;{t.quote}&rdquo;</p>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
                <div>
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted">{t.location}</div>
                </div>
                <span
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-muted whitespace-nowrap"
                >
                  {t.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── F) Market data teaser ─────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:gap-10">
          {/* Left */}
          <div className="flex-1">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent-light/70">
              Sledujte hodnotu vaší nemovitosti
            </p>
            <h3 className="text-xl font-bold">Kolik stojí nemovitosti ve vaší lokalitě?</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Naše data pocházejí z katastrálních zápisů a jsou aktualizována čtvrtletně.
              Porovnejte prodejní a nabídkové ceny v každém okresu a obci ČR.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/prodeje"
                className="rounded-xl bg-accent/10 px-4 py-2 text-sm font-semibold text-accent-light transition-all hover:bg-accent/20"
              >
                Cenová mapa ČR →
              </Link>
              <Link
                href="/mapa"
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-all hover:border-accent/30 hover:text-accent-light"
              >
                Interaktivní mapa →
              </Link>
            </div>
          </div>

          {/* Right: stat boxes */}
          <div className="grid grid-cols-2 gap-3 md:w-72 md:shrink-0">
            {[
              { label: "Průměr Praha",           value: "148 000 Kč/m²", sub: "byty · prodej" },
              { label: "Průměr ČR",               value: "78 000 Kč/m²",  sub: "byty · prodej" },
              { label: "YoY Praha",               value: "+4.2 %",         sub: "meziročně" },
              { label: "Spread nabídka/prodej",   value: "+12.8 %",        sub: "Praha" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-background p-3">
                <div className="text-lg font-bold text-accent-light">{s.value}</div>
                <div className="text-xs text-muted mt-0.5">{s.label}</div>
                <div className="text-[10px] text-muted/60">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── G) Seller guides ──────────────────────────────────── */}
      <section>
        <h2 className="mb-5 text-2xl font-bold">Průvodce prodávajícího</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GUIDES.map((g) => (
            <div
              key={g.title}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/30 hover:shadow-lg hover:shadow-black/20 cursor-pointer"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted">
                {g.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-accent-light transition-colors leading-snug mb-1.5">
                  {g.title}
                </h3>
                <p className="text-xs text-muted leading-relaxed">{g.desc}</p>
              </div>
              <p className="mt-auto text-xs font-semibold text-accent-light group-hover:underline">
                Číst →
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── H) FAQ ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-5 text-2xl font-bold">Časté otázky</h2>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group overflow-hidden rounded-xl border border-border bg-card"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-sm font-semibold text-foreground hover:text-accent-light transition-colors">
                {item.q}
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  className="shrink-0 transition-transform group-open:rotate-180"
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </summary>
              <div className="border-t border-border/50 px-6 py-4 text-sm text-muted leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

    </div>
  );
}
