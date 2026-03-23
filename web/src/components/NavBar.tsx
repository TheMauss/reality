"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// ── Icons ────────────────────────────────────────────────────────────────────

const IcoHome = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IcoDom = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="10" width="18" height="11" rx="1"/><path d="M1 10l11-8 11 8"/>
    <path d="M9 21V13h6v8"/>
  </svg>
);

const IcoMap = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
    <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
  </svg>
);

const IcoChevron = ({ open }: { open?: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const IcoHeart = ({ filled }: { filled?: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const IcoTrendDown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
  </svg>
);

// ── Logo ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5 shrink-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-purple-600 shadow-md shadow-accent/20 group-hover:shadow-accent/40 transition-shadow">
        <IcoTrendDown />
      </div>
      <span className="hidden sm:flex items-baseline gap-px text-[15px] font-bold tracking-tight">
        <span className="bg-gradient-to-r from-accent-light to-purple-400 bg-clip-text text-transparent">Cenový</span>
        <span className="text-foreground">Pád</span>
      </span>
    </Link>
  );
}

// ── Dropdown menu ─────────────────────────────────────────────────────────────

type NavItem = { label: string; href: string; Icon: React.FC; desc: string };

function Dropdown({ items }: { items: NavItem[] }) {
  return (
    <div className="absolute left-0 top-full pt-3 z-50 min-w-[220px] animate-slide-up">
      <div className="rounded-2xl border border-border/80 bg-card shadow-2xl shadow-black/70 overflow-hidden">
        <div className="p-1.5 space-y-px">
          {items.map((item) => (
            <a key={item.href} href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-card-hover group">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-muted group-hover:text-accent-light group-hover:border-accent/30 transition-all">
                <item.Icon />
              </span>
              <div>
                <div className="text-[13px] font-semibold text-foreground group-hover:text-accent-light transition-colors leading-none mb-0.5">
                  {item.label}
                </div>
                <div className="text-[11px] text-muted leading-none">{item.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── NavDropdown ───────────────────────────────────────────────────────────────

function NavDropdown({ label, href, items, active }: {
  label: string; href: string; items: NavItem[]; active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => { if (timer.current) clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = setTimeout(() => setOpen(false), 130); };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <a href={href} className={`relative flex items-center gap-1 px-3 py-2 text-[13px] font-medium rounded-lg transition-colors ${
        active ? "text-foreground" : "text-muted hover:text-foreground"
      }`}>
        {label}
        <IcoChevron open={open} />
        {active && <span className="absolute inset-x-2 -bottom-[13px] h-[2px] rounded-full bg-accent-light/70" />}
      </a>
      {open && <Dropdown items={items} />}
    </div>
  );
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a href={href} className={`relative px-3 py-2 text-[13px] font-medium rounded-lg transition-colors ${
      active ? "text-foreground" : "text-muted hover:text-foreground"
    }`}>
      {label}
      {active && <span className="absolute inset-x-2 -bottom-[13px] h-[2px] rounded-full bg-accent-light/70" />}
    </a>
  );
}

// ── Nav data ──────────────────────────────────────────────────────────────────

const NAKUP: NavItem[] = [
  { label: "Prodej bytů",   href: "/inzerce?category=byty-prodej&sort=newest",    Icon: IcoHome, desc: "Byty a apartmány" },
  { label: "Prodej domů",   href: "/inzerce?category=domy-prodej&sort=newest",    Icon: IcoDom,  desc: "Rodinné domy a vily" },
  { label: "Pozemky",       href: "/inzerce?category=pozemky-prodej&sort=newest", Icon: IcoMap,  desc: "Stavební pozemky" },
  { label: "Nejnovější",    href: "/inzerce?sort=newest",                          Icon: IcoHome, desc: "Právě přidáno" },
];

const PRONAJEM: NavItem[] = [
  { label: "Pronájem bytů", href: "/inzerce?category=byty-najem&sort=newest",  Icon: IcoHome, desc: "Byty a pokoje" },
  { label: "Pronájem domů", href: "/inzerce?category=domy-najem&sort=newest",  Icon: IcoDom,  desc: "Domy a chalupy" },
  { label: "Nejnovější",    href: "/inzerce?category=byty-najem&sort=newest",  Icon: IcoHome, desc: "Nové nabídky" },
];

// ── NavBar ────────────────────────────────────────────────────────────────────

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
    <nav className="sticky top-0 z-50 border-b border-border/60 glass">
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between px-5 md:px-8">

        <Logo />

        {/* Center nav */}
        <div className="hidden md:flex items-center gap-0.5">
          <NavDropdown label="Nákup"    href="/inzerce"                     items={NAKUP}    active={isNakup} />
          <NavDropdown label="Pronájem" href="/inzerce?category=byty-najem" items={PRONAJEM} active={isNajem} />
          <NavLink href="/prodej"  label="Prodej"  active={isProdej} />
          <NavLink href="/prodeje" label="Data"    active={isData} />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {/* Propady */}
          <Link href="/"
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
              isHome
                ? "bg-red-dim text-red border border-red/20"
                : "text-muted hover:text-foreground"
            }`}>
            <IcoTrendDown />
            Propady
          </Link>

          {/* Saved */}
          <a href="/ulozene"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-all ${
              savedCount > 0
                ? "border-red/25 bg-red-dim text-red hover:border-red/40"
                : "border-border bg-card text-muted hover:border-border-light hover:text-foreground"
            }`}>
            <IcoHeart filled={savedCount > 0} />
            <span className="hidden sm:inline">Uložené</span>
            {savedCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red/80 px-1 text-[10px] font-bold text-white">
                {savedCount}
              </span>
            )}
          </a>

          {/* Mapa CTA */}
          <a href="/mapa"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all border ${
              isMapa
                ? "bg-accent/15 border-accent/40 text-accent-light"
                : "bg-accent border-accent text-white hover:bg-accent-light shadow-sm shadow-accent/20"
            }`}>
            <IcoMap />
            Mapa
          </a>
        </div>
      </div>
    </nav>
  );
}
