"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// Curated list — popular places with human/colloquial names.
// These always show first when they match, before Nominatim API results.
const CURATED: { label: string; sublabel: string; icon: string; type: string }[] = [
  // ── Major cities ──────────────────────────────────────────
  { label: "Praha",              sublabel: "Hlavní město · 14 000+ inzerátů",    icon: "🏙️", type: "Město" },
  { label: "Brno",               sublabel: "Jihomoravský kraj · 2 400+ inzerátů",icon: "🏛️", type: "Město" },
  { label: "Ostrava",            sublabel: "Moravskoslezský kraj",               icon: "🏭", type: "Město" },
  { label: "Plzeň",              sublabel: "Plzeňský kraj",                      icon: "🍺", type: "Město" },
  { label: "Liberec",            sublabel: "Liberecký kraj",                     icon: "⛰️", type: "Město" },
  { label: "Olomouc",            sublabel: "Olomoucký kraj",                     icon: "🏰", type: "Město" },
  { label: "Hradec Králové",     sublabel: "Královéhradecký kraj",               icon: "👑", type: "Město" },
  { label: "Zlín",               sublabel: "Zlínský kraj",                       icon: "🏔️", type: "Město" },
  { label: "České Budějovice",   sublabel: "Jihočeský kraj",                     icon: "🌲", type: "Město" },
  { label: "Pardubice",          sublabel: "Pardubický kraj",                    icon: "🐎", type: "Město" },
  { label: "Ústí nad Labem",     sublabel: "Ústecký kraj",                       icon: "🏗️", type: "Město" },
  { label: "Kladno",             sublabel: "Středočeský kraj",                   icon: "🔧", type: "Město" },
  { label: "Most",               sublabel: "Ústecký kraj",                       icon: "🌁", type: "Město" },
  { label: "Jihlava",            sublabel: "Kraj Vysočina",                      icon: "🦌", type: "Město" },
  { label: "Mladá Boleslav",     sublabel: "Středočeský kraj",                   icon: "🚗", type: "Město" },
  { label: "Prostějov",          sublabel: "Olomoucký kraj",                     icon: "🌻", type: "Město" },
  { label: "Přerov",             sublabel: "Olomoucký kraj",                     icon: "🌊", type: "Město" },
  { label: "Havířov",            sublabel: "Moravskoslezský kraj",               icon: "⛏️", type: "Město" },
  { label: "Opava",              sublabel: "Moravskoslezský kraj",               icon: "🏰", type: "Město" },
  { label: "Frýdek-Místek",      sublabel: "Moravskoslezský kraj",               icon: "🏔️", type: "Město" },
  { label: "Karviná",            sublabel: "Moravskoslezský kraj",               icon: "⛏️", type: "Město" },
  { label: "Chomutov",           sublabel: "Ústecký kraj",                       icon: "🏭", type: "Město" },
  { label: "Teplice",            sublabel: "Ústecký kraj",                       icon: "♨️",  type: "Město" },
  { label: "Děčín",              sublabel: "Ústecký kraj",                       icon: "🏞️", type: "Město" },
  { label: "Karlovy Vary",       sublabel: "Karlovarský kraj",                   icon: "♨️",  type: "Město" },

  // ── Praha districts (numbered) ────────────────────────────
  { label: "Praha 1",            sublabel: "Staré Město, Josefov, Malá Strana",  icon: "📍", type: "Část Prahy" },
  { label: "Praha 2",            sublabel: "Nové Město, Vinohrady, Nusle",       icon: "📍", type: "Část Prahy" },
  { label: "Praha 3",            sublabel: "Žižkov, Vinohrady",                  icon: "📍", type: "Část Prahy" },
  { label: "Praha 4",            sublabel: "Nusle, Michle, Krč, Chodov",         icon: "📍", type: "Část Prahy" },
  { label: "Praha 5",            sublabel: "Smíchov, Košíře, Motol",             icon: "📍", type: "Část Prahy" },
  { label: "Praha 6",            sublabel: "Dejvice, Bubeneč, Řepy",             icon: "📍", type: "Část Prahy" },
  { label: "Praha 7",            sublabel: "Holešovice, Letná, Troja",           icon: "📍", type: "Část Prahy" },
  { label: "Praha 8",            sublabel: "Karlín, Libeň, Kobylisy",            icon: "📍", type: "Část Prahy" },
  { label: "Praha 9",            sublabel: "Vysočany, Prosek, Letňany",          icon: "📍", type: "Část Prahy" },
  { label: "Praha 10",           sublabel: "Vršovice, Strašnice, Záběhlice",     icon: "📍", type: "Část Prahy" },
  { label: "Praha 11",           sublabel: "Chodov, Háje, Opatov",               icon: "📍", type: "Část Prahy" },
  { label: "Praha 12",           sublabel: "Modřany, Kamýk",                     icon: "📍", type: "Část Prahy" },
  { label: "Praha 13",           sublabel: "Stodůlky, Nové Butovice",            icon: "📍", type: "Část Prahy" },

  // ── Praha — colloquial neighbourhood names ─────────────────
  { label: "Vinohrady",          sublabel: "Praha 2/3 · nejžádanější čtvrť",     icon: "🍇", type: "Čtvrť" },
  { label: "Žižkov",             sublabel: "Praha 3 · bohémská čtvrť",           icon: "⚡", type: "Čtvrť" },
  { label: "Smíchov",            sublabel: "Praha 5 · moderní centrum",          icon: "🌉", type: "Čtvrť" },
  { label: "Dejvice",            sublabel: "Praha 6 · klidná vilová čtvrť",      icon: "🌳", type: "Čtvrť" },
  { label: "Holešovice",         sublabel: "Praha 7 · kreativní čtvrť",          icon: "🎨", type: "Čtvrť" },
  { label: "Karlín",             sublabel: "Praha 8 · rychle rostoucí čtvrť",    icon: "✨", type: "Čtvrť" },
  { label: "Letná",              sublabel: "Praha 7 · park a nábřeží",           icon: "🌿", type: "Čtvrť" },
  { label: "Nusle",              sublabel: "Praha 4 · centrum Prahy 4",          icon: "🏘️", type: "Čtvrť" },
  { label: "Vršovice",           sublabel: "Praha 10 · rodinná čtvrť",           icon: "🏡", type: "Čtvrť" },
  { label: "Nové Město",         sublabel: "Praha 1 · historické centrum",       icon: "🏛️", type: "Čtvrť" },
  { label: "Staré Město",        sublabel: "Praha 1 · turistické centrum",       icon: "⛪", type: "Čtvrť" },
  { label: "Malá Strana",        sublabel: "Praha 1 · pod Hradem",               icon: "🏰", type: "Čtvrť" },
  { label: "Josefov",            sublabel: "Praha 1 · židovské město",           icon: "✡️",  type: "Čtvrť" },
  { label: "Bubeneč",            sublabel: "Praha 6 · prestižní vilová čtvrť",   icon: "🌲", type: "Čtvrť" },
  { label: "Střešovice",         sublabel: "Praha 6 · tiché rodinné domy",       icon: "🏡", type: "Čtvrť" },
  { label: "Břevnov",            sublabel: "Praha 6 · klášterní čtvrť",          icon: "⛪", type: "Čtvrť" },
  { label: "Veleslavín",         sublabel: "Praha 6 · klidná obytná čtvrť",      icon: "🌳", type: "Čtvrť" },
  { label: "Ruzyně",             sublabel: "Praha 6 · u letiště",                icon: "✈️",  type: "Čtvrť" },
  { label: "Řepy",               sublabel: "Praha 17 · panelová zástavba",       icon: "🏗️", type: "Čtvrť" },
  { label: "Stodůlky",           sublabel: "Praha 13 · moderní zástavba",        icon: "🏢", type: "Čtvrť" },
  { label: "Zličín",             sublabel: "Praha 17 · u Westfieldu",            icon: "🛍️", type: "Čtvrť" },
  { label: "Barrandov",          sublabel: "Praha 5 · nad Vltavou",              icon: "🎬", type: "Čtvrť" },
  { label: "Motol",              sublabel: "Praha 5 · u nemocnice",              icon: "🏥", type: "Čtvrť" },
  { label: "Košíře",             sublabel: "Praha 5 · klidné kopce",             icon: "⛰️", type: "Čtvrť" },
  { label: "Pankrác",            sublabel: "Praha 4 · kancelářská čtvrť",        icon: "🏢", type: "Čtvrť" },
  { label: "Krč",                sublabel: "Praha 4 · u nemocnice",              icon: "🌲", type: "Čtvrť" },
  { label: "Michle",             sublabel: "Praha 4 · dostupné bydlení",         icon: "🏘️", type: "Čtvrť" },
  { label: "Chodov",             sublabel: "Praha 11 · OC Chodov",               icon: "🛍️", type: "Čtvrť" },
  { label: "Háje",               sublabel: "Praha 11 · konec metra C",           icon: "🚇", type: "Čtvrť" },
  { label: "Prosek",             sublabel: "Praha 9 · rodinné domy",             icon: "🌿", type: "Čtvrť" },
  { label: "Vysočany",           sublabel: "Praha 9 · průmyslová revitalizace",  icon: "🏭", type: "Čtvrť" },
  { label: "Kobylisy",           sublabel: "Praha 8 · rodinné čtvrti",           icon: "🌳", type: "Čtvrť" },
  { label: "Libeň",              sublabel: "Praha 8 · u Palmovky",               icon: "🏘️", type: "Čtvrť" },
  { label: "Troja",              sublabel: "Praha 7 · ZOO a vinice",             icon: "🦁", type: "Čtvrť" },
  { label: "Záběhlice",          sublabel: "Praha 10 · klidné sídliště",         icon: "🌿", type: "Čtvrť" },
  { label: "Strašnice",          sublabel: "Praha 10 · rodinné domy",            icon: "🏡", type: "Čtvrť" },
  { label: "Podolí",             sublabel: "Praha 4 · nábřeží Vltavy",           icon: "🌊", type: "Čtvrť" },
  { label: "Braník",             sublabel: "Praha 4 · nad Vltavou",              icon: "🍺", type: "Čtvrť" },
  { label: "Modřany",            sublabel: "Praha 12 · jižní Praha",             icon: "🏘️", type: "Čtvrť" },
  { label: "Kamýk",              sublabel: "Praha 12 · klidné sídliště",         icon: "🌳", type: "Čtvrť" },
  { label: "Letňany",            sublabel: "Praha 9 · u výstaviště",             icon: "✈️",  type: "Čtvrť" },
  { label: "Ďáblice",            sublabel: "Praha 8 · severní Praha",            icon: "🌳", type: "Čtvrť" },
  { label: "Čakovice",           sublabel: "Praha 9 · severovýchod",             icon: "🌾", type: "Čtvrť" },
  { label: "Horní Měcholupy",    sublabel: "Praha 10 · východní Praha",          icon: "🌿", type: "Čtvrť" },
  { label: "Nové Butovice",      sublabel: "Praha 13 · kancelářská zóna",        icon: "🏢", type: "Čtvrť" },
  { label: "Řeporyje",           sublabel: "Praha 16",                           icon: "🌾", type: "Čtvrť" },
  { label: "Suchdol",            sublabel: "Praha 6 · ČVUT kampus",              icon: "🎓", type: "Čtvrť" },

  // ── Brno neighbourhoods ────────────────────────────────────
  { label: "Žabovřesky",         sublabel: "Brno · vilová čtvrť",                icon: "🌳", type: "Čtvrť" },
  { label: "Královo Pole",       sublabel: "Brno · technologická čtvrť",         icon: "🔬", type: "Čtvrť" },
  { label: "Bystrc",             sublabel: "Brno · u přehrady",                  icon: "🌊", type: "Čtvrť" },
  { label: "Líšeň",              sublabel: "Brno · panelová zástavba",           icon: "🏗️", type: "Čtvrť" },
  { label: "Bohunice",           sublabel: "Brno · u fakultní nemocnice",        icon: "🏥", type: "Čtvrť" },
  { label: "Starý Lískovec",     sublabel: "Brno · jižní Brno",                  icon: "🌿", type: "Čtvrť" },
  { label: "Komín",              sublabel: "Brno · klidná čtvrť",               icon: "🏡", type: "Čtvrť" },
  { label: "Medlánky",           sublabel: "Brno · severozápad",                 icon: "🌾", type: "Čtvrť" },
  { label: "Řečkovice",          sublabel: "Brno · rodinné domy",               icon: "🌳", type: "Čtvrť" },
  { label: "Kohoutovice",        sublabel: "Brno · sídliště",                    icon: "🏘️", type: "Čtvrť" },
  { label: "Vinohrady",          sublabel: "Brno · jihozápad",                   icon: "🍇", type: "Čtvrť" },
  { label: "Lesná",              sublabel: "Brno · sídliště",                    icon: "🌲", type: "Čtvrť" },

  // ── Okolí Prahy ────────────────────────────────────────────
  { label: "Roztoky",            sublabel: "Praha-západ · příměstská obec",      icon: "🌲", type: "Obec" },
  { label: "Černošice",          sublabel: "Praha-západ · u Berounky",           icon: "🌊", type: "Obec" },
  { label: "Průhonice",          sublabel: "Praha-východ · u dálnice D1",        icon: "🌿", type: "Obec" },
  { label: "Říčany",             sublabel: "Praha-východ",                       icon: "🏘️", type: "Obec" },
  { label: "Brandýs nad Labem",  sublabel: "Praha-východ",                       icon: "🏰", type: "Obec" },
  { label: "Mělník",             sublabel: "Středočeský kraj",                   icon: "🍷", type: "Město" },
  { label: "Beroun",             sublabel: "Středočeský kraj",                   icon: "🏞️", type: "Město" },
  { label: "Příbram",            sublabel: "Středočeský kraj",                   icon: "⛏️", type: "Město" },
  { label: "Kolín",              sublabel: "Středočeský kraj",                   icon: "🏭", type: "Město" },
  { label: "Kutná Hora",         sublabel: "Středočeský kraj",                   icon: "⛪", type: "Město" },

  // ── Kraje ──────────────────────────────────────────────────
  { label: "Středočeský kraj",   sublabel: "Okolí Prahy · největší kraj ČR",     icon: "🌾", type: "Kraj" },
  { label: "Jihomoravský kraj",  sublabel: "Brno a okolí",                       icon: "🍷", type: "Kraj" },
  { label: "Moravskoslezský kraj",sublabel: "Ostrava a okolí",                   icon: "⛏️", type: "Kraj" },
  { label: "Ústecký kraj",       sublabel: "Ústí n. L., Most, Chomutov",         icon: "🏭", type: "Kraj" },
  { label: "Jihočeský kraj",     sublabel: "České Budějovice a okolí",           icon: "🌲", type: "Kraj" },
  { label: "Plzeňský kraj",      sublabel: "Plzeň a okolí",                      icon: "🍺", type: "Kraj" },
  { label: "Liberecký kraj",     sublabel: "Liberec, Jablonec, Mladá Boleslav",  icon: "⛰️", type: "Kraj" },
  { label: "Královéhradecký kraj",sublabel: "Hradec Králové, Trutnov",           icon: "👑", type: "Kraj" },
  { label: "Pardubický kraj",    sublabel: "Pardubice, Chrudim",                 icon: "🐎", type: "Kraj" },
  { label: "Vysočina",           sublabel: "Jihlava, Třebíč",                    icon: "🦌", type: "Kraj" },
  { label: "Olomoucký kraj",     sublabel: "Olomouc, Přerov, Prostějov",         icon: "🏰", type: "Kraj" },
  { label: "Zlínský kraj",       sublabel: "Zlín, Uherské Hradiště",             icon: "🏔️", type: "Kraj" },
  { label: "Karlovarský kraj",   sublabel: "Karlovy Vary, Cheb",                 icon: "♨️",  type: "Kraj" },
];

