"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signIn } from "next-auth/react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Watchdog {
  id: number;
  name: string;
  active: number;
  category: string | null;
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
}

interface WatchdogForm {
  name: string;
  categories: string[];
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
  { value: "byty-prodej",    label: "Byty",   sub: "prodej",   color: "#818CF8" },
  { value: "byty-najem",     label: "Byty",   sub: "nájem",    color: "#10B981" },
  { value: "domy-prodej",    label: "Domy",   sub: "prodej",   color: "#F97316" },
  { value: "domy-najem",     label: "Domy",   sub: "nájem",    color: "#F59E0B" },
  { value: "pozemky-prodej", label: "Pozemky", sub: "prodej",  color: "#84CC16" },
  { value: "komercni-prodej",label: "Komerční", sub: "prodej", color: "#EC4899" },
];

const EMPTY_FORM: WatchdogForm = {
  name: "",
  categories: [],
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
  watch_new: true,
  watch_drops: false,
  watch_drops_min_pct: "5",
  watch_underpriced: false,
  watch_underpriced_pct: "15",
  watch_returned: false,
  notify_telegram: false,
  notify_frequency: "instant",
};


const MATCH_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "Nový", color: "text-green-400" },
  drop: { label: "Pokles", color: "text-red-400" },
  underpriced: { label: "Pod cenou", color: "text-amber-400" },
  returned: { label: "Vrácen", color: "text-blue-400" },
};

