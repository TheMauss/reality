"use client";

interface Stats {
  totalListings: number;
  totalDrops: number;
  avgDrop: number;
  categories: { category: string; count: number }[];
}

export default function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      label: "Nemovitostí",
      value: stats.totalListings.toLocaleString("cs-CZ"),
      icon: "🏠",
    },
    {
      label: "Cenových propadů",
      value: stats.totalDrops.toLocaleString("cs-CZ"),
      icon: "📉",
    },
    {
      label: "Průměrný propad",
      value: `${stats.avgDrop.toFixed(1)}%`,
      icon: "📊",
    },
    {
      label: "Kategorií",
      value: stats.categories.length.toString(),
      icon: "🏷️",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="mb-2 text-2xl">{card.icon}</div>
          <div className="text-2xl font-bold">{card.value}</div>
          <div className="mt-1 text-sm text-muted">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
