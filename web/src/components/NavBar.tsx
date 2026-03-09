"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// ── SVG Icons ──────────────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function IconHouseGarden() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
      <path d="M12 22v-4"/>
      <path d="M8 22c0-2 1-3 2-4"/>
    </svg>
  );
}

function IconPlot() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18M9 21V9"/>
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5"/>
      <path d="M21 2l-9.6 9.6M15.5 7.5l3 3"/>
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
      <line x1="8" y1="2" x2="8" y2="18"/>
      <line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  );
}

function IconTrendDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
      <polyline points="17 18 23 18 23 12"/>
    </svg>
  );
}

// ── Nav data ────────────────────────────────────────────────────────────────

const NAKUP = [
  { label: "Prodej bytů",  href: "/inzerce?category=byty-prodej&sort=newest",    Icon: IconHome,       desc: "Byty a apartmány" },
  { label: "Prodej domů",  href: "/inzerce?category=domy-prodej&sort=newest",    Icon: IconHouseGarden, desc: "Rodinné domy a vily" },
  { label: "Pozemky",      href: "/inzerce?category=pozemky-prodej&sort=newest", Icon: IconPlot,       desc: "Stavební pozemky" },
  { label: "Nejnovější",   href: "/inzerce?sort=newest",                          Icon: IconSparkle,    desc: "Právě přidáno" },
];

const PRONAJEM = [
  { label: "Pronájem bytů", href: "/inzerce?category=byty-najem&sort=newest", Icon: IconKey,        desc: "Byty a pokoje" },
  { label: "Pronájem domů", href: "/inzerce?category=domy-najem&sort=newest", Icon: IconHouseGarden, desc: "Domy a chalupy" },
  { label: "Nejnovější",    href: "/inzerce?category=byty-najem&sort=newest", Icon: IconSparkle,    desc: "Nové nabídky" },
];

// ── Dropdown ────────────────────────────────────────────────────────────────

function Dropdown({
  items,
}: {
  items: { label: string; href: string; Icon: () => React.ReactElement; desc: string }[];
}) {
  return (
    <div className="absolute left-0 top-full pt-2.5 z-50 min-w-[230px]">
      <div className="rounded-2xl border border-border/80 bg-card shadow-2xl shadow-black/60 overflow-hidden">
        <div className="p-1.5 space-y-0.5">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-card-hover group"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted group-hover:text-accent-light group-hover:border-accent/30 transition-colors">
                <item.Icon />
              </span>
              <div>
                <div className="text-sm font-semibold text-foreground group-hover:text-accent-light transition-colors">
                  {item.label}
                </div>
                <div className="text-xs text-muted">{item.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── NavDropdown ─────────────────────────────────────────────────────────────

function NavDropdown({
  label,
  href,
  items,
  isActive,
}: {
  label: string;
  href: string;
  items: { label: string; href: string; Icon: () => React.ReactElement; desc: string }[];
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => { if (timer.current) clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = setTimeout(() => setOpen(false), 120); };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <a
        href={href}
        className={`relative flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
          isActive ? "text-foreground" : "text-muted hover:text-foreground"
        }`}
      >
        {label}
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`opacity-50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {isActive && (
          <span className="absolute inset-x-2 -bottom-[11px] h-px rounded-full bg-accent-light/60" />
        )}
      </a>
      {open && <Dropdown items={items} />}
    </div>
  );
}

// ── NavBar ───────────────────────────────────────────────────────────────────

export default function NavBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "";
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    function read() {
      try {
        const arr: string[] = JSON.parse(localStorage.getItem("saved_listings") || "[]");
        setSavedCount(arr.length);
      } catch { /* ignore */ }
    }
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  const onInzerce = pathname.startsWith("/inzerce");
  const isNajem   = onInzerce && category.includes("najem");
  const isNakup   = onInzerce && !isNajem;
  const isProdej  = pathname.startsWith("/prodej") && !pathname.startsWith("/prodeje");
  const isData    = pathname.startsWith("/data") || pathname.startsWith("/prodeje");
  const isMapa    = pathname.startsWith("/mapa");
  const isHome    = pathname === "/";

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">

        {/* Logo */}
        <a href="/" className="group flex items-center gap-2.5 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-purple-600 shadow-lg shadow-accent/20 transition-shadow group-hover:shadow-accent/40">
            <IconTrendDown />
          </div>
          <span className="text-base font-bold tracking-tight">
            <span className="bg-gradient-to-r from-accent-light to-purple-400 bg-clip-text text-transparent">Cenový</span>
            <span className="text-foreground">Pád</span>
          </span>
        </a>

        {/* Main nav */}
        <div className="flex items-center gap-0.5">
          <NavDropdown label="Nákup"    href="/inzerce"                     items={NAKUP}    isActive={isNakup} />
          <NavDropdown label="Pronájem" href="/inzerce?category=byty-najem" items={PRONAJEM} isActive={isNajem} />

          <a
            href="/prodej"
            className={`relative rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
              isProdej ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            Prodej
            {isProdej && <span className="absolute inset-x-2 -bottom-[11px] h-px rounded-full bg-accent-light/60" />}
          </a>

          <a
            href="/prodeje"
            className={`relative rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
              isData ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            Data
            {isData && <span className="absolute inset-x-2 -bottom-[11px] h-px rounded-full bg-accent-light/60" />}
          </a>
        </div>

        {/* Right utilities */}
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href="/"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              isHome ? "text-red bg-red/10" : "text-muted hover:text-foreground"
            }`}
          >
            <IconTrendDown />
            Propady
          </a>

          {savedCount > 0 && (
            <a
              href="/ulozene"
              className="relative flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-accent/30 hover:bg-card-hover"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" className="text-red/80">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              Uložené
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red/80 px-1 text-[9px] font-bold text-white">
                {savedCount}
              </span>
            </a>
          )}

          <a
            href="/mapa"
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${
              isMapa
                ? "border-accent/40 bg-accent/10 text-accent-light"
                : "border-border bg-card text-foreground hover:border-accent/30 hover:bg-card-hover"
            }`}
          >
            <IconMap />
            Mapa
          </a>
        </div>
      </div>
    </nav>
  );
}
