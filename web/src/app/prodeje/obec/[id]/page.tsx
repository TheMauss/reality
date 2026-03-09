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
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  return res.json();
}

function formatNum(n: number | null | undefined): string {
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
    id: number;
    name: string;
    avg_price_m2: number;
    transactions: number;
    price_change: number | null;
    district_name: string;
    district_id: number;
    region_name: string;
    region_id: number;
  };
  const transactions: Transaction[] = data.transactions || [];
  const districtAskingM2: number | null = data.district_asking_m2 ?? null;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/prodeje" className="hover:text-foreground">
          Prodeje
        </Link>
        <span>/</span>
        <Link
          href={`/prodeje/kraj/${ward.region_id}`}
          className="hover:text-foreground"
        >
          {ward.region_name}
        </Link>
        <span>/</span>
        <Link
          href={`/prodeje/okres/${ward.district_id}`}
          className="hover:text-foreground"
        >
          {ward.district_name}
        </Link>
        <span>/</span>
        <span className="text-foreground">{ward.name}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{ward.name}</h1>
        <p className="mt-1 text-muted">
          {ward.district_name} · {ward.region_name}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-green">
            {formatNum(ward.avg_price_m2)}
          </div>
          <div className="mt-1 text-sm text-muted">Posl. prodejní Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-accent-light">
            {formatNum(districtAskingM2)}
          </div>
          <div className="mt-1 text-sm text-muted">Nabídková Kč/m² (okres)</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">{transactions.length}</div>
          <div className="mt-1 text-sm text-muted">Transakcí</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          {ward.price_change !== null ? (
            <div
              className={`text-2xl font-bold ${ward.price_change >= 0 ? "text-green" : "text-red"}`}
            >
              {ward.price_change >= 0 ? "+" : ""}
              {ward.price_change.toFixed(1)}%
            </div>
          ) : (
            <div className="text-2xl font-bold text-muted">—</div>
          )}
          <div className="mt-1 text-sm text-muted">Změna ceny</div>
        </div>
      </div>

      {/* Transactions list */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Jednotlivé transakce ({transactions.length})
        </h2>
        {transactions.length === 0 ? (
          <p className="text-muted">Žádné transakce.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Typ</th>
                  <th className="pb-2 font-medium">Adresa</th>
                  <th className="pb-2 font-medium">Datum prodeje</th>
                  <th className="pb-2 text-right font-medium">
                    Prům. Kč/m² (oblast)
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="py-2.5">{t.title}</td>
                    <td className="py-2.5">{t.address}</td>
                    <td className="py-2.5">
                      {new Date(t.validation_date).toLocaleDateString("cs-CZ", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-2.5 text-right text-green">
                      {formatNum(t.ward_avg_price_m2)} Kč/m²
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
