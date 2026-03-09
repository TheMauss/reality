"use client";

import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface SoldTransaction {
  id: number;
  title: string;
  date: string;
  lat: number;
  lon: number;
  address: string;
  ward: string;
  wardAvgPriceM2?: number;
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
  url: string;
}

type MapMode = "sold" | "listings";

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString("cs-CZ");
}

function getPriceColor(priceM2: number): string {
  // Color scale: green (cheap) → yellow → orange → red (expensive)
  if (priceM2 < 60000) return "#22c55e";
  if (priceM2 < 80000) return "#84cc16";
  if (priceM2 < 100000) return "#eab308";
  if (priceM2 < 130000) return "#f97316";
  if (priceM2 < 170000) return "#ef4444";
  return "#dc2626";
}

function getCategoryColor(cat: string): string {
  switch (cat) {
    case "byty-prodej":
      return "#818cf8";
    case "byty-najem":
      return "#22c55e";
    case "domy-prodej":
      return "#f97316";
    case "domy-najem":
      return "#eab308";
    default:
      return "#6b7280";
  }
}

function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    "byty-prodej": "Byt prodej",
    "byty-najem": "Byt nájem",
    "domy-prodej": "Dům prodej",
    "domy-najem": "Dům nájem",
  };
  return map[cat] || cat;
}

function createCircleIcon(color: string, size: number = 10): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid rgba(255,255,255,0.8);
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [mode, setMode] = useState<MapMode>("sold");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<string>("");
  const [category, setCategory] = useState("");

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [50.075, 14.437],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Load data when mode or category changes
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    const lg = layerGroupRef.current;
    lg.clearLayers();
    setLoading(true);

    if (mode === "sold") {
      loadSoldData(lg);
    } else {
      loadListingsData(lg);
    }
  }, [mode, category]);

  async function loadSoldData(lg: L.LayerGroup) {
    try {
      const res = await fetch("/api/map/sold");
      const data = await res.json();
      const transactions: SoldTransaction[] = data.transactions || [];

      for (const t of transactions) {
        if (!t.lat || !t.lon) continue;
        const color = getPriceColor(t.wardAvgPriceM2 || 100000);
        const marker = L.marker([t.lat, t.lon], {
          icon: createCircleIcon(color, 10),
        });
        marker.bindPopup(
          `<div style="font-family: system-ui; font-size: 13px; line-height: 1.5; min-width: 180px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${t.title}</div>
            <div style="color: #9ca3af;">${t.address}</div>
            <div style="color: #9ca3af;">Datum: ${new Date(t.date).toLocaleDateString("cs-CZ")}</div>
            ${t.wardAvgPriceM2 ? `<div style="color: #22c55e; font-weight: 600; margin-top: 4px;">~${formatPrice(t.wardAvgPriceM2)} Kč/m²</div>` : ""}
          </div>`
        );
        lg.addLayer(marker);
      }

      setStats(
        `${transactions.length} transakcí z ${data.loadedWards}/${data.totalWards} částí obcí`
      );
    } catch (err) {
      console.error("Failed to load sold data:", err);
      setStats("Chyba při načítání dat");
    } finally {
      setLoading(false);
    }
  }

  async function loadListingsData(lg: L.LayerGroup) {
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      const res = await fetch(`/api/map/listings?${params}`);
      const data = await res.json();
      const listings: ListingPin[] = data.listings || [];

      for (const l of listings) {
        if (!l.lat || !l.lon) continue;
        const color = getCategoryColor(l.category);
        const marker = L.marker([l.lat, l.lon], {
          icon: createCircleIcon(color, 10),
        });
        marker.bindPopup(
          `<div style="font-family: system-ui; font-size: 13px; line-height: 1.5; min-width: 200px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${l.title}</div>
            <div style="color: #9ca3af;">${l.location}</div>
            <div style="margin-top: 4px;">
              <span style="color: #22c55e; font-weight: 700; font-size: 15px;">${formatPrice(l.price)} Kč</span>
            </div>
            ${l.price_m2 ? `<div style="color: #9ca3af;">${formatPrice(l.price_m2)} Kč/m²</div>` : ""}
            ${l.area_m2 ? `<div style="color: #9ca3af;">${l.area_m2} m²</div>` : ""}
            <div style="margin-top: 6px;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; background: ${color}22; color: ${color};">
                ${getCategoryLabel(l.category)}
              </span>
            </div>
            <div style="margin-top: 6px;">
              <a href="/listing/${l.id}" style="color: #818cf8; text-decoration: none; font-size: 12px;">Detail →</a>
            </div>
          </div>`
        );
        lg.addLayer(marker);
      }

      setStats(`${listings.length} z ${data.total} inzerátů s GPS`);
    } catch (err) {
      console.error("Failed to load listings:", err);
      setStats("Chyba při načítání dat");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-border bg-card">
          <button
            onClick={() => setMode("sold")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === "sold"
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            } rounded-l-lg`}
          >
            Prodejní mapa
          </button>
          <button
            onClick={() => setMode("listings")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === "listings"
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            } rounded-r-lg`}
          >
            Nabídková mapa
          </button>
        </div>

        {mode === "listings" && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="">Všechny kategorie</option>
            <option value="byty-prodej">Byty prodej</option>
            <option value="byty-najem">Byty nájem</option>
            <option value="domy-prodej">Domy prodej</option>
            <option value="domy-najem">Domy nájem</option>
          </select>
        )}

        {loading && (
          <span className="text-sm text-muted animate-pulse">
            Načítání...
          </span>
        )}

        {!loading && stats && (
          <span className="text-sm text-muted">{stats}</span>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        {mode === "sold" ? (
          <>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: "#22c55e" }}
              />
              &lt;60k Kč/m²
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: "#eab308" }}
              />
              80-100k
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: "#f97316" }}
              />
              100-130k
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: "#ef4444" }}
              />
              130k+
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: "#818cf8" }}
              />
              Byty prodej
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: "#22c55e" }}
              />
              Byty nájem
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: "#f97316" }}
              />
              Domy prodej
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: "#eab308" }}
              />
              Domy nájem
            </span>
          </>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapContainerRef}
        className="h-[600px] w-full rounded-xl border border-border overflow-hidden"
        style={{ background: "#1a1b26" }}
      />
    </div>
  );
}
