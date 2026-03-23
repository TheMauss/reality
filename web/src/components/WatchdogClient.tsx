"use client";

import React, { useState, useEffect, useCallback } from "react";

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

interface WatchdogForm {
  name: string;
  category: string;
  location: string;
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getUserId(): number {
  // Simple localStorage-based user ID for demo
  let id = localStorage.getItem("watchdog_user_id");
  if (!id) {
    id = "1"; // Default user
    localStorage.setItem("watchdog_user_id", id);
  }
  return parseInt(id, 10);
}

function formatPrice(p: number | null): string {
  if (!p) return "—";
  return p.toLocaleString("cs-CZ") + " Kč";
}

// ── Component ────────────────────────────────────────────────────────────────

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
    } catch (err) {
      console.error("Failed to fetch watchdogs:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchWatchdogs();
  }, [fetchWatchdogs]);

  const fetchMatches = useCallback(async (wdId: number, page = 1) => {
    setMatchesLoading(true);
    try {
      const res = await fetch(`/api/watchdogs/${wdId}/matches?page=${page}`);
      const data = await res.json();
      setMatches(data.matches || []);
      setMatchesTotal(data.total || 0);
      setMatchesPage(page);
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const body = {
      user_id: userId,
      name: form.name,
      category: form.category || null,
      location: form.location || null,
      price_min: form.price_min ? parseInt(form.price_min) : null,
      price_max: form.price_max ? parseInt(form.price_max) : null,
      area_min: form.area_min ? parseFloat(form.area_min) : null,
      area_max: form.area_max ? parseFloat(form.area_max) : null,
      keywords: form.keywords
        ? form.keywords.split(",").map((s) => s.trim()).filter(Boolean)
        : null,
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
    const method = editId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

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
    if (selectedWd === id) {
      setSelectedWd(null);
      setMatches([]);
    }
    fetchWatchdogs();
  }

  function handleEdit(wd: Watchdog) {
    const kw = wd.keywords ? JSON.parse(wd.keywords) : [];
    setForm({
      name: wd.name,
      category: wd.category || "",
      location: wd.location || "",
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

  function handleShowMatches(wdId: number) {
    if (selectedWd === wdId) {
      setSelectedWd(null);
      setMatches([]);
      return;
    }
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
          onClick={() => {
            setForm(EMPTY_FORM);
            setEditId(null);
            setShowForm(!showForm);
          }}
          className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent-light hover:bg-accent/20 transition-colors"
        >
          + Nový hlídací pes
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 space-y-5"
        >
          <h2 className="text-lg font-semibold">
            {editId ? "Upravit hlídacího psa" : "Nový hlídací pes"}
          </h2>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted">Název</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="např. Byty Praha do 5M"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Filters grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted">Kategorie</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted">Lokalita</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Praha, Brno, ..."
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted">Klíčová slova</label>
              <input
                type="text"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="balkon, garáž, zahrada"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted">Cena od</label>
              <input
                type="number"
                value={form.price_min}
                onChange={(e) => setForm({ ...form, price_min: e.target.value })}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted">Cena do</label>
              <input
                type="number"
                value={form.price_max}
                onChange={(e) => setForm({ ...form, price_max: e.target.value })}
                placeholder="neomezeno"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted">m² od</label>
                <input
                  type="number"
                  value={form.area_min}
                  onChange={(e) => setForm({ ...form, area_min: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">m² do</label>
                <input
                  type="number"
                  value={form.area_max}
                  onChange={(e) => setForm({ ...form, area_max: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Watch types */}
          <div>
            <label className="text-xs font-medium text-muted block mb-2">
              Co sledovat
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch_new}
                  onChange={(e) => setForm({ ...form, watch_new: e.target.checked })}
                  className="accent-green-500"
                />
                Nové inzeráty
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch_drops}
                  onChange={(e) => setForm({ ...form, watch_drops: e.target.checked })}
                  className="accent-red-500"
                />
                Cenové poklesy
              </label>
              {form.watch_drops && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted">min</span>
                  <input
                    type="number"
                    value={form.watch_drops_min_pct}
                    onChange={(e) =>
                      setForm({ ...form, watch_drops_min_pct: e.target.value })
                    }
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-center"
                  />
                  <span className="text-muted">%</span>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch_underpriced}
                  onChange={(e) =>
                    setForm({ ...form, watch_underpriced: e.target.checked })
                  }
                  className="accent-amber-500"
                />
                Pod tržní cenou
              </label>
              {form.watch_underpriced && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted">min</span>
                  <input
                    type="number"
                    value={form.watch_underpriced_pct}
                    onChange={(e) =>
                      setForm({ ...form, watch_underpriced_pct: e.target.value })
                    }
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-center"
                  />
                  <span className="text-muted">% pod průměrem</span>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch_returned}
                  onChange={(e) =>
                    setForm({ ...form, watch_returned: e.target.checked })
                  }
                  className="accent-blue-500"
                />
                Vrácené inzeráty
              </label>
            </div>
          </div>

          {/* Notifications */}
          <div>
            <label className="text-xs font-medium text-muted block mb-2">
              Notifikace
            </label>
            <div className="flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.notify_email}
                  onChange={(e) =>
                    setForm({ ...form, notify_email: e.target.checked })
                  }
                />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.notify_telegram}
                  onChange={(e) =>
                    setForm({ ...form, notify_telegram: e.target.checked })
                  }
                />
                Telegram
              </label>
              <select
                value={form.notify_frequency}
                onChange={(e) =>
                  setForm({ ...form, notify_frequency: e.target.value })
                }
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              >
                <option value="instant">Okamžitě</option>
                <option value="daily">Denní souhrn</option>
                <option value="weekly">Týdenní souhrn</option>
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent/80 transition-colors"
            >
              {editId ? "Uložit změny" : "Vytvořit"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              className="rounded-xl border border-border px-5 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
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
          <p className="text-muted">
            Zatím nemáte žádného hlídacího psa. Vytvořte si prvního!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {watchdogs.map((wd) => (
            <div key={wd.id}>
              <div
                className={`rounded-2xl border p-5 transition-colors ${
                  wd.active
                    ? "border-border bg-card"
                    : "border-border/50 bg-card/50 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold truncate">
                        {wd.name}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          wd.active
                            ? "bg-green-500/10 text-green-400"
                            : "bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {wd.active ? "Aktivní" : "Pozastaveno"}
                      </span>
                      {(wd.match_count ?? 0) > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-light">
                          {wd.match_count} výsledků
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {wd.category && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-border">
                          {CATEGORIES.find((c) => c.value === wd.category)?.label || wd.category}
                        </span>
                      )}
                      {wd.location && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-border">
                          📍 {wd.location}
                        </span>
                      )}
                      {wd.price_min || wd.price_max ? (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-border">
                          {wd.price_min ? formatPrice(wd.price_min) : "0"} –{" "}
                          {wd.price_max ? formatPrice(wd.price_max) : "∞"}
                        </span>
                      ) : null}
                      {wd.area_min || wd.area_max ? (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-border">
                          {wd.area_min || 0}–{wd.area_max || "∞"} m²
                        </span>
                      ) : null}
                      {wd.watch_new ? (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-green-500/10 text-green-400">
                          Nové
                        </span>
                      ) : null}
                      {wd.watch_drops ? (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-red-500/10 text-red-400">
                          Poklesy ≥{wd.watch_drops_min_pct}%
                        </span>
                      ) : null}
                      {wd.watch_underpriced ? (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400">
                          Pod cenou ≥{wd.watch_underpriced_pct}%
                        </span>
                      ) : null}
                      {wd.watch_returned ? (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400">
                          Vrácené
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleShowMatches(wd.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/30 transition-colors"
                    >
                      {selectedWd === wd.id ? "Skrýt" : "Výsledky"}
                    </button>
                    <button
                      onClick={() => handleEdit(wd)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/30 transition-colors"
                    >
                      Upravit
                    </button>
                    <button
                      onClick={() => handleToggle(wd.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                        wd.active
                          ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                          : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                      }`}
                    >
                      {wd.active ? "Pozastavit" : "Aktivovat"}
                    </button>
                    <button
                      onClick={() => handleDelete(wd.id)}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Smazat
                    </button>
                  </div>
                </div>
              </div>

              {/* Matches panel */}
              {selectedWd === wd.id && (
                <div className="mt-2 rounded-2xl border border-border/50 bg-card/50 p-5">
                  <h4 className="text-sm font-semibold mb-3">
                    Výsledky ({matchesTotal})
                  </h4>

                  {matchesLoading ? (
                    <p className="text-sm text-muted">Načítám...</p>
                  ) : matches.length === 0 ? (
                    <p className="text-sm text-muted">
                      Zatím žádné výsledky. Hlídací pes prověří nové inzeráty při dalším scanu.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {matches.map((m) => {
                          const detail = m.match_detail
                            ? JSON.parse(m.match_detail)
                            : {};
                          const mt = MATCH_LABELS[m.match_type] || {
                            label: m.match_type,
                            color: "text-muted",
                          };

                          return (
                            <div
                              key={m.id}
                              className="flex items-center gap-4 rounded-xl border border-border/50 bg-background p-3"
                            >
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-md ${mt.color} bg-current/10`}
                                style={{
                                  backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)`,
                                }}
                              >
                                {mt.label}
                              </span>

                              <div className="flex-1 min-w-0">
                                <a
                                  href={m.url || `/listing/${m.listing_id}`}
                                  className="text-sm font-medium hover:text-accent-light transition-colors truncate block"
                                >
                                  {m.title || m.listing_id}
                                </a>
                                <span className="text-xs text-muted">
                                  {m.location || "—"} ·{" "}
                                  {formatPrice(m.price)}
                                  {m.area_m2 ? ` · ${m.area_m2} m²` : ""}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                {m.match_type === "drop" && detail.drop_pct && (
                                  <span className="text-sm font-bold text-red-400">
                                    -{detail.drop_pct.toFixed(1)}%
                                  </span>
                                )}
                                {m.match_type === "underpriced" &&
                                  detail.diff_pct && (
                                    <span className="text-sm font-bold text-amber-400">
                                      {detail.diff_pct.toFixed(1)}% pod Ø
                                    </span>
                                  )}
                                <div className="text-xs text-muted">
                                  {new Date(m.created_at).toLocaleDateString(
                                    "cs-CZ"
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination */}
                      {matchesTotal > 30 && (
                        <div className="flex justify-center gap-2 mt-4">
                          <button
                            disabled={matchesPage <= 1}
                            onClick={() => fetchMatches(wd.id, matchesPage - 1)}
                            className="rounded border border-border px-3 py-1 text-xs disabled:opacity-30"
                          >
                            Předchozí
                          </button>
                          <span className="text-xs text-muted py-1">
                            {matchesPage} / {Math.ceil(matchesTotal / 30)}
                          </span>
                          <button
                            disabled={matchesPage >= Math.ceil(matchesTotal / 30)}
                            onClick={() => fetchMatches(wd.id, matchesPage + 1)}
                            className="rounded border border-border px-3 py-1 text-xs disabled:opacity-30"
                          >
                            Další
                          </button>
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
