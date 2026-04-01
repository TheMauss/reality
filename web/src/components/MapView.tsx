"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { searchKnownPlaces, KnownPlace } from "@/lib/places";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  importance: number;
  boundingbox: [string, string, string, string]; // [minlat, maxlat, minlon, maxlon]
}

interface DbLocation {
  location: string;
  lat: number;
  lon: number;
  cnt: number;
}

type SearchHit =
  | { source: "local"; place: KnownPlace }
  | { source: "db"; item: DbLocation }
  | { source: "nominatim"; result: NominatimResult };

// Place types that are meaningful for real estate search
const GOOD_CLASSES = new Set(["place", "boundary", "landuse"]);
const GOOD_TYPES = new Set([
  "city", "town", "village", "suburb", "quarter", "neighbourhood",
  "district", "borough", "municipality", "county", "state", "region",
  "residential", "administrative", "city_block",
]);

const TYPE_CS: Record<string, string> = {
  city: "Město", town: "Město", village: "Obec", suburb: "Čtvrť",
  quarter: "Čtvrť", neighbourhood: "Čtvrť", district: "Obvod",
  borough: "Obvod", municipality: "Obec", county: "Okres",
  state: "Kraj", region: "Region", residential: "Obytná oblast",
  administrative: "Oblast", city_block: "Blok",
};

function nominatimLabel(r: NominatimResult): string {
  if (r.class === "highway") return "Ulice";
  if (r.class === "amenity") return "Místo";
  return TYPE_CS[r.type] ?? r.type;
}

function isGoodForRealEstate(r: NominatimResult): boolean {
  if (r.class === "highway") return true;
  return GOOD_CLASSES.has(r.class) || GOOD_TYPES.has(r.type);
}

function shortName(displayName: string): string {
  return displayName.split(",")[0].trim();
}

interface SoldTransaction {
  id: number;
  title: string;
  date: string;
  lat: number;
  lon: number;
  address: string;
  ward_name: string;
  ward_avg_price_m2?: number;
  category?: string;
  municipality?: string;
}

interface ListingPin {
  id: string;
  title: string;
  location: string;
  price: number;
  price_m2: number | null;
  area_m2: number | null;
  category: string;
  lat: number;
  lon: number;
}

type MapMode = "sold" | "listings";

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString("cs-CZ");
}

function getPriceColor(priceM2: number): string {
  if (priceM2 < 40000) return "#22c55e";
  if (priceM2 < 60000) return "#84cc16";
  if (priceM2 < 80000) return "#eab308";
  if (priceM2 < 100000) return "#f97316";
  if (priceM2 < 140000) return "#ef4444";
  return "#dc2626";
}

function getCategoryColor(cat: string): string {
  switch (cat) {
    case "byty-prodej": return "#818cf8";
    case "byty-najem": return "#22c55e";
    case "domy-prodej": return "#f97316";
    case "domy-najem": return "#eab308";
    default: return "#6b7280";
  }
}

