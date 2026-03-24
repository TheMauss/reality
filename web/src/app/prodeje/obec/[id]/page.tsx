import { notFound } from "next/navigation";
import Link from "next/link";

interface Transaction {
  id: number;
  title: string;
  validation_date: string;
  lat: number;
  lon: number;
  address: string;
  municipality: string;
  ward_name: string;
  ward_avg_price_m2: number;
}

async function fetchJSON(path: string) {
  const { baseUrl } = await import("@/lib/base-url");
  const base = await baseUrl();
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  return res.json();
}

function fmt(n: number | null | undefined): string {
  if (!n) return "—";
  return Math.round(n).toLocaleString("cs-CZ");
}

export default async function ObecPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchJSON(`/api/sold/transactions?ward_id=${id}`);

  if (!data.ward) notFound();

  const ward = data.ward as {
    id: number; name: string; avg_price_m2: number; transactions: number;
    price_change: number | null; district_name: string; district_id: number;
    region_name: string; region_id: number;
  };
  const transactions: Transaction[] = data.transactions || [];
  const districtAskingM2: number | null = data.district_asking_m2 ?? null;

  const spread = districtAskingM2 && ward.avg_price_m2
    ? (((districtAskingM2 - ward.avg_price_m2) / ward.avg_price_m2) * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link href="/prodeje" className="hover:text-foreground transition-colors">Prodeje</Link>
        <span className="text-border">›</span>
        <Link href={`/prodeje/kraj/${ward.region_id}`} className="hover:text-foreground transition-colors">
          {ward.region_name}
        </Link>
        <span className="text-border">›</span>
        <Link href={`/prodeje/okres/${ward.district_id}`} className="hover:text-foreground transition-colors">
          {ward.district_name}
        </Link>
        <span className="text-border">›</span>
        <span className="text-foreground font-medium">{ward.name}</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{ward.name}</h1>
        <p className="mt-1 text-sm text-muted">{ward.district_name} · {ward.region_name}</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Průměrná prodejní</div>
          <div className="text-xl font-bold text-green">{fmt(ward.avg_price_m2)}</div>
          <div className="text-xs text-muted mt-0.5">Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Nabídková (okres)</div>
          <div className="text-xl font-bold text-accent-light">{fmt(districtAskingM2)}</div>
          <div className="text-xs text-muted mt-0.5">Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Spread</div>
          <div className={`text-xl font-bold ${spread && spread > 15 ? "text-red" : "text-amber-400"}`}>
            {spread != null ? `+${spread.toFixed(1)}%` : "—"}
          </div>
          <div className="text-xs text-muted mt-0.5">nabídka vs prodej</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Transakcí</div>
          <div className="text-xl font-bold">{transactions.length}</div>
          <div className="text-xs text-muted mt-0.5">
            {ward.price_change !== null ? (
              <span className={ward.price_change >= 0 ? "text-green" : "text-red"}>
                {ward.price_change >= 0 ? "↑ +" : "↓ "}{ward.price_change.toFixed(1)}% změna
              </span>
            ) : "v databázi"}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Záznamy prodejů ({transactions.length})</h2>
          <p className="text-xs text-muted mt-0.5">Data z katastru nemovitostí · prům. cena za katastrální území</p>
        </div>
        {transactions.length === 0 ? (
          <div className="p-12 text-center text-muted">Žádné transakce.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-6 py-3 font-medium text-muted text-xs uppercase tracking-wider">Typ</th>
                  <th className="px-6 py-3 font-medium text-muted text-xs uppercase tracking-wider">Adresa / obec</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider text-right">Datum prodeje</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider text-right">Prům. Kč/m² (oblast)</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border/40 hover:bg-background/60 transition-colors">
                    <td className="px-6 py-3">
                      <span className="inline-block px-2 py-0.5 rounded bg-card-hover text-xs font-medium">
                        {t.title}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium">{t.address || t.municipality}</div>
                      {t.ward_name && t.ward_name !== t.municipality && (
                        <div className="text-xs text-muted">{t.ward_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {new Date(t.validation_date).toLocaleDateString("cs-CZ", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-green">{fmt(t.ward_avg_price_m2)}</span>
                      <span className="text-xs text-muted ml-1">Kč/m²</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