function TabIconHome() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function TabIconHouseTree() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>;
}
function TabIconKey() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3"/></svg>;
}
function TabIconPlot() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>;
}

const CATEGORY_TABS = [
  { label: "Prodej bytů",    value: "byty-prodej",    Icon: TabIconHome },
  { label: "Prodej domů",    value: "domy-prodej",    Icon: TabIconHouseTree },
  { label: "Pronájem bytů",  value: "byty-najem",     Icon: TabIconKey },
  { label: "Pronájem domů",  value: "domy-najem",     Icon: TabIconHouseTree },
  { label: "Pozemky",        value: "pozemky-prodej", Icon: TabIconPlot },
];

function getHeadline(category?: string): { main: string; highlight: string; sub: string } {
  switch (category) {
    case "byty-prodej":    return { main: "Najděte", highlight: "byt k prodeji", sub: "Byty, apartmány a mezonety napříč celou ČR" };
    case "domy-prodej":    return { main: "Najděte", highlight: "dům snů",       sub: "Rodinné domy, vily a chalupy v celé ČR" };
    case "byty-najem":     return { main: "Najděte", highlight: "pronájem bytu", sub: "Krátkodobý i dlouhodobý pronájem v celé ČR" };
    case "domy-najem":     return { main: "Najděte", highlight: "dům k pronájmu",sub: "Rodinné domy a chalupy k pronájmu" };
    case "pozemky-prodej": return { main: "Najděte", highlight: "pozemek",       sub: "Stavební, zemědělské a komerční pozemky" };
    default:               return { main: "Najděte svůj",highlight: "nový domov",sub: "Přes 100 000 inzerátů z celé ČR" };
  }
}

