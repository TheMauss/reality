"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface FavoritesCtx {
  savedIds: Set<string>;
  toggle: (id: string, e?: React.MouseEvent) => void;
  count: number;
  isLoggedIn: boolean;
}

const Ctx = createContext<FavoritesCtx>({
  savedIds: new Set(),
  toggle: () => {},
  count: 0,
  isLoggedIn: false,
});

export function useFavorites() {
  return useContext(Ctx);
}

export default function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const isLoggedIn = status === "authenticated" && !!session?.user?.id;

  // Load favorites from API on login
  useEffect(() => {
    if (!isLoggedIn) { setSavedIds(new Set()); return; }
    fetch("/api/favorites")
      .then(r => r.json())
      .then(d => setSavedIds(new Set(d.ids ?? [])))
      .catch(() => {});
  }, [isLoggedIn]);

  const toggle = useCallback((id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!isLoggedIn) return;

    const isSaved = savedIds.has(id);
    // Optimistic update
    setSavedIds(prev => {
      const next = new Set(prev);
      isSaved ? next.delete(id) : next.add(id);
      return next;
    });

    if (isSaved) {
      fetch(`/api/favorites?listing_id=${encodeURIComponent(id)}`, { method: "DELETE" })
        .catch(() => setSavedIds(prev => { const next = new Set(prev); next.add(id); return next; }));
    } else {
      fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: id }),
      }).catch(() => setSavedIds(prev => { const next = new Set(prev); next.delete(id); return next; }));
    }
  }, [isLoggedIn, savedIds]);

  return (
    <Ctx.Provider value={{ savedIds, toggle, count: savedIds.size, isLoggedIn }}>
      {children}
    </Ctx.Provider>
  );
}
