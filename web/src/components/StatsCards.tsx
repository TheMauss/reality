"use client";

interface Stats {
  totalListings: number;
  totalDrops: number;
  avgDrop: number;
  categories: { category: string; count: number }[];
}

const STAT_CONFIGS = [
  {
    key: "totalListings" as keyof Stats,
    label: "Sledovaných nemovitostí",
    color: "text-accent-light",
    bgGlow: "bg-accent/5",
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    key: "totalDrops" as keyof Stats,
    label: "Detekovaných propadů",
    color: "text-red",
    bgGlow: "bg-red/5",
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    key: "avgDrop" as keyof Stats,
    label: "Průměrný propad",
    color: "text-amber-400",
    bgGlow: "bg-amber-400/5",
    isPercent: true,
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    key: "categories" as keyof Stats,
    label: "Typů nemovitostí",
    color: "text-green",
    bgGlow: "bg-green/5",
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
];

export default function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {STAT_CONFIGS.map((cfg) => {
        const raw = stats[cfg.key];
        const value =
          cfg.isPercent
            ? `${(raw as number).toFixed(1)}%`
            : Array.isArray(raw)
            ? raw.length.toString()
            : (raw as number).toLocaleString("cs-CZ");

        return (
          <div key={cfg.label} className={`relative rounded-xl border border-border bg-card p-5 overflow-hidden`}>
            <div className={`absolute inset-0 ${cfg.bgGlow} opacity-0 group-hover:opacity-100`} />
            <div className={`mb-3 inline-flex rounded-lg border border-border/60 bg-background p-2 ${cfg.color}`}>
              {cfg.svg}
            </div>
            <div className={`text-2xl font-bold ${cfg.color}`}>{value}</div>
            <div className="mt-1 text-xs text-muted">{cfg.label}</div>
          </div>
        );
      })}
    </div>
  );
}