interface Props {
  activeCategory?: string;
  activeLocation?: string;
}

interface Suggestion {
  label: string;
  sublabel: string;
  icon: string;
  type: string;
}

// Top 8 shown when input is empty
const DEFAULT_SUGGESTIONS: Suggestion[] = [
  CURATED[0], CURATED[1], CURATED[2], CURATED[3],
  CURATED.find(c => c.label === "Vinohrady")!,
  CURATED.find(c => c.label === "Karlín")!,
  CURATED.find(c => c.label === "Letná")!,
  CURATED.find(c => c.label === "Holešovice")!,
];

function filterCurated(q: string): Suggestion[] {
  const lower = q.toLowerCase();
  return CURATED.filter(
    (s) =>
      s.label.toLowerCase().includes(lower) ||
      s.sublabel.toLowerCase().includes(lower)
  ).slice(0, 5);
}

export default function SearchHero({ activeCategory, activeLocation }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState(activeLocation || "");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [apiResults, setApiResults] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Merge curated + API results (curated first, no duplicates)
  const suggestions: Suggestion[] = (() => {
    if (query.length < 2) return DEFAULT_SUGGESTIONS;
    const curated = filterCurated(query);
    const curatedLabels = new Set(curated.map((s) => s.label.toLowerCase()));
    const apiDeduped = (apiResults ?? []).filter(
      (s) => !curatedLabels.has(s.label.toLowerCase())
    );
    return [...curated, ...apiDeduped].slice(0, 8);
  })();

  // Debounced API call (only when query >= 2)
  useEffect(() => {
    if (query.length < 2) {
      setApiResults(null);
      setLoading(false);
      return;
    }
    // Show curated instantly, load API in background
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(query)}`)
        .then((r) => r.ok ? r.json() : [])
        .then((data: Suggestion[]) => { setApiResults(data); setLoading(false); })
        .catch(() => { setApiResults([]); setLoading(false); });
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset activeIdx when suggestions change
  useEffect(() => { setActiveIdx(-1); }, [query]);

  const pick = useCallback((label: string) => {
    setQuery(label);
    setOpen(false);
    setActiveIdx(-1);
    setApiResults(null);
    const params = new URLSearchParams();
    if (activeCategory) params.set("category", activeCategory);
    params.set("location", label);
    params.set("sort", "newest");
    router.push(`/inzerce?${params.toString()}`);
  }, [activeCategory, router]);

  function submit(loc?: string) {
    const location = loc ?? query.trim();
    const params = new URLSearchParams();
    if (activeCategory) params.set("category", activeCategory);
    if (location) params.set("location", location);
    params.set("sort", "newest");
    router.push(`/inzerce?${params.toString()}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        pick(suggestions[activeIdx].label);
      } else {
        setOpen(false);
        submit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    submit();
  }

  const headline = getHeadline(activeCategory);
  const showDropdown = open && (loading || suggestions.length > 0);

  return (
    <div
      className="relative rounded-2xl border border-border bg-gradient-to-br from-card via-card to-accent/5 px-6 py-14 md:px-12 md:py-20"
    >
      {/* Decorative blobs — clipped via mask so they don't escape rounded corner */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ overflow: "hidden" }}
        aria-hidden
      >
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-purple-600/6 blur-2xl" />
        <div className="absolute top-1/2 -left-20 h-48 w-48 rounded-full bg-accent/4 blur-2xl" />
      </div>

      {/* Content */}
      <div className="relative max-w-3xl mx-auto">

        {/* Headline */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold tracking-tight leading-tight md:text-6xl">
            {headline.main}{" "}
            <span className="bg-gradient-to-r from-accent-light via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {headline.highlight}
            </span>
          </h1>
          <p className="mt-3 text-base text-muted md:text-lg">{headline.sub}</p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {CATEGORY_TABS.map((tab) => {
            const active = activeCategory === tab.value;
            return (
              <a
                key={tab.value}
                href={`/inzerce?category=${tab.value}&sort=newest`}
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${
                  active
                    ? "border-accent/50 bg-accent/15 text-accent-light shadow-sm shadow-accent/10"
                    : "border-border bg-card/60 text-muted hover:border-accent/30 hover:text-foreground hover:bg-card/80"
                }`}
              >
                <tab.Icon />
                {tab.label}
              </a>
            );
          })}
        </div>

        {/* Search + autocomplete — wrapper is NOT overflow-hidden so dropdown escapes */}
        <div ref={wrapperRef} className="relative">
          <form onSubmit={handleSubmit} className="flex gap-0 rounded-2xl border border-border bg-background shadow-2xl shadow-black/40 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/10 transition-all">
            {/* Location icon */}
            <div className="flex items-center pl-5 shrink-0 pointer-events-none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(-1); }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Město, část Prahy, PSČ…"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 bg-transparent py-5 pl-3 pr-4 text-base text-foreground placeholder:text-muted/40 outline-none"
            />

            {/* Clear button */}
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setOpen(true); inputRef.current?.focus(); }}
                className="flex items-center pr-3 text-muted hover:text-foreground transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}

            {/* Divider */}
            <div className="self-stretch w-px bg-border/60 my-3 shrink-0" />

            {/* Submit */}
            <button
              type="submit"
              className="shrink-0 m-1.5 rounded-xl bg-accent px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-light active:scale-95"
            >
              Hledat
            </button>
          </form>

          {/* Dropdown — outside form, full z-index overlay */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-full z-[200] mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/60"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  {query.length === 0
                    ? "Populární lokality"
                    : loading
                    ? "Hledám…"
                    : suggestions.length > 0
                    ? `${suggestions.length} míst nalezeno`
                    : "Žádné výsledky"}
                </span>
                <span className="text-[10px] text-muted/50 hidden sm:block">↑↓ pro výběr · Enter pro potvrzení</span>
              </div>

              {/* Loading indicator (subtle, only when no curated results yet) */}
              {loading && suggestions.length === 0 && (
                <div className="space-y-0">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex items-center gap-3 px-4 py-3">
                      <div className="h-9 w-9 rounded-xl bg-card-hover animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-32 rounded bg-card-hover animate-pulse" />
                        <div className="h-2.5 w-48 rounded bg-card-hover animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Results */}
              {suggestions.map((s, i) => (
                <button
                  key={`${s.label}-${i}`}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pick(s.label); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                    i === activeIdx ? "bg-accent/10" : "hover:bg-card-hover"
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold leading-tight ${i === activeIdx ? "text-accent-light" : "text-foreground"}`}>
                      {query.length > 0 ? highlightMatch(s.label, query) : s.label}
                    </div>
                    {s.sublabel && (
                      <div className="text-xs text-muted truncate mt-0.5">{s.sublabel}</div>
                    )}
                  </div>

                  <span className="shrink-0 rounded-md bg-card-hover px-2 py-0.5 text-[10px] font-medium text-muted/70">
                    {s.type}
                  </span>

                  <svg className={`ml-1 shrink-0 transition-colors ${i === activeIdx ? "text-accent-light" : "text-border"}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}

              {/* No results */}
              {!loading && apiResults !== null && query.length >= 2 && suggestions.length === 0 && (
                <div className="px-4 py-5 text-center text-sm text-muted">
                  Žádné místo nenalezeno — zkuste jiný název
                </div>
              )}

              {/* Footer: search as typed */}
              {query.length > 0 && (
                <div className="border-t border-border/60 px-4 py-2.5">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setOpen(false); submit(); }}
                    className="flex items-center gap-2 text-xs text-muted hover:text-accent-light transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    Hledat <span className="font-semibold text-foreground">&bdquo;{query}&ldquo;</span> ve všech inzerátech
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trust bar */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
            Aktualizováno živě
          </span>
          <span className="text-border">·</span>
          <span>Bez registrace zdarma</span>
          <span className="text-border">·</span>
          <span>Sledujeme propady cen v reálném čase</span>
          <span className="text-border hidden md:block">·</span>
          <span className="hidden md:block">Data z Sreality.cz + katastr</span>
        </div>
      </div>
    </div>
  );
}

// Highlight matching substring in bold
function highlightMatch(text: string, query: string): React.ReactNode {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/20 text-accent-light rounded px-0.5 font-bold not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
