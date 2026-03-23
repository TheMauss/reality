"use client";

interface Stats {
  totalListings: number;
  totalDrops: number;
  avgDrop: number;
  categories: { category: string; count: number }[];
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

const STATS = [
  {
    key: "totalListings" as keyof Stats,
    label: "Sledovaných nemovitostí",
    sublabel: "aktivních inzerátů",
    accent: "#818CF8",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    key: "totalDrops" as keyof Stats,
    label: "Propadů cen",
    sublabel: "detekovaných celkem",
    accent: "#F43F5E",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
        <polyline points="17 18 23 18 23 12"/>
      </svg>
    ),
  },
  {
    key: "avgDrop" as keyof Stats,
    label: "Průměrný propad",
    sublabel: "snížení ceny",
    accent: "#F59E0B",
    isPercent: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    key: "categories" as keyof Stats,
    label: "Typů nemovitostí",
    sublabel: "kategorií na trhu",
    accent: "#10B981",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
];

export default function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {STATS.map((cfg) => {
        const raw = stats[cfg.key];
        const value = cfg.isPercent
          ? `${(raw as number).toFixed(1)}%`
          : Array.isArray(raw)
          ? raw.length.toString()
          : formatCompact(raw as number);

        return (
          <div key={cfg.label}
            className="relative rounded-2xl border border-border bg-card p-5 overflow-hidden group hover:border-border-light transition-colors">
            {/* Glow */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: `radial-gradient(circle at 0 0, ${cfg.accent}08, transparent 60%)` }} />

            <div className="relative">
              {/* Icon */}
              <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/60"
                style={{ color: cfg.accent }}>
                {cfg.icon}
              </div>

              {/* Value */}
              <div className="text-3xl font-bold tracking-tight tabular-nums" style={{ color: cfg.accent }}>
                {value}
              </div>

              {/* Label */}
              <div className="mt-1 text-[13px] font-medium text-foreground/80">{cfg.label}</div>
              <div className="text-[11px] text-muted mt-0.5">{cfg.sublabel}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
