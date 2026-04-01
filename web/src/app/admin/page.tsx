"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";

const ADMIN_EMAIL = "mausmaraa@gmail.com";

interface User {
  id: number;
  email: string;
  telegram_id: string | null;
  created_at: string;
}

interface Watchdog {
  id: number;
  user_email: string;
  name: string;
  active: number;
  category: string | null;
  location: string | null;
  price_min: number | null;
  price_max: number | null;
  area_min: number | null;
  area_max: number | null;
  notify_telegram: number;
  notify_frequency: string;
  watch_new: number;
  watch_drops: number;
  watch_underpriced: number;
  watch_returned: number;
  match_count: number;
  created_at: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function Badge({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${on ? "bg-accent/20 text-accent-light" : "bg-border/40 text-muted/40"}`}>
      {label}
    </span>
  );
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [watchdogs, setWatchdogs] = useState<Watchdog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email === ADMIN_EMAIL) {
      fetch("/api/admin/watchdogs")
        .then(r => r.json())
        .then(d => { setUsers(d.users || []); setWatchdogs(d.watchdogs || []); })
        .finally(() => setLoading(false));
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [status, session]);

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center h-64 text-muted text-sm">Načítám…</div>;
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted text-sm">Přihlaste se pro přístup k adminu</p>
        <button onClick={() => signIn("google")} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-light transition-colors">
          Přihlásit přes Google
        </button>
      </div>
    );
  }

  if (session.user?.email !== ADMIN_EMAIL) {
    return <div className="flex items-center justify-center h-64 text-muted text-sm">Přístup odepřen.</div>;
  }

  const tgConnected = users.filter(u => u.telegram_id).length;
  const activeWds = watchdogs.filter(w => w.active).length;
  const totalMatches = watchdogs.reduce((s, w) => s + (w.match_count || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-muted mt-1">{session.user.email}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Uživatelů", value: users.length },
          { label: "TG propojeno", value: tgConnected },
          { label: "Hlídacích psů", value: watchdogs.length },
          { label: "Aktivních", value: activeWds },
          { label: "Celkem shod", value: totalMatches },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <div className="text-2xl font-bold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Users */}
      <div>
        <h2 className="text-base font-semibold mb-3">Uživatelé ({users.length})</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-left font-medium">Telegram</th>
                <th className="px-4 py-2.5 text-left font-medium">Psi</th>
                <th className="px-4 py-2.5 text-left font-medium">Registrace</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const wds = watchdogs.filter(w => w.user_email === u.email);
                return (
                  <tr key={u.id} className="border-b border-border/40 last:border-0 hover:bg-card-hover transition-colors">
                    <td className="px-4 py-2.5 font-medium">{u.email}</td>
                    <td className="px-4 py-2.5">
                      {u.telegram_id
                        ? <span className="text-green font-mono text-xs">{u.telegram_id}</span>
                        : <span className="text-muted/40 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{wds.length}</td>
                    <td className="px-4 py-2.5 text-muted text-xs">{fmtDate(u.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Watchdogs */}
      <div>
        <h2 className="text-base font-semibold mb-3">Hlídací psi ({watchdogs.length})</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-4 py-2.5 text-left font-medium">Uživatel</th>
                <th className="px-4 py-2.5 text-left font-medium">Název</th>
                <th className="px-4 py-2.5 text-left font-medium">Filtry</th>
                <th className="px-4 py-2.5 text-left font-medium">Sleduje</th>
                <th className="px-4 py-2.5 text-left font-medium">Shody</th>
                <th className="px-4 py-2.5 text-left font-medium">Stav</th>
                <th className="px-4 py-2.5 text-left font-medium">Vytvořen</th>
              </tr>
            </thead>
            <tbody>
              {watchdogs.map(w => (
                <tr key={w.id} className="border-b border-border/40 last:border-0 hover:bg-card-hover transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted max-w-[140px] truncate">{w.user_email}</td>
                  <td className="px-4 py-2.5 font-medium max-w-[160px] truncate">{w.name}</td>
                  <td className="px-4 py-2.5 text-xs text-muted max-w-[160px]">
                    {[w.category, w.location, w.price_min && `od ${(w.price_min/1e6).toFixed(1)}M`, w.price_max && `do ${(w.price_max/1e6).toFixed(1)}M`].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge on={!!w.watch_new} label="Nové" />
                      <Badge on={!!w.watch_drops} label="Pokles" />
                      <Badge on={!!w.watch_underpriced} label="Pod Ø" />
                      <Badge on={!!w.watch_returned} label="Vrácené" />
                      <Badge on={!!w.notify_telegram} label="TG" />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-bold text-accent-light">{w.match_count}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${w.active ? "bg-green-dim text-green" : "bg-border/40 text-muted"}`}>
                      {w.active ? "Aktivní" : "Pozastavený"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{fmtDate(w.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