function createDot(color: string, size = 8): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:1.5px solid rgba(255,255,255,0.7);
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const YEAR_OPTIONS = [
  { value: "", label: "Všechna léta" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
  { value: "2022", label: "2022" },
  { value: "2021", label: "2021" },
  { value: "2020", label: "2020" },
];

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [mode, setMode] = useState<MapMode>("sold");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ count: number; total: number } | null>(null);
  const [category, setCategory] = useState("");
  const [year, setYear] = useState("2024");

  // Location search
  const [searchQuery, setSearchQuery] = useState("");
  const [localHits, setLocalHits] = useState<KnownPlace[]>([]);
  const [dbHits, setDbHits] = useState<DbLocation[]>([]);
  const [nominatimResults, setNominatimResults] = useState<NominatimResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [resolvedLabel, setResolvedLabel] = useState<{ text: string; good: boolean } | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Deduplicated combined results: local → db → nominatim
  function getCombinedHits(): SearchHit[] {
    const seen = new Set(localHits.map(p => p.name.toLowerCase()));
    const hits: SearchHit[] = localHits.map(place => ({ source: "local" as const, place }));
    for (const item of dbHits) {
      const key = item.location.toLowerCase();
      if (!seen.has(key)) { seen.add(key); hits.push({ source: "db" as const, item }); }
    }
    for (const r of nominatimResults) {
      const key = shortName(r.display_name).toLowerCase();
      if (!seen.has(key)) hits.push({ source: "nominatim" as const, result: r });
    }
    return hits;
  }

  const searchNominatim = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setNominatimResults([]); return; }
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        countrycodes: "cz",
        limit: "6",
        addressdetails: "0",
      });
      // Bias toward currently visible map area (helps for street search)
      if (mapRef.current) {
        const b = mapRef.current.getBounds();
        params.set("viewbox", `${b.getWest()},${b.getNorth()},${b.getEast()},${b.getSouth()}`);
        params.set("bounded", "0"); // still show results outside if nothing found
      }
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "Accept-Language": "cs,en" },
      });
      const data: NominatimResult[] = await res.json();
      setNominatimResults(data);
    } catch { setNominatimResults([]); }
    finally { setSearchLoading(false); }
  }, []);

  const searchDb = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setDbHits([]); return; }
    try {
      const params = new URLSearchParams({ q: query });
      if (mode === "listings") params.set("category", category);
      const res = await fetch(`/api/search/locations?${params}`);
      const data = await res.json();
      setDbHits(data.locations || []);
    } catch { setDbHits([]); }
  }, [mode, category]);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    setResolvedLabel(null);
    // Instant local results
    setLocalHits(value.trim().length >= 2 ? searchKnownPlaces(value, 5) : []);
    // Debounced DB + Nominatim
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.trim().length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        searchDb(value);
        searchNominatim(value);
      }, 200);
    } else {
      setDbHits([]);
      setNominatimResults([]);
    }
  }

  function clearSearch() {
    setLocalHits([]); setDbHits([]); setNominatimResults([]);
  }

  function flyToKnownPlace(place: KnownPlace) {
    setResolvedLabel({ text: place.type, good: true });
    setSearchQuery(place.name);
    clearSearch();
    if (!mapRef.current) return;
    if (place.bbox) {
      const [minLat, maxLat, minLon, maxLon] = place.bbox;
      mapRef.current.fitBounds([[minLat, minLon], [maxLat, maxLon]], { maxZoom: 15, animate: true });
    } else {
      mapRef.current.setView([place.lat, place.lon], 14, { animate: true });
    }
  }

  function flyToDbLocation(item: DbLocation) {
    setResolvedLabel({ text: "Ulice / oblast", good: true });
    setSearchQuery(item.location);
    clearSearch();
    if (!mapRef.current) return;
    mapRef.current.setView([item.lat, item.lon], 15, { animate: true });
  }

  function flyToNominatim(result: NominatimResult) {
    const good = isGoodForRealEstate(result);
    setResolvedLabel({ text: nominatimLabel(result), good });
    setSearchQuery(shortName(result.display_name));
    clearSearch();
    if (!mapRef.current) return;
    const [minLat, maxLat, minLon, maxLon] = result.boundingbox;
    mapRef.current.fitBounds([
      [parseFloat(minLat), parseFloat(minLon)],
      [parseFloat(maxLat), parseFloat(maxLon)],
    ], { maxZoom: 15, animate: true });
  }

  function selectHit(hit: SearchHit) {
    if (hit.source === "local") flyToKnownPlace(hit.place);
    else if (hit.source === "db") flyToDbLocation(hit.item);
    else flyToNominatim(hit.result);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setLocalHits([]); setDbHits([]); setNominatimResults([]);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [49.8, 15.5],
      zoom: 7,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;
    const lg = layerGroupRef.current;
    lg.clearLayers();
    setLoading(true);
    setStats(null);

    if (mode === "sold") {
      loadSoldData(lg);
    } else {
      loadListingsData(lg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, category, year]);

  async function loadSoldData(lg: L.LayerGroup) {
    try {
      const params = new URLSearchParams({ limit: "6000" });
      if (category) params.set("category", category);
      if (year) {
        params.set("date_from", `${year}-01`);
        params.set("date_to", `${year}-12`);
      }

      const res = await fetch(`/api/map/sold-db?${params}`);
      const data = await res.json();
      const transactions: SoldTransaction[] = data.transactions || [];

      for (const t of transactions) {
        if (!t.lat || !t.lon) continue;
        const color = getPriceColor(t.ward_avg_price_m2 || 80000);
        const marker = L.marker([t.lat, t.lon], { icon: createDot(color, 8) });
        marker.bindPopup(
          `<div style="font-family:system-ui;font-size:13px;line-height:1.6;min-width:190px;">
            <div style="font-weight:600;margin-bottom:2px;color:#e5e7eb;">${t.title}</div>
            <div style="color:#6b7280;font-size:11px;">${t.address || t.ward_name || ""}</div>
            ${t.municipality ? `<div style="color:#6b7280;font-size:11px;">${t.municipality}</div>` : ""}
            <div style="color:#9ca3af;font-size:11px;margin-top:2px;">${t.date ? new Date(t.date).toLocaleDateString("cs-CZ") : ""}</div>
            ${t.ward_avg_price_m2 ? `<div style="color:#22c55e;font-weight:600;margin-top:4px;">~${formatPrice(t.ward_avg_price_m2)} Kč/m²</div>` : ""}
          </div>`
        );
        lg.addLayer(marker);
      }

      setStats({ count: transactions.length, total: data.total || transactions.length });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadListingsData(lg: L.LayerGroup) {
    try {
      const params = new URLSearchParams({ limit: "2000" });
      if (category) params.set("category", category);

      const res = await fetch(`/api/map/listings?${params}`);
      const data = await res.json();
      const listings: ListingPin[] = data.listings || [];

      for (const l of listings) {
        if (!l.lat || !l.lon) continue;
        const color = getCategoryColor(l.category);
        const marker = L.marker([l.lat, l.lon], { icon: createDot(color, 10) });
        marker.bindPopup(
          `<div style="font-family:system-ui;font-size:13px;line-height:1.6;min-width:210px;">
            <div style="font-size:15px;font-weight:700;color:#e5e7eb;">${Math.round(l.price / 1000) >= 1000 ? `${(l.price / 1_000_000).toFixed(1)} M Kč` : `${Math.round(l.price).toLocaleString("cs-CZ")} Kč`}</div>
            ${l.price_m2 ? `<div style="color:#818cf8;font-size:12px;">${formatPrice(l.price_m2)} Kč/m²</div>` : ""}
            <div style="color:#9ca3af;font-size:12px;margin-top:2px;">${l.title}</div>
            <div style="color:#6b7280;font-size:11px;">${l.location}</div>
            ${l.area_m2 ? `<div style="color:#6b7280;font-size:11px;">${l.area_m2} m²</div>` : ""}
            <a href="/listing/${l.id}" style="display:inline-block;margin-top:8px;padding:4px 10px;background:#6366f120;color:#818cf8;border-radius:6px;font-size:12px;text-decoration:none;font-weight:500;">Detail →</a>
          </div>`
        );
        lg.addLayer(marker);
      }

      setStats({ count: listings.length, total: data.total || listings.length });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="relative z-[500] flex flex-wrap items-center gap-3">
        {/* Location search */}
        <div ref={searchRef} className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <svg className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") {
                  setLocalHits([]); setNominatimResults([]);
                  setSearchQuery(""); setResolvedLabel(null);
                }
                if (e.key === "Enter") {
                  const hits = getCombinedHits();
                  if (hits.length > 0) selectHit(hits[0]);
                }
              }}
              placeholder="Hledat město, čtvrť…"
              className="w-48 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
            />
            {searchLoading && <div className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent" />}
            {resolvedLabel && !searchLoading && (
              <span className={`text-xs ${resolvedLabel.good ? "text-green-400" : "text-amber-400"}`}>
                {resolvedLabel.text}
              </span>
            )}
          </div>

          {/* Dropdown results */}
          {(() => {
            const hits = getCombinedHits();
            if (hits.length === 0) return null;
            return (
              <div className="absolute left-0 top-full z-[9999] mt-1 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
                {hits.map((hit, i) => {
                  const prevSrc = i > 0 ? hits[i - 1].source : null;

                  if (hit.source === "local") {
                    const p = hit.place;
                    return (
                      <button key={`local-${p.name}`} onClick={() => selectHit(hit)}
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-border/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">{p.name}</div>
                          <div className="truncate text-xs text-muted">{p.context}</div>
                        </div>
                        <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-accent-dim text-accent-light">
                          {p.type}
                        </span>
                      </button>
                    );
                  }

                  if (hit.source === "db") {
                    const item = hit.item;
                    const showSep = prevSrc === "local";
                    // Show short street name (first part before comma)
                    const name = item.location.split(",")[0].trim();
                    const ctx = item.location.split(",").slice(1).join(",").trim();
                    return (
                      <div key={`db-${item.location}`}>
                        {showSep && <div className="mx-3 border-t border-border/50" />}
                        <button onClick={() => selectHit(hit)}
                          className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-border/30 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">{name}</div>
                            <div className="truncate text-xs text-muted">{ctx} · {item.cnt} inzerátů</div>
                          </div>
                          <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-blue/10 text-blue">
                            Ulice
                          </span>
                        </button>
                      </div>
                    );
                  }

                  // nominatim
                  const r = hit.result;
                  const good = isGoodForRealEstate(r);
                  const showSep = prevSrc === "local" || prevSrc === "db";
                  return (
                    <div key={`nom-${r.place_id}`}>
                      {showSep && <div className="mx-3 border-t border-border/50" />}
                      <button onClick={() => selectHit(hit)}
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-border/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {shortName(r.display_name)}
                          </div>
                          <div className="truncate text-xs text-muted">
                            {r.display_name.split(",").slice(1, 3).join(",").trim()}
                          </div>
                        </div>
                        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                          good ? "bg-green-900/40 text-green-400" : "bg-amber-900/40 text-amber-400"
                        }`}>
                          {nominatimLabel(r)}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setMode("sold")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === "sold" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            Prodeje
          </button>
          <button
            onClick={() => setMode("listings")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === "listings" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            Nabídky
          </button>
        </div>

        {/* Category filter */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        >
          {mode === "sold" ? (
            <>
              <option value="">Byty + Domy</option>
              <option value="byty">Byty</option>
              <option value="domy">Domy</option>
            </>
          ) : (
            <>
              <option value="">Všechny kategorie</option>
              <option value="byty-prodej">Byty – prodej</option>
              <option value="byty-najem">Byty – nájem</option>
              <option value="domy-prodej">Domy – prodej</option>
              <option value="domy-najem">Domy – nájem</option>
            </>
          )}
        </select>

        {/* Year filter (sold only) */}
        {mode === "sold" && (
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          >
            {YEAR_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Načítání…
          </div>
        )}

        {!loading && stats && (
          <span className="text-sm text-muted">
            {stats.count.toLocaleString("cs-CZ")} zobrazeno
            {stats.total > stats.count && ` z ${stats.total.toLocaleString("cs-CZ")}`}
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        {mode === "sold" ? (
          <>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#22c55e" }} />&lt;40k Kč/m²</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#eab308" }} />60–80k</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#f97316" }} />80–100k</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#ef4444" }} />100–140k</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#dc2626" }} />140k+</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#818cf8" }} />Byty prodej</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#22c55e" }} />Byty nájem</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#f97316" }} />Domy prodej</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#eab308" }} />Domy nájem</span>
          </>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapContainerRef}
        className="w-full rounded-xl border border-border overflow-hidden"
        style={{ height: "calc(100vh - 280px)", minHeight: 500 }}
      />
    </div>
  );
}