const TYPE_ICON: Record<string, string> = {
  region: "🗺",
  district: "🏘",
  ward: "📍",
  location: "📌",
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

function formatAvg(v: number): string {
  return Math.round(v).toLocaleString("cs-CZ") + " Kč/m²";
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
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          {results.map((r, i) => (
            <button key={`${r.type}-${r.id}`} type="button"
              onMouseDown={() => pick(r)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${i === activeIdx ? "bg-card-hover" : "hover:bg-card-hover"}`}>
              <span className="text-base shrink-0">{TYPE_ICON[r.type]}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{r.name}</span>
                {r.parent && <span className="text-xs text-muted ml-1.5">{r.parent}</span>}
              </div>
              <div className="shrink-0 text-right">
                {r.avg_price_m2 ? (
                  <span className="text-xs font-semibold text-amber-400">{formatAvg(r.avg_price_m2)}</span>
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
  const [telegramSavedId, setTelegramSavedId] = useState(""); // the value actually in DB
  const [telegramEditing, setTelegramEditing] = useState(false);
  const [telegramSaving, setTelegramSaving] = useState(false);

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
          }),
        });
        setPreview(await res.json());
      } catch { /* ignore */ }
      finally { setPreviewLoading(false); }
    }, 500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      category: form.categories.length ? JSON.stringify(form.categories) : null,
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
    await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setPreview(null);
    fetchWatchdogs();
  }

  async function handleToggle(id: number) {
    await fetch(`/api/watchdogs/${id}`, { method: "PATCH" });
    fetchWatchdogs();
  }

  async function handleScan(id: number) {
    const btn = document.getElementById(`scan-btn-${id}`);
    if (btn) btn.textContent = "Hledám…";
    try {
      const res = await fetch(`/api/watchdogs/${id}/scan`, { method: "POST" });
      const data = await res.json();
      if (btn) btn.textContent = data.count > 0 ? `+${data.count} shod` : "Žádné shody";
      setTimeout(() => { if (btn) btn.textContent = "Prohledat DB"; }, 3000);
      if (data.count > 0) fetchWatchdogs();
    } catch {
      if (btn) btn.textContent = "Chyba";
      setTimeout(() => { if (btn) btn.textContent = "Prohledat DB"; }, 2000);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Opravdu smazat hlídacího psa?")) return;
    await fetch(`/api/watchdogs/${id}`, { method: "DELETE" });
    if (selectedWd === id) { setSelectedWd(null); setMatches([]); }
    fetchWatchdogs();
  }

  function handleEdit(wd: Watchdog & { layout?: string | null; price_m2_min?: number | null; price_m2_max?: number | null }) {
    const kw = wd.keywords ? (() => { try { return JSON.parse(wd.keywords!); } catch { return []; } })() : [];
    const ly = wd.layout ? (() => { try { return JSON.parse(wd.layout!); } catch { return []; } })() : [];
    const cats = wd.category ? (() => { try { const p = JSON.parse(wd.category!); return Array.isArray(p) ? p : [wd.category!]; } catch { return wd.category ? [wd.category] : []; } })() : [];
    setForm({
      name: wd.name,
      categories: cats,
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
      locationLabel: r.name,
      district_id: r.type === "district" ? (r.id as number) : (r.type === "ward" ? null : null),
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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Not logged in */}
      {status !== "loading" && !session && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="text-4xl">🐕</div>
          <h2 className="text-xl font-bold">Přihlaste se pro hlídacího psa</h2>
          <p className="text-sm text-muted max-w-sm">
            Pro ukládání hlídačů a příjem upozornění se musíte přihlásit.
          </p>
          <button
            onClick={() => signIn("google")}
            className="mt-2 flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 shadow hover:shadow-md transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Přihlásit přes Google
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hlídací pes</h1>
          <p className="text-sm text-muted mt-1">
            Nastavte si hlídání a dostávejte upozornění na nové nemovitosti, cenové poklesy a podhodnocené nabídky.
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(!showForm); }}
          className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent-light hover:bg-accent/20 transition-colors"
        >
          + Nový hlídací pes
        </button>
      </div>

      {/* Telegram settings */}
      {session && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-blue-400 shrink-0">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
                </svg>
                <span className="text-sm font-semibold">Telegram notifikace</span>
              </div>
              {telegramSavedId && !telegramEditing ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/8 px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium text-green-400">Propojeno</span>
                    <span className="font-mono text-xs text-muted">{telegramSavedId}</span>
                  </div>
                  <button onClick={() => setTelegramEditing(true)}
                    className="rounded-xl border border-border px-3 py-2 text-xs text-muted hover:text-foreground transition-colors">
                    Změnit
                  </button>
                  <button onClick={disconnectTelegram} disabled={telegramSaving}
                    className="rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-400/70 hover:text-red-400 hover:border-red-500/40 transition-colors">
                    Odpojit
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted mb-3">
                    Napiš <span className="font-mono bg-background border border-border rounded px-1.5 py-0.5 text-foreground">@HlidaciPesBot</span> na Telegramu,
                    pošli <span className="font-mono bg-background border border-border rounded px-1.5 py-0.5 text-foreground">/start</span> a zkopíruj sem své Chat ID.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={telegramId}
                      onChange={e => setTelegramId(e.target.value)}
                      placeholder="např. 123456789"
                      className="w-48 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-400/60 transition-colors font-mono"
                    />
                    <button onClick={saveTelegramId} disabled={telegramSaving || !telegramId.trim()}
                      className="rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-400/20 transition-all disabled:opacity-40">
                      {telegramSaving ? "Ukládám…" : "Uložit"}
                    </button>
                    {telegramEditing && (
                      <button onClick={() => { setTelegramEditing(false); setTelegramId(telegramSavedId); }}
                        className="rounded-xl border border-border px-3 py-2 text-xs text-muted hover:text-foreground transition-colors">
                        Zrušit
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-muted">Email</span>
              <div className="text-sm font-medium mt-0.5 truncate max-w-[180px]">{session.user?.email}</div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Form header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold">{editId ? "Upravit hlídacího psa" : "Nový hlídací pes"}</h2>
              {previewLoading && (
                <span className="text-xs text-muted animate-pulse">Počítám…</span>
              )}
              {!previewLoading && preview !== null && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  preview.count > 0 ? "bg-accent/10 text-accent-light" : "bg-border text-muted"
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

          <div className="p-6 space-y-6">
            {/* Name */}
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Název</label>
              <input type="text" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="např. Byty Praha do 5M"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Filters */}
            <div className="space-y-4">
              {/* Category multi-select */}
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Typ <span className="font-normal text-muted/50">(prázdné = vše)</span></label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATEGORIES.map(c => {
                    const active = form.categories.includes(c.value);
                    return (
                      <button key={c.value} type="button"
                        onClick={() => {
                          const categories = active
                            ? form.categories.filter(x => x !== c.value)
                            : [...form.categories, c.value];
                          const f = { ...form, categories };
                          setForm(f); triggerPreview(f);
                        }}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
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

              {/* Location */}
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Lokalita</label>
                <div className="mt-2">
                  <LocationSearch value={form.locationLabel} onSelect={handleLocationSelect} onClear={handleLocationClear} />
                  {form.avg_price_m2 && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 shrink-0">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                      </svg>
                      <span className="text-xs text-muted">Poslední prodejní cena:</span>
                      <span className="text-xs font-bold text-amber-400">{formatAvg(form.avg_price_m2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Price & Area & Price/m² */}
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Cena &amp; plocha</label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input type="number" value={form.price_min} onChange={e => { const f = { ...form, price_min: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="Cena od" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                  <input type="number" value={form.price_max} onChange={e => { const f = { ...form, price_max: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="Cena do" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                  <input type="number" value={form.area_min} onChange={e => { const f = { ...form, area_min: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="m² od" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                  <input type="number" value={form.area_max} onChange={e => { const f = { ...form, area_max: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="m² do" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                  <input type="number" value={form.price_m2_min} onChange={e => { const f = { ...form, price_m2_min: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="Kč/m² od" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                  <input type="number" value={form.price_m2_max} onChange={e => { const f = { ...form, price_m2_max: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="Kč/m² do" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                  <input type="text" value={form.keywords} onChange={e => { const f = { ...form, keywords: e.target.value }; setForm(f); triggerPreview(f); }}
                    placeholder="Klíčová slova: balkon, garáž…"
                    className="col-span-2 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors" />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs text-muted mb-2 block">Dispozice <span className="text-muted/50">(prázdné = vše)</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {LAYOUTS.map(l => {
                    const active = form.layout.includes(l);
                    return (
                      <button key={l} type="button"
                        onClick={() => {
                          const layout = active ? form.layout.filter(x => x !== l) : [...form.layout, l];
                          const f = { ...form, layout };
                          setForm(f);
                          triggerPreview(f);
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

              {/* Preview samples */}
              {preview && preview.samples.length > 0 && (
                <div className="mt-3 rounded-xl border border-border/60 bg-background overflow-hidden">
                  <div className="px-3 py-2 border-b border-border/40 text-[10px] font-semibold uppercase tracking-wider text-muted">
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

            {/* Watch types */}
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Co sledovat</label>
              <div className="mt-1.5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* New */}
                <button type="button" onClick={() => setForm(f => ({ ...f, watch_new: !f.watch_new }))}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-all ${
                    form.watch_new
                      ? "border-green-500/40 bg-green-500/8 ring-1 ring-green-500/20"
                      : "border-border bg-background hover:border-border-light"
                  }`}>
                  <div className="flex w-full items-center justify-between">
                    <span className="text-lg">🆕</span>
                    <span className={`h-4 w-4 rounded-full border-2 transition-colors ${form.watch_new ? "border-green-500 bg-green-500" : "border-border"}`} />
                  </div>
                  <span className={`text-sm font-semibold ${form.watch_new ? "text-green-400" : "text-foreground"}`}>Nové inzeráty</span>
                  <span className="text-[11px] text-muted leading-tight">Ihned při přidání do nabídky</span>
                </button>

                {/* Price drops */}
                <button type="button" onClick={() => setForm(f => ({ ...f, watch_drops: !f.watch_drops }))}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-all ${
                    form.watch_drops
                      ? "border-red-500/40 bg-red-500/8 ring-1 ring-red-500/20"
                      : "border-border bg-background hover:border-border-light"
                  }`}>
                  <div className="flex w-full items-center justify-between">
                    <span className="text-lg">📉</span>
                    <span className={`h-4 w-4 rounded-full border-2 transition-colors ${form.watch_drops ? "border-red-500 bg-red-500" : "border-border"}`} />
                  </div>
                  <span className={`text-sm font-semibold ${form.watch_drops ? "text-red-400" : "text-foreground"}`}>Pokles ceny</span>
                  {form.watch_drops ? (
                    <div className="flex items-center gap-1.5 mt-0.5" onClick={e => e.stopPropagation()}>
                      <span className="text-[11px] text-muted">min</span>
                      <input type="number" value={form.watch_drops_min_pct}
                        onChange={e => setForm(f => ({ ...f, watch_drops_min_pct: e.target.value }))}
                        className="w-12 rounded-lg border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-xs font-bold text-red-300 text-center outline-none" />
                      <span className="text-[11px] text-muted">%</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted leading-tight">Při snížení inzerované ceny</span>
                  )}
                </button>

                {/* Underpriced */}
                <button type="button" onClick={() => setForm(f => ({ ...f, watch_underpriced: !f.watch_underpriced }))}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-all ${
                    form.watch_underpriced
                      ? "border-amber-500/40 bg-amber-500/8 ring-1 ring-amber-500/20"
                      : "border-border bg-background hover:border-border-light"
                  }`}>
                  <div className="flex w-full items-center justify-between">
                    <span className="text-lg">💰</span>
                    <span className={`h-4 w-4 rounded-full border-2 transition-colors ${form.watch_underpriced ? "border-amber-500 bg-amber-500" : "border-border"}`} />
                  </div>
                  <span className={`text-sm font-semibold ${form.watch_underpriced ? "text-amber-400" : "text-foreground"}`}>Pod prodejní cenou</span>
                  {form.watch_underpriced ? (
                    <div className="flex items-center gap-1.5 mt-0.5" onClick={e => e.stopPropagation()}>
                      <span className="text-[11px] text-muted">min</span>
                      <input type="number" value={form.watch_underpriced_pct}
                        onChange={e => setForm(f => ({ ...f, watch_underpriced_pct: e.target.value }))}
                        className="w-12 rounded-lg border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-xs font-bold text-amber-300 text-center outline-none" />
                      <span className="text-[11px] text-muted">% pod Ø</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted leading-tight">Pod průměrem prodejní ceny v oblasti</span>
                  )}
                </button>

                {/* Returned */}
                <button type="button" onClick={() => setForm(f => ({ ...f, watch_returned: !f.watch_returned }))}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-all ${
                    form.watch_returned
                      ? "border-blue-500/40 bg-blue-500/8 ring-1 ring-blue-500/20"
                      : "border-border bg-background hover:border-border-light"
                  }`}>
                  <div className="flex w-full items-center justify-between">
                    <span className="text-lg">🔄</span>
                    <span className={`h-4 w-4 rounded-full border-2 transition-colors ${form.watch_returned ? "border-blue-500 bg-blue-500" : "border-border"}`} />
                  </div>
                  <span className={`text-sm font-semibold ${form.watch_returned ? "text-blue-400" : "text-foreground"}`}>Vrácené</span>
                  <span className="text-[11px] text-muted leading-tight">Inzerát znovu v nabídce po stažení</span>
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Notifikace</label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, notify_telegram: !f.notify_telegram }))}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all ${
                    form.notify_telegram ? "border-blue-400/40 bg-blue-400/10 text-blue-300" : "border-border text-muted hover:text-foreground"
                  }`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
                  </svg>
                  Telegram
                </button>

                <div className="flex rounded-xl border border-border overflow-hidden ml-auto">
                  {(["instant", "daily", "weekly"] as const).map((freq, i) => (
                    <button key={freq} type="button"
                      onClick={() => setForm(f => ({ ...f, notify_frequency: freq }))}
                      className={`px-3 py-2 text-xs font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${
                        form.notify_frequency === freq ? "bg-accent text-white" : "text-muted hover:text-foreground"
                      }`}>
                      {freq === "instant" ? "Okamžitě" : freq === "daily" ? "Denně" : "Týdně"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-1">
              <button type="submit"
                className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent/80 transition-colors">
                {editId ? "Uložit změny" : "Vytvořit hlídacího psa"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="rounded-xl border border-border px-5 py-2.5 text-sm text-muted hover:text-foreground transition-colors">
                Zrušit
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Watchdog list */}
      {loading ? (
        <div className="text-center text-muted py-12">Načítám...</div>
      ) : watchdogs.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-4xl">🐕</div>
          <p className="text-muted">Zatím nemáte žádného hlídacího psa. Vytvořte si prvního!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {watchdogs.map(wd => (
            <div key={wd.id}>
              <div className={`rounded-2xl border p-5 transition-colors ${wd.active ? "border-border bg-card" : "border-border/50 bg-card/50 opacity-60"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold truncate">{wd.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${wd.active ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                        {wd.active ? "Aktivní" : "Pozastaveno"}
                      </span>
                      {(wd.match_count ?? 0) > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-light">
                          {wd.match_count} výsledků
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {wd.category && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-border">
                          {CATEGORIES.find(c => c.value === wd.category)?.label || wd.category}
                        </span>
                      )}
                      {wd.location && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-border">
                          📍 {wd.location}
                        </span>
                      )}
                      {(wd.price_min || wd.price_max) && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-border">
                          {wd.price_min ? formatPrice(wd.price_min) : "0"} – {wd.price_max ? formatPrice(wd.price_max) : "∞"}
                        </span>
                      )}
                      {(wd.area_min || wd.area_max) && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-border">
                          {wd.area_min || 0}–{wd.area_max || "∞"} m²
                        </span>
                      )}
                      {!!wd.watch_new && <span className="text-xs px-2 py-0.5 rounded-md bg-green-500/10 text-green-400">Nové</span>}
                      {!!wd.watch_drops && <span className="text-xs px-2 py-0.5 rounded-md bg-red-500/10 text-red-400">Poklesy ≥{wd.watch_drops_min_pct}%</span>}
                      {!!wd.watch_underpriced && <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400">Pod cenou ≥{wd.watch_underpriced_pct}%</span>}
                      {!!wd.watch_returned && <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400">Vrácené</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleShowMatches(wd.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/30 transition-colors">
                      {selectedWd === wd.id ? "Skrýt" : "Výsledky"}
                    </button>
                    <button onClick={() => handleEdit(wd)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/30 transition-colors">
                      Upravit
                    </button>
                    <button id={`scan-btn-${wd.id}`} onClick={() => handleScan(wd.id)}
                      className="rounded-lg border border-accent/20 px-3 py-1.5 text-xs text-accent-light hover:bg-accent/10 transition-colors">
                      Prohledat DB
                    </button>
                    <button onClick={() => handleToggle(wd.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${wd.active ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" : "border-green-500/30 text-green-400 hover:bg-green-500/10"}`}>
                      {wd.active ? "Pozastavit" : "Aktivovat"}
                    </button>
                    <button onClick={() => handleDelete(wd.id)}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                      Smazat
                    </button>
                  </div>
                </div>
              </div>

              {/* Matches panel */}
              {selectedWd === wd.id && (
                <div className="mt-2 rounded-2xl border border-border/50 bg-card/50 p-5">
                  <h4 className="text-sm font-semibold mb-3">Výsledky ({matchesTotal})</h4>
                  {matchesLoading ? (
                    <p className="text-sm text-muted">Načítám...</p>
                  ) : matches.length === 0 ? (
                    <p className="text-sm text-muted">Zatím žádné výsledky. Hlídací pes prověří nové inzeráty při dalším scanu.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {matches.map(m => {
                          const detail = m.match_detail ? JSON.parse(m.match_detail) : {};
                          const mt = MATCH_LABELS[m.match_type] || { label: m.match_type, color: "text-muted" };
                          return (
                            <div key={m.id} className="flex items-center gap-4 rounded-xl border border-border/50 bg-background p-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${mt.color}`}
                                style={{ backgroundColor: "color-mix(in srgb, currentColor 10%, transparent)" }}>
                                {mt.label}
                              </span>
                              <div className="flex-1 min-w-0">
                                <a href={m.url || `/listing/${m.listing_id}`}
                                  className="text-sm font-medium hover:text-accent-light transition-colors truncate block">
                                  {m.title || m.listing_id}
                                </a>
                                <span className="text-xs text-muted">
                                  {m.location || "—"} · {formatPrice(m.price)}{m.area_m2 ? ` · ${m.area_m2} m²` : ""}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                {m.match_type === "drop" && detail.drop_pct && (
                                  <span className="text-sm font-bold text-red-400">-{detail.drop_pct.toFixed(1)}%</span>
                                )}
                                {m.match_type === "underpriced" && detail.diff_pct && (
                                  <span className="text-sm font-bold text-amber-400">{detail.diff_pct.toFixed(1)}% pod Ø</span>
                                )}
                                <div className="text-xs text-muted">{new Date(m.created_at).toLocaleDateString("cs-CZ")}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {matchesTotal > 30 && (
                        <div className="flex justify-center gap-2 mt-4">
                          <button disabled={matchesPage <= 1} onClick={() => fetchMatches(wd.id, matchesPage - 1)}
                            className="rounded border border-border px-3 py-1 text-xs disabled:opacity-30">Předchozí</button>
                          <span className="text-xs text-muted py-1">{matchesPage} / {Math.ceil(matchesTotal / 30)}</span>
                          <button disabled={matchesPage >= Math.ceil(matchesTotal / 30)} onClick={() => fetchMatches(wd.id, matchesPage + 1)}
                            className="rounded border border-border px-3 py-1 text-xs disabled:opacity-30">Další</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
