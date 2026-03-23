"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

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
  category: string;
  location: string;
  locationLabel: string;
  district_id: number | null;
  region_id: number | null;
  avg_price_m2: number | null;
  price_min: string;
  price_max: string;
  area_min: string;
  area_max: string;
  keywords: string;
  watch_new: boolean;
  watch_drops: boolean;
  watch_drops_min_pct: string;
  watch_underpriced: boolean;
  watch_underpriced_pct: string;
  watch_returned: boolean;
  notify_email: boolean;
  notify_telegram: boolean;
  notify_frequency: string;
}

const EMPTY_FORM: WatchdogForm = {
  name: "",
  category: "",
  location: "",
  locationLabel: "",
  district_id: null,
  region_id: null,
  avg_price_m2: null,
  price_min: "",
  price_max: "",
  area_min: "",
  area_max: "",
  keywords: "",
  watch_new: true,
  watch_drops: false,
  watch_drops_min_pct: "5",
  watch_underpriced: false,
  watch_underpriced_pct: "15",
  watch_returned: false,
  notify_email: true,
  notify_telegram: false,
  notify_frequency: "instant",
};

const CATEGORIES = [
  { value: "", label: "Vše" },
  { value: "byty-prodej", label: "Byty - prodej" },
  { value: "byty-najem", label: "Byty - pronájem" },
  { value: "domy-prodej", label: "Domy - prodej" },
  { value: "domy-najem", label: "Domy - pronájem" },
  { value: "pozemky-prodej", label: "Pozemky" },
  { value: "komercni-prodej", label: "Komerční" },
];

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

