"use client";

interface Stats {
  totalListings: number;
  totalDrops: number;
  avgDrop: number;
  categories: { category: string; count: number }[];
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("cs-CZ");
}

export default function StatsCards({ stats }: { stats: Stats }) {
  const items = [
    { value: fmt(stats.totalListings), label: "Aktivních inzerátů", color: "text-foreground" },
    { value: fmt(stats.totalDrops), label: "Cenových propadů", color: "text-red" },
    { value: `${stats.avgDrop.toFixed(1)}%`, label: "Průměrný propad", color: "text-amber" },
    { value: (stats.categories?.length ?? 0).toString(), label: "Kategorií", color: "text-accent-light" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="bg-surface-1 px-5 py-4 animate-fade-up"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <div className={`text-2xl font-semibold tracking-tight tabular-nums ${item.color}`}>
            {item.value}
          </div>
          <div className="text-[12px] text-text-tertiary mt-1">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
