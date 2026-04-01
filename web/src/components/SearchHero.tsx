"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
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

// Group tabs (top level)
const GROUP_TABS = [
  { label: "Nákup",    value: "nakup",    cats: ["byty-prodej", "domy-prodej"] },
  { label: "Pronájem", value: "pronajem", cats: ["byty-najem",  "domy-najem"]  },
  { label: "Pozemky",  value: "pozemky",  cats: ["pozemky-prodej"]             },
];

// Sub-tabs per group
const SUB_TABS: Record<string, { label: string; value: string }[]> = {
  nakup:    [{ label: "Byty", value: "byty-prodej" }, { label: "Domy", value: "domy-prodej" }],
  pronajem: [{ label: "Byty", value: "byty-najem"  }, { label: "Domy", value: "domy-najem"  }],
};

function getHeadline(category?: string): { main: string; highlight: string; sub: string } {
  switch (category) {
    case "byty-prodej":    return { main: "Najděte", highlight: "byt k prodeji", sub: "Byty, apartmány a mezonety napříč celou ČR" };
    case "domy-prodej":    return { main: "Najděte", highlight: "dům snů",       sub: "Rodinné domy, vily a chalupy v celé ČR" };
    case "byty-najem":     return { main: "Najděte", highlight: "pronájem bytu", sub: "Krátkodobý i dlouhodobý pronájem v celé ČR" };
    case "domy-najem":     return { main: "Najděte", highlight: "dům k pronájmu",sub: "Rodinné domy a chalupy k pronájmu" };
    case "pozemky-prodej": return { main: "Najděte", highlight: "pozemek",       sub: "Stavební, zemědělské a komerční pozemky" };
    default:               return { main: "Najděte svůj",highlight: "nový domov",sub: "Agregujeme data ze Sreality a Bezrealitky. Přes 100 000 inzerátů z celé ČR." };
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

function fmtPriceShort(val: string): string {
  const n = Number(val);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} tis.`;
  return `${n} Kč`;
}

function getPricePresets(category?: string): { label: string; min: string; max: string }[] {
  if (category?.includes("najem")) {
    return [
      { label: "do 10 tis.", min: "", max: "10000" },
      { label: "do 15 tis.", min: "", max: "15000" },
      { label: "do 20 tis.", min: "", max: "20000" },
      { label: "do 30 tis.", min: "", max: "30000" },
      { label: "30–50 tis.", min: "30000", max: "50000" },
      { label: "50 tis.+", min: "50000", max: "" },
    ];
  }
  return [
    { label: "do 2 M", min: "", max: "2000000" },
    { label: "do 5 M", min: "", max: "5000000" },
    { label: "do 10 M", min: "", max: "10000000" },
    { label: "5–10 M", min: "5000000", max: "10000000" },
    { label: "10–20 M", min: "10000000", max: "20000000" },
    { label: "20 M+", min: "20000000", max: "" },
  ];
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

  // Filter state
  const [selectedLayouts, setSelectedLayouts] = useState<string[]>([]);
  const [selectedPrice, setSelectedPrice] = useState<{ min: string; max: string }>({ min: "", max: "" });
  const [selectedArea, setSelectedArea] = useState<{ min: string; max: string }>({ min: "", max: "" });
  const [priceDropOpen, setPriceDropOpen] = useState(false);
  const [areaDropOpen, setAreaDropOpen] = useState(false);
  const priceRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  // Derive active group and sub-categories from activeCategory
  const activeCats = activeCategory ? activeCategory.split(",").filter(Boolean) : [];
  const activeGroup = GROUP_TABS.find(g => g.cats.some(c => activeCats.includes(c)))?.value ?? "";
  const subTabs = activeGroup ? SUB_TABS[activeGroup] : null;

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
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
      if (priceRef.current && !priceRef.current.contains(e.target as Node)) {
        setPriceDropOpen(false);
      }
      if (areaRef.current && !areaRef.current.contains(e.target as Node)) {
        setAreaDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset activeIdx when suggestions change
  useEffect(() => { setActiveIdx(-1); }, [query]);

  function buildParams(location: string, categoryOverride?: string) {
    const params = new URLSearchParams();
    const cat = categoryOverride !== undefined ? categoryOverride : (activeCategory || "");
    if (cat) params.set("category", cat);
    if (location) params.set("location", location);
    if (selectedLayouts.length > 0) params.set("layout", selectedLayouts.join(","));
    if (selectedPrice.min) params.set("min_price", selectedPrice.min);
    if (selectedPrice.max) params.set("max_price", selectedPrice.max);
    if (selectedArea.min) params.set("min_area", selectedArea.min);
    if (selectedArea.max) params.set("max_area", selectedArea.max);
    params.set("sort", "newest");
    return params;
  }

  function navigateGroup(groupValue: string) {
    const group = GROUP_TABS.find(g => g.value === groupValue);
    if (!group) return;
    const alreadyActive = group.cats.every(c => activeCats.includes(c));
    const newCat = alreadyActive ? "" : group.cats.join(",");
    router.push(`/inzerce?${buildParams(query.trim(), newCat).toString()}`);
  }

  function navigateSub(cat: string) {
    const newCats = activeCats.includes(cat)
      ? activeCats.filter(c => c !== cat)
      : [...activeCats, cat];
    router.push(`/inzerce?${buildParams(query.trim(), newCats.join(",")).toString()}`);
  }

  const pick = useCallback((label: string) => {
    setQuery(label);
    setOpen(false);
    setActiveIdx(-1);
    setApiResults(null);
    const params = buildParams(label);
    router.push(`/inzerce?${params.toString()}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, router, selectedLayouts, selectedPrice, selectedArea]);

  function submit(loc?: string) {
    const location = loc ?? query.trim();
    const params = buildParams(location);
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
    <section className="relative rounded-lg border border-border bg-surface-1" style={{ zIndex: 20 }}>
      {/* Background accent glow */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-accent/[0.03] to-transparent" />

      <div className="relative px-8 py-14 md:px-14 md:py-20 max-w-3xl mx-auto">

        {/* Headline */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground leading-[1.15]">
            {headline.main}{" "}
            <span className="text-gradient">{headline.highlight}</span>
          </h1>
          <p className="mt-3 text-[15px] text-text-secondary leading-relaxed">{headline.sub}</p>
        </div>

        {/* Group tabs (Nákup / Pronájem / Pozemky) */}
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          {GROUP_TABS.map((group) => {
            const fullyActive = group.cats.every(c => activeCats.includes(c));
            const partlyActive = !fullyActive && group.cats.some(c => activeCats.includes(c));
            return (
              <button
                key={group.value}
                type="button"
                onClick={() => navigateGroup(group.value)}
                className={`rounded-md border px-4 py-2 text-[13px] font-medium transition-all ${
                  fullyActive || partlyActive
                    ? "border-accent bg-accent/10 text-accent-light"
                    : "border-border bg-surface-2 text-text-secondary hover:border-border-hover hover:text-foreground"
                }`}
              >
                {group.label}
              </button>
            );
          })}
        </div>

        {/* Sub-tabs (Byty / Domy) */}
        {subTabs && (
          <div className="flex justify-center gap-2 mb-4">
            {subTabs.map((sub) => {
              const active = activeCats.includes(sub.value);
              return (
                <button
                  key={sub.value}
                  type="button"
                  onClick={() => navigateSub(sub.value)}
                  className={`rounded-md border px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                    active
                      ? "border-accent/40 bg-accent/10 text-accent-light"
                      : "border-border bg-surface-2 text-text-tertiary hover:border-border-hover hover:text-foreground"
                  }`}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Quick filters */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {/* Layout pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-text-tertiary mr-1">Dispozice</span>
            {["Garsonka", "1+kk", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "5+"].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setSelectedLayouts(prev =>
                  prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]
                )}
                className={`rounded-md border px-2.5 py-1 text-[12px] font-medium transition-all ${
                  selectedLayouts.includes(l)
                    ? "border-accent bg-accent/10 text-accent-light"
                    : "border-border bg-surface-2 text-text-tertiary hover:border-border-hover hover:text-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Price dropdown */}
          <div ref={priceRef} className="relative">
            <button
              type="button"
              onClick={() => { setPriceDropOpen((o) => !o); setAreaDropOpen(false); }}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-[12px] font-medium transition-all ${
                selectedPrice.min || selectedPrice.max
                  ? "border-accent bg-accent/10 text-accent-light"
                  : "border-border bg-surface-2 text-text-tertiary hover:border-border-hover hover:text-foreground"
              }`}
            >
              {selectedPrice.min || selectedPrice.max
                ? [
                    selectedPrice.min && `od ${fmtPriceShort(selectedPrice.min)}`,
                    selectedPrice.max && `do ${fmtPriceShort(selectedPrice.max)}`,
                  ].filter(Boolean).join(" ")
                : "Cena"}
              {selectedPrice.min || selectedPrice.max ? (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedPrice({ min: "", max: "" }); setPriceDropOpen(false); }}
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-accent-light hover:bg-accent/40"
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </span>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`transition-transform ${priceDropOpen ? "rotate-180" : ""}`}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              )}
            </button>
            {priceDropOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full z-[300] mt-2 w-64 overflow-hidden rounded-lg border border-border bg-surface-1 shadow-2xl shadow-black/60">
                <div className="p-3 space-y-3">
                  <div className="text-[10px] font-medium uppercase tracking-widest text-text-tertiary">Cenový rozsah</div>
                  {/* Custom min/max inputs */}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Od"
                      value={selectedPrice.min}
                      onChange={(e) => setSelectedPrice(p => ({ ...p, min: e.target.value }))}
                      className="flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-text-tertiary outline-none focus:border-accent"
                    />
                    <span className="text-text-tertiary text-[11px]">–</span>
                    <input
                      type="number"
                      placeholder="Do"
                      value={selectedPrice.max}
                      onChange={(e) => setSelectedPrice(p => ({ ...p, max: e.target.value }))}
                      className="flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-text-tertiary outline-none focus:border-accent"
                    />
                  </div>
                  {/* Presets — adapt to category */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {getPricePresets(activeCategory).map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => { setSelectedPrice({ min: q.min, max: q.max }); setPriceDropOpen(false); }}
                        className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                          selectedPrice.min === q.min && selectedPrice.max === q.max
                            ? "border-accent bg-accent/10 text-accent-light"
                            : "border-border bg-surface-2 text-text-tertiary hover:border-border-hover hover:text-foreground"
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                  {/* Apply button */}
                  <button
                    type="button"
                    onClick={() => setPriceDropOpen(false)}
                    className="w-full rounded-md bg-accent py-1.5 text-[12px] font-medium text-white hover:bg-accent-light transition-colors"
                  >
                    Použít
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Area dropdown */}
          <div ref={areaRef} className="relative">
            <button
              type="button"
              onClick={() => { setAreaDropOpen((o) => !o); setPriceDropOpen(false); }}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-[12px] font-medium transition-all ${
                selectedArea.min || selectedArea.max
                  ? "border-accent bg-accent/10 text-accent-light"
                  : "border-border bg-surface-2 text-text-tertiary hover:border-border-hover hover:text-foreground"
              }`}
            >
              {selectedArea.min || selectedArea.max
                ? [
                    selectedArea.min && `od ${selectedArea.min} m²`,
                    selectedArea.max && `do ${selectedArea.max} m²`,
                  ].filter(Boolean).join(" ")
                : "Plocha"}
              {selectedArea.min || selectedArea.max ? (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedArea({ min: "", max: "" }); setAreaDropOpen(false); }}
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-accent-light hover:bg-accent/40"
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </span>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`transition-transform ${areaDropOpen ? "rotate-180" : ""}`}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              )}
            </button>
            {areaDropOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full z-[300] mt-2 w-64 overflow-hidden rounded-lg border border-border bg-surface-1 shadow-2xl shadow-black/60">
                <div className="p-3 space-y-3">
                  <div className="text-[10px] font-medium uppercase tracking-widest text-text-tertiary">Plocha (m²)</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Od m²"
                      value={selectedArea.min}
                      onChange={(e) => setSelectedArea(p => ({ ...p, min: e.target.value }))}
                      className="flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-text-tertiary outline-none focus:border-accent"
                    />
                    <span className="text-text-tertiary text-[11px]">–</span>
                    <input
                      type="number"
                      placeholder="Do m²"
                      value={selectedArea.max}
                      onChange={(e) => setSelectedArea(p => ({ ...p, max: e.target.value }))}
                      className="flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-text-tertiary outline-none focus:border-accent"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: "do 40 m²", min: "", max: "40" },
                      { label: "40–60", min: "40", max: "60" },
                      { label: "60–80", min: "60", max: "80" },
                      { label: "80–120", min: "80", max: "120" },
                      { label: "120–200", min: "120", max: "200" },
                      { label: "200+", min: "200", max: "" },
                    ].map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => { setSelectedArea({ min: q.min, max: q.max }); setAreaDropOpen(false); }}
                        className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          selectedArea.min === q.min && selectedArea.max === q.max
                            ? "border-accent bg-accent/10 text-accent-light"
                            : "border-border bg-surface-2 text-text-tertiary hover:border-border-hover hover:text-foreground"
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAreaDropOpen(false)}
                    className="w-full rounded-md bg-accent py-1.5 text-[12px] font-medium text-white hover:bg-accent-light transition-colors"
                  >
                    Použít
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search + autocomplete */}
        <div ref={wrapperRef} className="relative">
          <form onSubmit={handleSubmit} className="flex gap-0 rounded-lg border border-border bg-background focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(166,139,60,0.1)] transition-all">
            {/* Location icon */}
            <div className="flex items-center pl-4 shrink-0 pointer-events-none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>

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
              className="flex-1 bg-transparent py-4 pl-3 pr-4 text-[14px] text-foreground placeholder:text-text-tertiary outline-none"
            />

            {/* Clear */}
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setOpen(true); inputRef.current?.focus(); }}
                className="flex items-center pr-3 text-text-tertiary hover:text-foreground transition-colors shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}

            <div className="self-stretch w-px bg-border my-2.5 shrink-0" />

            <button
              type="submit"
              className="shrink-0 m-1.5 rounded-md bg-accent px-6 py-3 text-[13px] font-medium text-white transition-all hover:bg-accent-light active:scale-95"
            >
              Hledat
            </button>
          </form>

          {/* Dropdown */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-full z-[300] mt-2 overflow-hidden rounded-lg border border-border bg-surface-1 shadow-2xl shadow-black/60"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                  {query.length === 0
                    ? "Populární lokality"
                    : loading
                    ? "Hledám…"
                    : suggestions.length > 0
                    ? `${suggestions.length} míst nalezeno`
                    : "Žádné výsledky"}
                </span>
                <span className="text-[10px] text-text-tertiary hidden sm:block">↑↓ pro výběr · Enter pro potvrzení</span>
              </div>

              {/* Loading skeleton */}
              {loading && suggestions.length === 0 && (
                <div className="space-y-0">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex items-center gap-3 px-4 py-3">
                      <div className="h-8 w-8 rounded-md bg-surface-3 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-32 rounded bg-surface-3 animate-pulse" />
                        <div className="h-2.5 w-48 rounded bg-surface-3 animate-pulse" />
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
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === activeIdx ? "bg-accent/10" : "hover:bg-surface-2"
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-text-tertiary">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className={`text-[13px] font-medium leading-tight ${i === activeIdx ? "text-accent-light" : "text-foreground"}`}>
                      {query.length > 0 ? highlightMatch(s.label, query) : s.label}
                    </div>
                    {s.sublabel && (
                      <div className="text-[11px] text-text-tertiary truncate mt-0.5">{s.sublabel}</div>
                    )}
                  </div>

                  <span className="shrink-0 rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-text-tertiary">
                    {s.type}
                  </span>
                </button>
              ))}

              {/* No results */}
              {!loading && apiResults !== null && query.length >= 2 && suggestions.length === 0 && (
                <div className="px-4 py-5 text-center text-[13px] text-text-secondary">
                  Žádné místo nenalezeno — zkuste jiný název
                </div>
              )}

              {/* Footer */}
              {query.length > 0 && (
                <div className="border-t border-border px-4 py-2.5">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setOpen(false); submit(); }}
                    className="flex items-center gap-2 text-[12px] text-text-tertiary hover:text-accent-light transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    Hledat <span className="font-medium text-foreground">&bdquo;{query}&ldquo;</span> ve všech inzerátech
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trust bar */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-text-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
            Aktualizováno živě
          </span>
          <span>Bez registrace zdarma</span>
          <span className="hidden md:block">Data ze Sreality + Bezrealitky + katastr</span>
        </div>
      </div>
    </section>
  );
}

// Highlight matching substring
function highlightMatch(text: string, query: string): React.ReactNode {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/20 text-accent-light rounded px-0.5 font-semibold not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