function getUserId(): number {
  let id = localStorage.getItem("watchdog_user_id");
  if (!id) { id = "1"; localStorage.setItem("watchdog_user_id", id); }
  return parseInt(id, 10);
}

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

  const userId = typeof window !== "undefined" ? getUserId() : 1;

  const fetchWatchdogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/watchdogs?user_id=${userId}`);
      const data = await res.json();
      setWatchdogs(data.watchdogs || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchWatchdogs(); }, [fetchWatchdogs]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      user_id: userId,
      name: form.name,
      category: form.category || null,
      location: form.location || null,
      district_id: form.district_id,
      region_id: form.region_id,
      price_min: form.price_min ? parseInt(form.price_min) : null,
      price_max: form.price_max ? parseInt(form.price_max) : null,
      area_min: form.area_min ? parseFloat(form.area_min) : null,
      area_max: form.area_max ? parseFloat(form.area_max) : null,
      keywords: form.keywords ? form.keywords.split(",").map(s => s.trim()).filter(Boolean) : null,
      watch_new: form.watch_new ? 1 : 0,
      watch_drops: form.watch_drops ? 1 : 0,
      watch_drops_min_pct: parseFloat(form.watch_drops_min_pct) || 5,
      watch_underpriced: form.watch_underpriced ? 1 : 0,
      watch_underpriced_pct: parseFloat(form.watch_underpriced_pct) || 15,
      watch_returned: form.watch_returned ? 1 : 0,
      notify_email: form.notify_email ? 1 : 0,
      notify_telegram: form.notify_telegram ? 1 : 0,
      notify_frequency: form.notify_frequency,
    };
    const url = editId ? `/api/watchdogs/${editId}` : "/api/watchdogs";
    await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    fetchWatchdogs();
  }

  async function handleToggle(id: number) {
    await fetch(`/api/watchdogs/${id}`, { method: "PATCH" });
    fetchWatchdogs();
  }

  async function handleDelete(id: number) {
    if (!confirm("Opravdu smazat hlídacího psa?")) return;
    await fetch(`/api/watchdogs/${id}`, { method: "DELETE" });
    if (selectedWd === id) { setSelectedWd(null); setMatches([]); }
    fetchWatchdogs();
  }

  function handleEdit(wd: Watchdog) {
    const kw = wd.keywords ? JSON.parse(wd.keywords) : [];
    setForm({
      name: wd.name,
      category: wd.category || "",
      location: wd.location || "",
      locationLabel: wd.location || "",
      district_id: wd.district_id,
      region_id: wd.region_id,
      avg_price_m2: null,
      price_min: wd.price_min?.toString() || "",
      price_max: wd.price_max?.toString() || "",
      area_min: wd.area_min?.toString() || "",
      area_max: wd.area_max?.toString() || "",
      keywords: Array.isArray(kw) ? kw.join(", ") : "",
      watch_new: !!wd.watch_new,
      watch_drops: !!wd.watch_drops,
      watch_drops_min_pct: wd.watch_drops_min_pct?.toString() || "5",
      watch_underpriced: !!wd.watch_underpriced,
      watch_underpriced_pct: wd.watch_underpriced_pct?.toString() || "15",
      watch_returned: !!wd.watch_returned,
      notify_email: !!wd.notify_email,
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

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <h2 className="text-lg font-semibold">{editId ? "Upravit hlídacího psa" : "Nový hlídací pes"}</h2>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted">Název</label>
            <input type="text" required value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="např. Byty Praha do 5M"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Filters grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted">Kategorie</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Location search */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="text-xs font-medium text-muted">Lokalita</label>
              <div className="mt-1">
                <LocationSearch
                  value={form.locationLabel}
                  onSelect={handleLocationSelect}
                  onClear={handleLocationClear}
                />
              </div>

              {/* Avg price info badge */}
              {form.avg_price_m2 && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 shrink-0">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  <span className="text-xs text-muted">Průměrná prodejní cena v oblasti:</span>
                  <span className="text-xs font-bold text-amber-400">{formatAvg(form.avg_price_m2)}</span>
                  <span className="text-[10px] text-muted/60 ml-auto">(historické prodeje)</span>
                </div>
              )}
            </div>

            {/* Price range */}
            <div>
              <label className="text-xs font-medium text-muted">Cena od</label>
              <input type="number" value={form.price_min}
                onChange={e => setForm({ ...form, price_min: e.target.value })}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Cena do</label>
              <input type="number" value={form.price_max}
                onChange={e => setForm({ ...form, price_max: e.target.value })}
                placeholder="neomezeno"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Area range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted">m² od</label>
                <input type="number" value={form.area_min}
                  onChange={e => setForm({ ...form, area_min: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">m² do</label>
                <input type="number" value={form.area_max}
                  onChange={e => setForm({ ...form, area_max: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Keywords */}
            <div>
              <label className="text-xs font-medium text-muted">Klíčová slova</label>
              <input type="text" value={form.keywords}
                onChange={e => setForm({ ...form, keywords: e.target.value })}
                placeholder="balkon, garáž, zahrada"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          {/* Watch types */}
          <div>
            <label className="text-xs font-medium text-muted block mb-2">Co sledovat</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.watch_new}
                  onChange={e => setForm({ ...form, watch_new: e.target.checked })}
                  className="accent-green-500" />
                Nové inzeráty
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.watch_drops}
                  onChange={e => setForm({ ...form, watch_drops: e.target.checked })}
                  className="accent-red-500" />
                Cenové poklesy
              </label>
              {form.watch_drops && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted">min</span>
                  <input type="number" value={form.watch_drops_min_pct}
                    onChange={e => setForm({ ...form, watch_drops_min_pct: e.target.value })}
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-center" />
                  <span className="text-muted">%</span>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.watch_underpriced}
                  onChange={e => setForm({ ...form, watch_underpriced: e.target.checked })}
                  className="accent-amber-500" />
                Pod tržní cenou
              </label>
              {form.watch_underpriced && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted">min</span>
                  <input type="number" value={form.watch_underpriced_pct}
                    onChange={e => setForm({ ...form, watch_underpriced_pct: e.target.value })}
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-center" />
                  <span className="text-muted">% pod průměrem</span>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.watch_returned}
                  onChange={e => setForm({ ...form, watch_returned: e.target.checked })}
                  className="accent-blue-500" />
                Vrácené inzeráty
              </label>
            </div>
          </div>

          {/* Notifications */}
          <div>
            <label className="text-xs font-medium text-muted block mb-2">Notifikace</label>
            <div className="flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.notify_email}
                  onChange={e => setForm({ ...form, notify_email: e.target.checked })} />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.notify_telegram}
                  onChange={e => setForm({ ...form, notify_telegram: e.target.checked })} />
                Telegram
              </label>
              <select value={form.notify_frequency}
                onChange={e => setForm({ ...form, notify_frequency: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                <option value="instant">Okamžitě</option>
                <option value="daily">Denní souhrn</option>
                <option value="weekly">Týdenní souhrn</option>
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button type="submit"
              className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent/80 transition-colors">
              {editId ? "Uložit změny" : "Vytvořit"}
            </button>
            <button type="button"
              onClick={() => { setShowForm(false); setEditId(null); }}
              className="rounded-xl border border-border px-5 py-2 text-sm text-muted hover:text-foreground transition-colors">
              Zrušit
            </button>
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
