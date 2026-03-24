"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useFavorites } from "@/components/FavoritesProvider";

/* ── Logo ──────────────────────────────────────────────────────── */

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        Cenolov
      </span>
    </Link>
  );
}

/* ── Types ─────────────────────────────────────────────────────── */

type NavItem = { label: string; href: string; desc?: string };

/* ── Dropdown ──────────────────────────────────────────────────── */

function Dropdown({ items }: { items: NavItem[] }) {
  return (
    <div className="absolute left-0 top-full pt-2 z-50 min-w-[180px] animate-fade-in">
      <div className="rounded-lg border border-border bg-surface-1 shadow-2xl shadow-black/60 py-1">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center px-3 py-2 text-[13px] text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ── NavDropdown ───────────────────────────────────────────────── */

function NavDropdown({ label, href, items, active }: {
  label: string; href: string; items: NavItem[]; active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => { if (timer.current) clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = setTimeout(() => setOpen(false), 120); };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <a
        href={href}
        className={`flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium transition-colors rounded-md ${
          active ? "text-foreground" : "text-text-secondary hover:text-foreground"
        }`}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </a>
      {open && <Dropdown items={items} />}
    </div>
  );
}

/* ── NavLink ───────────────────────────────────────────────────── */

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
        active ? "text-foreground" : "text-text-secondary hover:text-foreground"
      }`}
    >
      {label}
    </a>
  );
}

/* ── Nav Data ──────────────────────────────────────────────────── */

const NAKUP: NavItem[] = [
  { label: "Byty k prodeji", href: "/inzerce?category=byty-prodej&sort=newest" },
  { label: "Domy k prodeji", href: "/inzerce?category=domy-prodej&sort=newest" },
  { label: "Pozemky", href: "/inzerce?category=pozemky-prodej&sort=newest" },
];

const PRONAJEM: NavItem[] = [
  { label: "Pronájem bytů", href: "/inzerce?category=byty-najem&sort=newest" },
  { label: "Pronájem domů", href: "/inzerce?category=domy-najem&sort=newest" },
];

/* ── NavBar ────────────────────────────────────────────────────── */

export default function NavBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "";
  const { data: session } = useSession();
  const { count: savedCount, isLoggedIn } = useFavorites();

  const onInzerce = pathname.startsWith("/inzerce");
  const isNajem = onInzerce && category.includes("najem");
  const isNakup = onInzerce && !isNajem;
  const isData = pathname.startsWith("/data") || pathname.startsWith("/prodeje");
  const isMapa = pathname.startsWith("/mapa");
  const isHome = pathname === "/";
  const isWatchdog = pathname.startsWith("/watchdog");

  return (
    <nav className="sticky top-0 z-50 border-b border-border glass">
      <div className="mx-auto flex h-12 max-w-[1280px] items-center gap-6 px-5 md:px-8 lg:px-10">
        <Logo />

        {/* Separator */}
        <div className="hidden md:block h-4 w-px bg-border" />

        {/* Center nav */}
        <div className="hidden md:flex items-center gap-0.5 flex-1">
          <NavLink href="/" label="Propady" active={isHome} />
          <NavDropdown label="Koupě" href="/inzerce?category=byty-prodej,domy-prodej" items={NAKUP} active={isNakup} />
          <NavDropdown label="Pronájem" href="/inzerce?category=byty-najem,domy-najem" items={PRONAJEM} active={isNajem} />
          <NavLink href="/prodeje" label="Tržní data" active={isData} />
          <NavLink href="/mapa" label="Mapa" active={isMapa} />
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Watchdog */}
          <a
            href="/watchdog"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
              isWatchdog ? "text-foreground bg-surface-2" : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="hidden sm:inline">Hlídač</span>
          </a>

          {/* Saved */}
          <a
            href={isLoggedIn ? "/ulozene" : undefined}
            onClick={!isLoggedIn ? () => signIn("google") : undefined}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
              savedCount > 0 ? "text-red" : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24"
              fill={savedCount > 0 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {savedCount > 0 && (
              <span className="text-[11px]">{savedCount}</span>
            )}
          </a>

          {/* Separator */}
          <div className="h-4 w-px bg-border mx-1" />

          {/* Auth */}
          {session ? (
            <div className="relative group">
              <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-text-secondary hover:text-foreground transition-colors">
                {session.user?.image ? (
                  <img src={session.user.image} alt="" className="w-5 h-5 rounded-full" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center text-[10px] font-medium">
                    {session.user?.name?.[0] ?? "U"}
                  </span>
                )}
                <span className="hidden sm:inline max-w-[80px] truncate">
                  {session.user?.name?.split(" ")[0]}
                </span>
              </button>
              <div className="absolute right-0 top-full pt-1 z-50 hidden group-hover:block">
                <div className="rounded-lg border border-border bg-surface-1 shadow-2xl shadow-black/60 py-1 min-w-[130px]">
                  <button
                    onClick={() => signOut()}
                    className="w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                  >
                    Odhlásit se
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="text-[12px] font-medium text-text-tertiary hover:text-text-secondary transition-colors px-2 py-1.5"
            >
              Přihlásit
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
