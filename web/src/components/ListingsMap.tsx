"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface ListingPin {
  id: string;
  title: string;
  url: string;
  location: string;
  price: number;
  price_m2: number | null;
  area_m2: number | null;
  category: string;
  lat: number;
  lon: number;
}

function formatPriceShort(p: number): string {
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(1)} M`;
  if (p >= 1_000) return `${Math.round(p / 1_000)} k`;
  return String(Math.round(p));
}

function getCategoryColor(cat: string): string {
  switch (cat) {
    case "byty-prodej": return "#A68B3C";
    case "byty-najem": return "#5EBD72";
    case "domy-prodej": return "#5B8DD9";
    case "domy-najem": return "#D4A843";
    default: return "#5C584F";
  }
}

function createPricePin(price: number, color: string, selected = false): L.DivIcon {
  const label = formatPriceShort(price);
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${selected ? "#F5F0EB" : color};color:${selected ? "#0A0A0B" : "#fff"};
      padding:${selected ? "3px 10px" : "2px 8px"};border-radius:99px;
      font-size:${selected ? "12px" : "11px"};font-weight:700;font-family:system-ui,sans-serif;
      white-space:nowrap;letter-spacing:-0.01em;
      box-shadow:${selected ? "0 0 0 2px " + color + ",0 4px 12px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.4)"};
      line-height:1.5;pointer-events:none;
      transform:${selected ? "scale(1.15)" : "scale(1)"};transform-origin:center center;
      transition:transform 0.15s ease;
    ">${label}</div>`,
    iconSize: undefined,
    iconAnchor: [0, 10],
  });
}

interface Props {
  category?: string;
  location?: string;
  minPrice?: string;
  maxPrice?: string;
  minArea?: string;
  maxArea?: string;
  layout?: string;
  selectedId?: string;
  onPinClick?: (listing: ListingPin) => void;
}

export default function ListingsMap({ category, location, minPrice, maxPrice, minArea, maxArea, layout, selectedId, onPinClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, { marker: L.Marker; listing: ListingPin }>>(new Map());
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [49.8, 15.5],
      zoom: 7,
      zoomControl: true,
    });

    // OpenStreetMap tiles
    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }
    ).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    const lg = layerRef.current;
    lg.clearLayers();
    markersRef.current.clear();
    setLoading(true);

    const params = new URLSearchParams({ limit: "2000" });
    if (category) params.set("category", category);
    if (location) params.set("location", location);
    if (minPrice) params.set("min_price", minPrice);
    if (maxPrice) params.set("max_price", maxPrice);
    if (minArea)  params.set("min_area", minArea);
    if (maxArea)  params.set("max_area", maxArea);
    if (layout)   params.set("layout", layout);

    fetch(`/api/map/listings?${params}`)
      .then(r => r.json())
      .then(data => {
        const listings: ListingPin[] = data.listings || [];
        setCount(listings.length);
        setTotal(data.total || 0);

        const pins = listings.filter(l => l.lat && l.lon);
        const hasFilter = !!(location || minPrice || maxPrice || minArea || maxArea || layout);
        if (pins.length > 0 && hasFilter) {
          const bounds = L.latLngBounds(pins.map(l => [l.lat, l.lon] as [number, number]));
          mapRef.current?.fitBounds(bounds, { maxZoom: 17, padding: [30, 30], animate: true });
        }

        for (const l of listings) {
          if (!l.lat || !l.lon) continue;
          const color = getCategoryColor(l.category);
          const selected = l.id === selectedId;
          const marker = L.marker([l.lat, l.lon], {
            icon: createPricePin(l.price, color, selected),
            zIndexOffset: selected ? 1000 : 0,
          });
          if (onPinClick) {
            marker.on("click", (e) => {
              L.DomEvent.stopPropagation(e);
              onPinClick(l);
            });
          }
          lg.addLayer(marker);
          markersRef.current.set(l.id, { marker, listing: l });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, location, minPrice, maxPrice, minArea, maxArea, layout]);

  // Update selected pin icon without refetching all markers
  useEffect(() => {
    markersRef.current.forEach(({ marker, listing }, id) => {
      const sel = id === selectedId;
      marker.setIcon(createPricePin(listing.price, getCategoryColor(listing.category), sel));
      marker.setZIndexOffset(sel ? 1000 : 0);
    });
  }, [selectedId]);

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden border border-border">
      <div ref={containerRef} className="h-full w-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="text-sm text-muted">Načítání mapy…</span>
          </div>
        </div>
      )}

      {!loading && (
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
          <div className="rounded-lg bg-background/85 backdrop-blur-sm px-3 py-1.5 text-xs text-muted border border-border/40">
            {count} inzerátů na mapě
            {total > count && ` z ${total.toLocaleString("cs-CZ")}`}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 right-4 rounded-lg bg-background/85 backdrop-blur-sm px-3 py-2 border border-border/40 space-y-1.5">
        {[
          { color: "#A68B3C", label: "Byty – prodej", cat: "byty-prodej" },
          { color: "#5EBD72", label: "Byty – nájem", cat: "byty-najem" },
          { color: "#5B8DD9", label: "Domy – prodej", cat: "domy-prodej" },
          { color: "#D4A843", label: "Domy – nájem", cat: "domy-najem" },
        ]
          .filter(item => !category || item.cat === category)
          .map(item => (
            <div key={item.color} className="flex items-center gap-2 text-xs text-muted">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
              {item.label}
            </div>
          ))}
      </div>
    </div>
  );
}
