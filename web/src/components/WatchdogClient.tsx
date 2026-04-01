"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signIn } from "next-auth/react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Watchdog {
  id: number;
  name: string;
  active: number;
  category: string | null;
  property_type: string | null;
  region_id: number | null;
  district_id: number | null;
  location: string | null;
  price_min: number | null;
  price_max: number | null;
  area_min: number | null;
  area_max: number | null;
  keywords: string | null;
  watch_new: number;
  watch_drops: number;
  watch_drops_min_pct: number;
  watch_underpriced: number;
  watch_underpriced_pct: number;
  watch_returned: number;
  notify_email: number;
  notify_telegram: number;
  notify_frequency: string;
  created_at: string;
  match_count?: number;
}

interface WatchdogMatch {
  id: number;
  watchdog_id: number;
  listing_id: string;
  match_type: string;
  match_detail: string | null;
  created_at: string;
  title: string | null;
  url: string | null;
  location: string | null;
  category: string | null;
  area_m2: number | null;
  price: number | null;
}

interface SearchResult {
  type: "region" | "district" | "ward" | "location";
  id: number | string;
  name: string;
  parent?: string;
  avg_price_m2?: number;
  count?: number;
  district_id?: number;
}

interface WatchdogForm {
  name: string;
  categories: string[];
  property_type: string[];
  location: string;
  locationLabel: string;
  district_id: number | null;
  region_id: number | null;
  avg_price_m2: number | null;
  price_min: string;
  price_max: string;
  area_min: string;
  area_max: string;
  price_m2_min: string;
  price_m2_max: string;
  layout: string[];
  keywords: string;
  exclude_keywords: string;
  watch_new: boolean;
  watch_drops: boolean;
  watch_drops_min_pct: string;
  watch_underpriced: boolean;
  watch_underpriced_pct: string;
  watch_returned: boolean;
  notify_telegram: boolean;
  notify_frequency: string;
}

const LAYOUTS = ["garsonka", "1+kk", "1+1", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "4+1", "5+kk"];

const CATEGORIES = [
  { value: "byty-prodej",    label: "Byty",   sub: "prodej",   color: "#A68B3C" },
  { value: "byty-najem",     label: "Byty",   sub: "nájem",    color: "#5EBD72" },
  { value: "domy-prodej",    label: "Domy",   sub: "prodej",   color: "#5B8DD9" },
  { value: "domy-najem",     label: "Domy",   sub: "nájem",    color: "#D4A843" },
  { value: "pozemky-prodej", label: "Pozemky", sub: "prodej",  color: "#5EBD72" },
  { value: "komercni-prodej",label: "Komerční", sub: "prodej", color: "#E05252" },
];

const PROPERTY_TYPES = [
  { value: "rodinny",       label: "Rodinný dům" },
  { value: "vila",           label: "Vila" },
  { value: "na-klic",        label: "Na klíč" },
  { value: "vicegeneracni",  label: "Vícegenerační" },
  { value: "chalupa",        label: "Chalupa" },
  { value: "chata",          label: "Chata" },
];

const EMPTY_FORM: WatchdogForm = {
  name: "",
  categories: [],
  property_type: [],
  location: "",
  locationLabel: "",
  district_id: null,
  region_id: null,
  avg_price_m2: null,
  price_min: "",
  price_max: "",
  area_min: "",
  area_max: "",
  price_m2_min: "",
  price_m2_max: "",
  layout: [],
  keywords: "",
  exclude_keywords: "",
  watch_new: true,
  watch_drops: false,
  watch_drops_min_pct: "5",
  watch_underpriced: false,
  watch_underpriced_pct: "15",
  watch_returned: false,
  notify_telegram: true,
  notify_frequency: "instant",
};


const MATCH_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "Nový", color: "text-green" },
  drop: { label: "Pokles", color: "text-red" },
  underpriced: { label: "Pod cenou", color: "text-amber" },
  returned: { label: "Vrácen", color: "text-accent-light" },
};

const TYPE_LABEL: Record<string, string> = {
  region: "Kraj",
  district: "Okres",
  ward: "Obec",
  location: "Lokalita",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(p: number | null): string {
  if (!p) return "—";
  return p.toLocaleString("cs-CZ") + " Kč";
}

function formatPriceShort(p: number): string {
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(1)} M`;
  if (p >= 1_000) return `${Math.round(p / 1_000)}k`;
  return String(p);
}

function formatAvg(v: number): string {
  return Math.round(v).toLocaleString("cs-CZ") + " Kč/m²";
}

function parseCategories(raw: string | null): string[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw]; } catch { return [raw]; }
}

function summarizeWatchdog(wd: Watchdog): string {
  const parts: string[] = [];
  const cats = parseCategories(wd.category);
  if (cats.length) {
    parts.push(cats.map(c => {
      const found = CATEGORIES.find(x => x.value === c);
      return found ? `${found.label} ${found.sub}` : c;
    }).join(", "));
  }
  if (wd.location) parts.push(wd.location);
  if (wd.price_min || wd.price_max) {
    const min = wd.price_min ? formatPriceShort(wd.price_min) : "0";
    const max = wd.price_max ? formatPriceShort(wd.price_max) : "∞";
    parts.push(`${min} – ${max} Kč`);
  }
  if (wd.area_min || wd.area_max) {
    parts.push(`${wd.area_min || 0}–${wd.area_max || "∞"} m²`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Bez filtrů";
}

// ── SVG icon helpers ─────────────────────────────────────────────────────────

function IconNew({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
    </svg>
  );
}

function IconDrop({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>
    </svg>
  );
}

function IconUnderpriced({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}

function IconReturned({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  );
}

function IconEdit({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconPause({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
    </svg>
  );
}

function IconPlay({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function IconTrash({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    </svg>
  );
}

// ── Location search component ─────────────────────────────────────────────────

function LocationSearch({
  value,
  onSelect,
  onClear,
}: {
  value: string;
  onSelect: (r: SearchResult) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sync external clear
  useEffect(() => { if (!value) setQuery(""); }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults((data.results || []).slice(0, 8));
        setOpen(true);
        setActiveIdx(-1);
      } catch { /* ignore */ }
    }, 250);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleKey(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(results[activeIdx]); }
    if (e.key === "Escape") setOpen(false);
  }

  function pick(r: SearchResult) {
    setQuery(r.name);
    setOpen(false);
    onSelect(r);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value) onClear(); }}
          onKeyDown={handleKey}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Praha, Brno, Okres Plzeň..."
          className="w-full rounded-lg border border-border bg-background pl-8 pr-8 py-2 text-sm outline-none focus:border-accent transition-colors"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(""); setResults([]); setOpen(false); onClear(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden">
          {results.map((r, i) => (
            <button key={`${r.type}-${r.id}`} type="button"
              onMouseDown={() => pick(r)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${i === activeIdx ? "bg-card-hover" : "hover:bg-card-hover"}`}>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{r.name}</span>
                {r.parent && <span className="text-xs text-muted ml-1.5">{r.parent}</span>}
              </div>
              <div className="shrink-0 text-right">
                {r.avg_price_m2 ? (
                  <span className="text-xs font-semibold text-amber">{formatAvg(r.avg_price_m2)}</span>
                ) : r.count ? (
                  <span className="text-xs text-muted">{r.count} inz.</span>
                ) : null}
                <div className="text-[10px] text-muted/60">{TYPE_LABEL[r.type]}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WatchdogClient() {
  const { data: session, status } = useSession();
  const [watchdogs, setWatchdogs] = useState<Watchdog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<WatchdogForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedWd, setSelectedWd] = useState<number | null>(null);
  const [matches, setMatches] = useState<WatchdogMatch[]>([]);
  const [matchesTotal, setMatchesTotal] = useState(0);
  const [matchesPage, setMatchesPage] = useState(1);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [preview, setPreview] = useState<{ count: number; samples: Array<{ id: string; title: string; price: number; location: string }> } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [telegramId, setTelegramId] = useState("");
  const [telegramSavedId, setTelegramSavedId] = useState("");
  const [telegramEditing, setTelegramEditing] = useState(false);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchWatchdogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/watchdogs`);
      const data = await res.json();
      setWatchdogs(data.watchdogs || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchWatchdogs();
      fetch("/api/user").then(r => r.json()).then(d => {
        if (d.user?.telegram_id) { setTelegramId(d.user.telegram_id); setTelegramSavedId(d.user.telegram_id); }
      }).catch(() => {});
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [status, fetchWatchdogs]);

  async function saveTelegramId() {
    setTelegramSaving(true);
    try {
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: telegramId }),
      });
      setTelegramSavedId(telegramId);
      setTelegramEditing(false);
    } catch { /* ignore */ }
    finally { setTelegramSaving(false); }
  }

  async function disconnectTelegram() {
    setTelegramSaving(true);
    try {
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: null }),
      });
      setTelegramId("");
      setTelegramSavedId("");
      setTelegramEditing(false);
    } catch { /* ignore */ }
    finally { setTelegramSaving(false); }
  }

  const fetchMatches = useCallback(async (wdId: number, page = 1) => {
    setMatchesLoading(true);
    try {
      const res = await fetch(`/api/watchdogs/${wdId}/matches?page=${page}`);
      const data = await res.json();
      setMatches(data.matches || []);
      setMatchesTotal(data.total || 0);
      setMatchesPage(page);
    } catch { /* ignore */ }
    finally { setMatchesLoading(false); }
  }, []);

  function triggerPreview(f: WatchdogForm) {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch("/api/watchdogs/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categories: f.categories.length ? f.categories : null,
            property_type: f.property_type.length ? f.property_type : null,
            district_id: f.district_id,
            region_id: f.region_id,
            location: f.location || null,
            price_min: f.price_min ? parseInt(f.price_min) : null,
            price_max: f.price_max ? parseInt(f.price_max) : null,
            area_min: f.area_min ? parseFloat(f.area_min) : null,
            area_max: f.area_max ? parseFloat(f.area_max) : null,
            price_m2_min: f.price_m2_min ? parseInt(f.price_m2_min) : null,
            price_m2_max: f.price_m2_max ? parseInt(f.price_m2_max) : null,
            layout: f.layout,
            keywords: f.keywords ? f.keywords.split(",").map(s => s.trim()).filter(Boolean) : null,
            exclude_keywords: f.exclude_keywords ? f.exclude_keywords.split(",").map(s => s.trim()).filter(Boolean) : null,
          }),
        });
        setPreview(await res.json());
      } catch { /* ignore */ }
      finally { setPreviewLoading(false); }
    }, 500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        category: form.categories.length ? JSON.stringify(form.categories) : null,
        property_type: form.property_type.length ? form.property_type : null,
        location: form.location || null,
        district_id: form.district_id,
        region_id: form.region_id,
        price_min: form.price_min ? parseInt(form.price_min) : null,
        price_max: form.price_max ? parseInt(form.price_max) : null,
        area_min: form.area_min ? parseFloat(form.area_min) : null,
        area_max: form.area_max ? parseFloat(form.area_max) : null,
        price_m2_min: form.price_m2_min ? parseInt(form.price_m2_min) : null,
        price_m2_max: form.price_m2_max ? parseInt(form.price_m2_max) : null,
        layout: form.layout.length ? form.layout : null,
        keywords: form.keywords ? form.keywords.split(",").map(s => s.trim()).filter(Boolean) : null,
        exclude_keywords: form.exclude_keywords ? form.exclude_keywords.split(",").map(s => s.trim()).filter(Boolean) : null,
        watch_new: form.watch_new ? 1 : 0,
        watch_drops: form.watch_drops ? 1 : 0,
        watch_drops_min_pct: parseFloat(form.watch_drops_min_pct) || 5,
        watch_underpriced: form.watch_underpriced ? 1 : 0,
        watch_underpriced_pct: parseFloat(form.watch_underpriced_pct) || 15,
        watch_returned: form.watch_returned ? 1 : 0,
        notify_telegram: form.notify_telegram ? 1 : 0,
        notify_frequency: form.notify_frequency,
      };
      const url = editId ? `/api/watchdogs/${editId}` : "/api/watchdogs";
      const res = await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Chyba při ukládání");
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      setPreview(null);
      await fetchWatchdogs();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handleToggle(id: number) {
    setWatchdogs(prev => prev.map(w => w.id === id ? { ...w, active: w.active ? 0 : 1 } : w));
    try {
      const res = await fetch(`/api/watchdogs/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error();
    } catch { await fetchWatchdogs(); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Opravdu smazat hlídacího psa?")) return;
    if (deletingId) return;
    setDeletingId(id);
    setWatchdogs(prev => prev.filter(w => w.id !== id));
    if (selectedWd === id) { setSelectedWd(null); setMatches([]); }
    try {
      const res = await fetch(`/api/watchdogs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch { await fetchWatchdogs(); }
    finally { setDeletingId(null); }
  }

  function handleEdit(wd: Watchdog & { layout?: string | null; price_m2_min?: number | null; price_m2_max?: number | null }) {
    const kw = wd.keywords ? (() => { try { return JSON.parse(wd.keywords!); } catch { return []; } })() : [];
    const ekw = (wd as any).exclude_keywords ? (() => { try { return JSON.parse((wd as any).exclude_keywords!); } catch { return []; } })() : [];
    const ly = wd.layout ? (() => { try { return JSON.parse(wd.layout!); } catch { return []; } })() : [];
    const cats = parseCategories(wd.category);
    const pt = wd.property_type ? (() => { try { const p = JSON.parse(wd.property_type!); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];
    setForm({
      name: wd.name,
      categories: cats,
      property_type: pt,
      location: wd.location || "",
      locationLabel: wd.location || "",
      district_id: wd.district_id,
      region_id: wd.region_id,
      avg_price_m2: null,
      price_min: wd.price_min?.toString() || "",
      price_max: wd.price_max?.toString() || "",
      area_min: wd.area_min?.toString() || "",
      area_max: wd.area_max?.toString() || "",
      price_m2_min: wd.price_m2_min?.toString() || "",
      price_m2_max: wd.price_m2_max?.toString() || "",
      layout: Array.isArray(ly) ? ly : [],
      keywords: Array.isArray(kw) ? kw.join(", ") : "",
      exclude_keywords: Array.isArray(ekw) ? ekw.join(", ") : "",
      watch_new: !!wd.watch_new,
      watch_drops: !!wd.watch_drops,
      watch_drops_min_pct: wd.watch_drops_min_pct?.toString() || "5",
      watch_underpriced: !!wd.watch_underpriced,
      watch_underpriced_pct: wd.watch_underpriced_pct?.toString() || "15",
      watch_returned: !!wd.watch_returned,
      notify_telegram: !!wd.notify_telegram,
      notify_frequency: wd.notify_frequency || "instant",
    });
    setEditId(wd.id);
    setShowForm(true);
  }

  function handleLocationSelect(r: SearchResult) {
    setForm(f => ({
      ...f,
      location: r.name,
      locationLabel: r.type === "ward" && r.parent ? `${r.name} (${r.parent})` : r.name,
      district_id: r.type === "district" ? (r.id as number) : (r.district_id ?? null),
      region_id: r.type === "region" ? (r.id as number) : null,
      avg_price_m2: r.avg_price_m2 ?? null,
    }));
  }

  function handleLocationClear() {
    setForm(f => ({ ...f, location: "", locationLabel: "", district_id: null, region_id: null, avg_price_m2: null }));
  }

  function handleShowMatches(wdId: number) {
    if (selectedWd === wdId) { setSelectedWd(null); setMatches([]); return; }
    setSelectedWd(wdId);
    fetchMatches(wdId, 1);
  }

  function openNewForm() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(true);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  // Not logged in
  if (status !== "loading" && !session) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
        <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-light">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold">Hlídací pes</h2>
          <p className="text-sm text-muted mt-2 max-w-sm">
            Přihlaste se a nastavení hlídače vám automaticky pošle upozornění na nové nabídky, cenové poklesy a podhodnocené nemovitosti.
          </p>
        </div>
        <button
          onClick={() => signIn("google")}
          className="mt-1 flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 shadow hover:shadow-md transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Přihlásit přes Google
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Hlídací pes</h1>
          <p className="text-sm text-muted mt-1">
            Automatická upozornění na nové nabídky, poklesy cen a podhodnocené nemovitosti.
          </p>
        </div>
        {!showForm && (
          <button onClick={openNewForm}
            className="shrink-0 btn-primary py-2 px-4 text-sm">
            + Nový hlídač
          </button>
        )}
      </div>

      {/* Telegram — compact bar */}
      {session && !showForm && (
        <div className="rounded-lg border border-border bg-surface-1 px-4 py-3">
          {telegramSavedId && !telegramEditing ? (
            <div className="flex items-center gap-3 flex-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-accent-light shrink-0">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
              </svg>
              <span className="h-1.5 w-1.5 rounded-full bg-green" />
              <span className="text-sm text-text-secondary">Telegram propojen</span>
              <span className="font-mono text-xs text-muted">{telegramSavedId}</span>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setTelegramEditing(true)}
                  className="text-xs text-muted hover:text-foreground transition-colors">Změnit</button>
                <button onClick={disconnectTelegram} disabled={telegramSaving}
                  className="text-xs text-red/70 hover:text-red transition-colors">Odpojit</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-accent-light shrink-0">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
                </svg>
                <span className="text-sm font-medium">Propojit Telegram</span>
              </div>
              <p className="text-xs text-muted">
                Napiš <span className="font-mono bg-background border border-border rounded px-1.5 py-0.5 text-foreground">@HlidaciPesBot</span> na Telegramu,
                pošli <span className="font-mono bg-background border border-border rounded px-1.5 py-0.5 text-foreground">/start</span> a zkopíruj sem Chat ID.
              </p>
              <div className="flex items-center gap-2">
                <input type="text" value={telegramId} onChange={e => setTelegramId(e.target.value)}
                  placeholder="např. 123456789"
                  className="w-44 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent transition-colors font-mono" />
                <button onClick={saveTelegramId} disabled={telegramSaving || !telegramId.trim()}
                  className="rounded-lg bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent-light hover:bg-accent/25 transition-colors disabled:opacity-40">
                  {telegramSaving ? "Ukládám…" : "Uložit"}
                </button>
                {telegramEditing && (
                  <button onClick={() => { setTelegramEditing(false); setTelegramId(telegramSavedId); }}
                    className="text-xs text-muted hover:text-foreground transition-colors">Zrušit</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create / Edit form ────────────────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Form header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-1">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold">{editId ? "Upravit hlídače" : "Nový hlídač"}</h2>
              {previewLoading && <span className="text-xs text-muted animate-pulse">Počítám…</span>}
              {!previewLoading && preview !== null && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  preview.count > 0 ? "bg-accent/10 text-accent-light" : "bg-surface-3 text-muted"
                }`}>
                  {preview.count > 0 ? `${preview.count > 199 ? "200+" : preview.count} inzerátů nyní` : "0 shod"}
                </span>
              )}
            </div>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setPreview(null); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Name */}
            <input type="text" required value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Název hlídače, např. „Byty Praha do 5M“"
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm font-medium outline-none focus:border-accent transition-colors placeholder:font-normal" />

            {/* ── Section: Co sledovat ────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Co sledovat</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* New */}
                <button type="button" onClick={() => setForm(f => ({ ...f, watch_new: !f.watch_new }))}
                  className={`flex flex-col items-start gap-2 rounded-lg border p-3.5 text-left transition-all ${
                    form.watch_new
                      ? "border-green/40 bg-green/8 ring-1 ring-green/20"
                      : "border-border bg-background hover:border-border-light"
                  }`}>
                  <div className="flex w-full items-center justify-between">
                    <IconNew className={form.watch_new ? "text-green" : "text-muted"} />
                    <span className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${form.watch_new ? "border-green bg-green" : "border-border"}`} />
                  </div>
                  <span className={`text-sm font-semibold ${form.watch_new ? "text-green" : "text-foreground"}`}>Nové inzeráty</span>
                  <span className="text-[11px] text-muted leading-tight">Ihned při přidání do nabídky</span>
                </button>

                {/* Price drops */}
                <button type="button" onClick={() => setForm(f => ({ ...f, watch_drops: !f.watch_drops }))}
                  className={`flex flex-col items-start gap-2 rounded-lg border p-3.5 text-left transition-all ${
                    form.watch_drops
                      ? "border-red/40 bg-red/8 ring-1 ring-red/20"
                      : "border-border bg-background hover:border-border-light"
                  }`}>
                  <div className="flex w-full items-center justify-between">
                    <IconDrop className={form.watch_drops ? "text-red" : "text-muted"} />
                    <span className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${form.watch_drops ? "border-red bg-red" : "border-border"}`} />
                  </div>
                  <span className={`text-sm font-semibold ${form.watch_drops ? "text-red" : "text-foreground"}`}>Pokles ceny</span>
                  {form.watch_drops ? (
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <span className="text-[11px] text-muted">min</span>
                      <input type="number" value={form.watch_drops_min_pct}
                        onChange={e => setForm(f => ({ ...f, watch_drops_min_pct: e.target.value }))}
                        className="w-12 rounded border border-red/30 bg-red/10 px-1.5 py-0.5 text-xs font-bold text-red text-center outline-none" />
                      <span className="text-[11px] text-muted">%</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted leading-tight">Při snížení inzerované ceny</span>
                  )}
                </button>

                {/* Underpriced */}
                <button type="button" onClick={() => setForm(f => ({ ...f, watch_underpriced: !f.watch_underpriced }))}
                  className={`flex flex-col items-start gap-2 rounded-lg border p-3.5 text-left transition-all ${
                    form.watch_underpriced
                      ? "border-amber/40 bg-amber/8 ring-1 ring-amber/20"
                      : "border-border bg-background hover:border-border-light"
                  }`}>
                  <div className="flex w-full items-center justify-between">
                    <IconUnderpriced className={form.watch_underpriced ? "text-amber" : "text-muted"} />
                    <span className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${form.watch_underpriced ? "border-amber bg-amber" : "border-border"}`} />
                  </div>
                  <span className={`text-sm font-semibold ${form.watch_underpriced ? "text-amber" : "text-foreground"}`}>Pod prodejní cenou</span>
                  {form.watch_underpriced ? (
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <span className="text-[11px] text-muted">min</span>
                      <input type="number" value={form.watch_underpriced_pct}
                        onChange={e => setForm(f => ({ ...f, watch_underpriced_pct: e.target.value }))}
                        className="w-12 rounded border border-amber/30 bg-amber/10 px-1.5 py-0.5 text-xs font-bold text-amber text-center outline-none" />
                      <span className="text-[11px] text-muted">% pod Ø</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted leading-tight">Pod průměrem prodejní ceny</span>
                  )}
                </button>

                {/* Returned */}
                <button type="button" onClick={() => setForm(f => ({ ...f, watch_returned: !f.watch_returned }))}
                  className={`flex flex-col items-start gap-2 rounded-lg border p-3.5 text-left transition-all ${
                    form.watch_returned
                      ? "border-accent/40 bg-accent-dim ring-1 ring-accent/20"
                      : "border-border bg-background hover:border-border-light"
                  }`}>
                  <div className="flex w-full items-center justify-between">
                    <IconReturned className={form.watch_returned ? "text-accent-light" : "text-muted"} />
                    <span className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${form.watch_returned ? "border-accent bg-accent" : "border-border"}`} />
                  </div>
                  <span className={`text-sm font-semibold ${form.watch_returned ? "text-accent-light" : "text-foreground"}`}>Vrácené</span>
                  <span className="text-[11px] text-muted leading-tight">Inzerát znovu v nabídce po stažení</span>
                </button>
              </div>
            </div>

            {/* ── Section: Kde hledat ─────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Kde hledat</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-4">
                {/* Category multi-select */}
                <div>
                  <label className="text-xs text-muted mb-2 block">Typ nemovitosti <span className="text-muted/50">(prázdné = vše)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(c => {
                      const active = form.categories.includes(c.value);
                      return (
                        <button key={c.value} type="button"
                          onClick={() => {
                            const categories = active
                              ? form.categories.filter(x => x !== c.value)
                              : [...form.categories, c.value];
                            const hasDomy = categories.some(cat => cat.startsWith("domy"));
                            const property_type = hasDomy ? form.property_type : [];
                            const f = { ...form, categories, property_type };
                            setForm(f); triggerPreview(f);
                          }}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                            active ? "border-transparent text-white" : "border-border text-muted hover:text-foreground hover:border-border-light"
                          }`}
                          style={active ? { background: c.color, borderColor: c.color } : {}}>
                          <span>{c.label}</span>
                          <span className={`text-[10px] font-normal ${active ? "text-white/70" : "text-muted/60"}`}>{c.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Property sub-type */}
                {form.categories.some(c => c.startsWith("domy")) && (
                  <div>
                    <label className="text-xs text-muted mb-2 block">Typ domu <span className="text-muted/50">(prázdné = vše)</span></label>
                    <div className="flex flex-wrap gap-2">
                      {PROPERTY_TYPES.map(pt => {
                        const active = form.property_type.includes(pt.value);
                        return (
                          <button key={pt.value} type="button"
                            onClick={() => {
                              const property_type = active
                                ? form.property_type.filter(x => x !== pt.value)
                                : [...form.property_type, pt.value];
                              const f = { ...form, property_type };
                              setForm(f); triggerPreview(f);
                            }}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                              active ? "border-amber bg-amber/15 text-amber" : "border-border text-muted hover:text-foreground hover:border-border-light"
                            }`}>
                            {pt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Location */}
                <div>
                  <label className="text-xs text-muted mb-2 block">Lokalita</label>
                  <LocationSearch value={form.locationLabel} onSelect={handleLocationSelect} onClear={handleLocationClear} />
                  {form.avg_price_m2 && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber/20 bg-amber/5 px-3 py-1.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber shrink-0">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                      </svg>
                      <span className="text-xs text-muted">Poslední prodejní cena:</span>
                      <span className="text-xs font-bold text-amber">{formatAvg(form.avg_price_m2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section: Limity ──────────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Cenové a plošné limity</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <input type="number" value={form.price_min} onChange={e => { const f = { ...form, price_min: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="Cena od" className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                  <input type="number" value={form.price_max} onChange={e => { const f = { ...form, price_max: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="Cena do" className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                  <input type="number" value={form.area_min} onChange={e => { const f = { ...form, area_min: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="m² od" className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                  <input type="number" value={form.area_max} onChange={e => { const f = { ...form, area_max: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="m² do" className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                  <input type="number" value={form.price_m2_min} onChange={e => { const f = { ...form, price_m2_min: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="Kč/m² od" className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                  <input type="number" value={form.price_m2_max} onChange={e => { const f = { ...form, price_m2_max: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="Kč/m² do" className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                </div>

                <input type="text" value={form.keywords} onChange={e => { const f = { ...form, keywords: e.target.value }; setForm(f); triggerPreview(f); }}
                  placeholder="Hledaná slova: balkon, garáž, sklep…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />

                <input type="text" value={form.exclude_keywords} onChange={e => { const f = { ...form, exclude_keywords: e.target.value }; setForm(f); triggerPreview(f); }}
                  placeholder="Vyloučená slova: aukce, dražba, podíl…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />

                <div>
                  <label className="text-xs text-muted mb-2 block">Dispozice <span className="text-muted/50">(prázdné = vše)</span></label>
                  <div className="flex flex-wrap gap-1.5">
                    {LAYOUTS.map(l => {
                      const active = form.layout.includes(l);
                      return (
                        <button key={l} type="button"
                          onClick={() => {
                            const layout = active ? form.layout.filter(x => x !== l) : [...form.layout, l];
                            const f = { ...form, layout };
                            setForm(f); triggerPreview(f);
                          }}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                            active ? "border-accent/40 bg-accent/10 text-accent-light" : "border-border text-muted hover:text-foreground"
                          }`}>
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Preview samples */}
              {preview && preview.samples.length > 0 && (
                <div className="mt-3 rounded-lg border border-border/60 bg-background overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-border/40 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Ukázka shod
                  </div>
                  {preview.samples.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2 border-b border-border/30 last:border-0">
                      <span className="text-xs text-foreground truncate flex-1 pr-3">{s.title}</span>
                      <span className="text-xs font-bold text-accent-light shrink-0 tabular-nums">
                        {s.price >= 1_000_000 ? `${(s.price / 1_000_000).toFixed(1)} M` : `${Math.round(s.price / 1000)}k`} Kč
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Section: Notifikace ──────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Notifikace</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setForm(f => ({ ...f, notify_telegram: !f.notify_telegram }))}
                  className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all ${
                    form.notify_telegram ? "border-accent/40 bg-accent-dim text-accent-light" : "border-border text-muted hover:text-foreground"
                  }`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
                  </svg>
                  Telegram
                </button>

                <div className="flex rounded-lg border border-border overflow-hidden ml-auto">
                  {(["instant", "daily", "weekly"] as const).map((freq, i) => (
                    <button key={freq} type="button"
                      onClick={() => setForm(f => ({ ...f, notify_frequency: freq }))}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${
                        form.notify_frequency === freq ? "bg-accent text-white" : "text-muted hover:text-foreground"
                      }`}>
                      {freq === "instant" ? "Okamžitě" : freq === "daily" ? "Denně" : "Týdně"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-3 border-t border-border">
              <button type="submit" disabled={saving}
                className="btn-primary py-2.5 px-6 text-sm disabled:opacity-50">
                {saving ? "Ukládám…" : editId ? "Uložit změny" : "Vytvořit hlídače"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="rounded-lg border border-border px-5 py-2.5 text-sm text-muted hover:text-foreground transition-colors">
                Zrušit
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Watchdog list ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-5 w-40 bg-surface-2 rounded animate-shimmer" />
                <div className="h-5 w-16 bg-surface-2 rounded-full animate-shimmer" />
              </div>
              <div className="h-4 w-64 bg-surface-2 rounded animate-shimmer" />
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-surface-2 rounded-full animate-shimmer" />
                <div className="h-5 w-20 bg-surface-2 rounded-full animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : watchdogs.length === 0 && !showForm ? (
        <div className="text-center py-16 space-y-4">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-surface-2 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div>
            <p className="font-medium">Zatím nemáte žádného hlídače</p>
            <p className="text-sm text-muted mt-1">Vytvořte si prvního a už vám neunikne žádná příležitost.</p>
          </div>
          <button onClick={openNewForm} className="btn-primary py-2 px-5 text-sm">
            + Vytvořit hlídače
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {watchdogs.map(wd => {
            const isOpen = selectedWd === wd.id;
            const watchTypes: { label: string; cls: string }[] = [];
            if (wd.watch_new) watchTypes.push({ label: "Nové", cls: "bg-green/10 text-green" });
            if (wd.watch_drops) watchTypes.push({ label: `Poklesy ≥${wd.watch_drops_min_pct}%`, cls: "bg-red/10 text-red" });
            if (wd.watch_underpriced) watchTypes.push({ label: `Pod cenou ≥${wd.watch_underpriced_pct}%`, cls: "bg-amber/10 text-amber" });
            if (wd.watch_returned) watchTypes.push({ label: "Vrácené", cls: "bg-accent-dim text-accent-light" });

            return (
              <div key={wd.id}>
                <div className={`rounded-xl border overflow-hidden transition-all ${
                  !wd.active ? "border-border/50 opacity-50" : isOpen ? "border-accent/30 bg-card" : "border-border bg-card hover:border-border-light"
                }`}>
                  {/* Main content */}
                  <div className="p-4 sm:p-5">
                    {/* Row 1: Name + status + actions */}
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${wd.active ? "bg-green" : "bg-text-tertiary"}`} />
                      <h3 className="text-[15px] font-semibold truncate flex-1">{wd.name}</h3>

                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleEdit(wd)} title="Upravit"
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                          <IconEdit />
                        </button>
                        <button onClick={() => handleToggle(wd.id)} title={wd.active ? "Pozastavit" : "Aktivovat"}
                          className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                            wd.active ? "text-muted hover:text-amber hover:bg-amber/10" : "text-muted hover:text-green hover:bg-green/10"
                          }`}>
                          {wd.active ? <IconPause /> : <IconPlay />}
                        </button>
                        <button onClick={() => handleDelete(wd.id)} title="Smazat"
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted hover:text-red hover:bg-red/10 transition-colors">
                          <IconTrash />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Summary text */}
                    <p className="mt-1.5 text-[13px] text-text-secondary pl-5">{summarizeWatchdog(wd)}</p>

                    {/* Row 3: Watch types + match count */}
                    <div className="mt-3 flex items-center justify-between gap-3 pl-5">
                      <div className="flex flex-wrap gap-1.5">
                        {watchTypes.map(wt => (
                          <span key={wt.label} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${wt.cls}`}>{wt.label}</span>
                        ))}
                      </div>

                      <button onClick={() => handleShowMatches(wd.id)}
                        className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          isOpen
                            ? "bg-accent/10 text-accent-light"
                            : (wd.match_count ?? 0) > 0
                              ? "text-accent-light hover:bg-accent/10"
                              : "text-muted hover:text-foreground"
                        }`}>
                        {(wd.match_count ?? 0) > 0 && (
                          <span className="tabular-nums font-semibold">{wd.match_count}</span>
                        )}
                        <span>{isOpen ? "Skrýt" : (wd.match_count ?? 0) > 0 ? "výsledků" : "Výsledky"}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Matches panel — inline */}
                  {isOpen && (
                    <div className="border-t border-border bg-surface-1 px-4 sm:px-5 py-4">
                      {matchesLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted py-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                          Načítám…
                        </div>
                      ) : matches.length === 0 ? (
                        <p className="text-sm text-muted py-2">Zatím žádné výsledky. Hlídač prověří nové inzeráty při dalším scanu.</p>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            {matches.map(m => {
                              const detail = m.match_detail ? JSON.parse(m.match_detail) : {};
                              const mt = MATCH_LABELS[m.match_type] || { label: m.match_type, color: "text-muted" };
                              return (
                                <a key={m.id} href={m.url || `/listing/${m.listing_id}`}
                                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-background px-3 py-2.5 hover:border-border-light transition-colors group">
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${mt.color}`}
                                    style={{ backgroundColor: "color-mix(in srgb, currentColor 10%, transparent)" }}>
                                    {mt.label}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium group-hover:text-accent-light transition-colors truncate block">
                                      {m.title || m.listing_id}
                                    </span>
                                    <span className="text-[11px] text-muted">
                                      {m.location || "—"} · {formatPrice(m.price)}{m.area_m2 ? ` · ${m.area_m2} m²` : ""}
                                    </span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    {m.match_type === "drop" && detail.drop_pct && (
                                      <span className="text-sm font-bold text-red">-{detail.drop_pct.toFixed(1)}%</span>
                                    )}
                                    {m.match_type === "underpriced" && detail.diff_pct && (
                                      <span className="text-sm font-bold text-amber">{detail.diff_pct.toFixed(1)}% pod Ø</span>
                                    )}
                                    <div className="text-[11px] text-muted">{new Date(m.created_at).toLocaleDateString("cs-CZ")}</div>
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                          {matchesTotal > 30 && (
                            <div className="flex justify-center items-center gap-3 mt-3 pt-3 border-t border-border/50">
                              <button disabled={matchesPage <= 1} onClick={() => fetchMatches(wd.id, matchesPage - 1)}
                                className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-30 hover:bg-surface-2 transition-colors">← Předchozí</button>
                              <span className="text-xs text-muted tabular-nums">{matchesPage} / {Math.ceil(matchesTotal / 30)}</span>
                              <button disabled={matchesPage >= Math.ceil(matchesTotal / 30)} onClick={() => fetchMatches(wd.id, matchesPage + 1)}
                                className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-30 hover:bg-surface-2 transition-colors">Další →</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
