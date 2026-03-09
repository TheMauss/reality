"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── NUTS3 → Sreality region ID mapping ──────────────────────────────────────
const NUTS_TO_SREALITY: Record<string, number> = {
  CZ010: 10, CZ020: 11, CZ031: 1,  CZ032: 2,  CZ041: 3,
  CZ042: 4,  CZ051: 5,  CZ052: 6,  CZ053: 7,  CZ063: 13,
  CZ064: 14, CZ071: 8,  CZ072: 9,  CZ080: 12,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface GeoItem {
  id: number; name: string; avg_price_m2: number | null;
  transactions: number; price_change: number | null; lat: number; lon: number;
}

interface TownItem {
  id: number; name: string; district_id: number;
  tx_count: number; lat: number; lon: number; avg_price_m2: number | null;
}

interface Transaction {
  id: number; lat: number; lon: number; title: string; date: string;
  ward_avg_price_m2: number | null; ward_name: string; municipality: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoJSONData = { type: string; features: any[] };
type Level = "regions" | "districts" | "towns" | "transactions";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function priceColor(p: number): string {
  if (p < 40000)  return "#22c55e";
  if (p < 60000)  return "#84cc16";
  if (p < 80000)  return "#eab308";
  if (p < 100000) return "#f97316";
  if (p < 140000) return "#ef4444";
  return "#dc2626";
}

function fmtK(p: number)    { return `${Math.round(p / 1000)}\u202fk`; }
function fmtFull(p: number) { return `${Math.round(p).toLocaleString("cs-CZ")} Kč/m²`; }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("cs-CZ", { year: "numeric", month: "short" });
}
function circleR(count: number, max: number, minR: number, maxR: number) {
  return minR + Math.sqrt(count / Math.max(max, 1)) * (maxR - minR);
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function PriceMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const geoLayerRef     = useRef<L.GeoJSON | null>(null);
  const markerLayerRef  = useRef<L.LayerGroup | null>(null);

  const [geoData,          setGeoData]          = useState<GeoJSONData | null>(null);
  const [districtGeoData,  setDistrictGeoData]  = useState<GeoJSONData | null>(null);
  const [regionPrices,     setRegionPrices]     = useState<Map<number, GeoItem>>(new Map());
  const [level,            setLevel]            = useState<Level>("regions");
  const [districts,        setDistricts]        = useState<GeoItem[]>([]);
  const [towns,            setTowns]            = useState<TownItem[]>([]);
  const [transactions,     setTransactions]     = useState<Transaction[]>([]);
  const [loading,          setLoading]          = useState(false);
  const [geoLoading,       setGeoLoading]       = useState(true);
  const [selectedRegion,   setSelectedRegion]   = useState<GeoItem | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<GeoItem | null>(null);
  const [selectedTown,     setSelectedTown]     = useState<TownItem | null>(null);
  const [hoveredId,        setHoveredId]        = useState<number | null>(null);

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [49.8, 15.5], zoom: 7, zoomControl: true, preferCanvas: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OSM &copy; CARTO", maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    markerLayerRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    setGeoLoading(true);
    Promise.all([
      fetch("/api/map/price-levels?level=regions").then(r => r.json()),
      fetch("/api/map/cz-geojson").then(r => r.json()),
      fetch("/api/map/cz-districts-geojson").then(r => r.json()).catch(() => null),
    ]).then(([priceData, geo, districtGeo]) => {
      const map = new Map<number, GeoItem>();
      for (const item of (priceData.items || []) as GeoItem[]) map.set(item.id, item);
      setRegionPrices(map);
      setGeoData(geo);
      if (districtGeo?.features?.length > 0) setDistrictGeoData(districtGeo);
      setGeoLoading(false);
    }).catch(() => setGeoLoading(false));
  }, []);

  // ── Render effects ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !geoData || regionPrices.size === 0 || level !== "regions") return;
    renderRegions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoData, regionPrices, level]);

  useEffect(() => {
    if (level === "districts" && districts.length > 0) {
      const regionFeatures = districtGeoData?.features?.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (f: any) => f.properties?.region_id === selectedRegion?.id
      );
      if (regionFeatures && regionFeatures.length >= 3) renderDistrictChoropleth(regionFeatures);
      else renderDistricts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districts, hoveredId, districtGeoData]);

  useEffect(() => {
    if (level === "towns" && towns.length > 0) renderTowns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [towns, hoveredId]);

  useEffect(() => {
    if (level === "transactions") renderTransactions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  // ─── Render: regions choropleth ───────────────────────────────────────────
  function renderRegions() {
    const map = mapRef.current;
    if (!map || !geoData) return;
    if (geoLayerRef.current) { geoLayerRef.current.remove(); geoLayerRef.current = null; }
    markerLayerRef.current?.clearLayers();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layer = L.geoJSON(geoData as any, {
      style: (feature) => {
        const rid = NUTS_TO_SREALITY[feature?.properties?.NUTS_ID as string];
        const price = regionPrices.get(rid)?.avg_price_m2;
        return { fillColor: price ? priceColor(price) : "#374151", fillOpacity: 0.72, color: "#0f1117", weight: 2 };
      },
      onEachFeature: (feature, fl) => {
        const rid = NUTS_TO_SREALITY[feature.properties.NUTS_ID as string];
        const region = regionPrices.get(rid);
        fl.on("mouseover", (e) => { (e.target as L.Path).setStyle({ fillOpacity: 0.92, weight: 2.5, color: "#ffffff40" }); setHoveredId(rid ?? null); });
        fl.on("mouseout",  (e) => { (e.target as L.Path).setStyle({ fillOpacity: 0.72, weight: 2,   color: "#0f1117"    }); setHoveredId(null); });
        fl.on("click", () => { if (region) drillRegion(region); });
        if (region?.avg_price_m2) {
          fl.bindTooltip(`<div style="font-family:system-ui;font-size:13px;line-height:1.5;padding:2px 4px;">
            <div style="font-weight:700;">${feature.properties.NUTS_NAME}</div>
            <div style="color:${priceColor(region.avg_price_m2)};font-size:15px;font-weight:700;">${fmtFull(region.avg_price_m2)}</div>
            <div style="color:#9ca3af;font-size:11px;">${region.transactions.toLocaleString("cs-CZ")} transakcí</div>
          </div>`, { sticky: true, direction: "top" });
        }
      },
    }).addTo(map);
    geoLayerRef.current = layer;

    // Price labels at centroids
    for (const f of (geoData as { features: { properties: { NUTS_ID: string } }[] }).features) {
      const rid = NUTS_TO_SREALITY[f.properties.NUTS_ID];
      const region = regionPrices.get(rid);
      if (!region?.avg_price_m2) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const center = L.geoJSON(f as any).getBounds().getCenter();
      const color = priceColor(region.avg_price_m2);
      markerLayerRef.current?.addLayer(L.marker([center.lat, center.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:rgba(15,17,23,0.82);backdrop-filter:blur(4px);border:1.5px solid ${color}55;border-radius:8px;padding:3px 7px;white-space:nowrap;pointer-events:none;text-align:center;">
            <div style="font-size:13px;font-weight:800;color:${color};line-height:1.2;">${fmtK(region.avg_price_m2)}</div>
            <div style="font-size:9px;color:#6b7280;line-height:1;">Kč/m²</div>
          </div>`,
          iconAnchor: [30, 20], iconSize: [60, 40],
        }),
        interactive: false, zIndexOffset: 1000,
      }));
    }
  }

  // ─── Render: districts choropleth ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderDistrictChoropleth(features: any[]) {
    const map = mapRef.current; if (!map) return;
    if (geoLayerRef.current) { geoLayerRef.current.remove(); geoLayerRef.current = null; }
    markerLayerRef.current?.clearLayers();
    const priceById = new Map(districts.map(d => [d.id, d]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layer = L.geoJSON({ type: "FeatureCollection", features } as any, {
      style: (feature) => {
        const id = feature?.properties?.sreality_id as number | null;
        const price = (id ? priceById.get(id)?.avg_price_m2 : null) ?? feature?.properties?.avg_price_m2;
        return { fillColor: price ? priceColor(price) : "#374151", fillOpacity: 0.72, color: "#0f1117", weight: 1.5 };
      },
      onEachFeature: (feature, fl) => {
        const id = feature.properties?.sreality_id as number | null;
        const district = id ? priceById.get(id) : null;
        const price = district?.avg_price_m2 ?? feature.properties?.avg_price_m2;
        const name  = district?.name ?? feature.properties?.display_name ?? "";
        fl.on("mouseover", (e) => { (e.target as L.Path).setStyle({ fillOpacity: 0.92, weight: 2, color: "#ffffff40" }); setHoveredId(id ?? null); });
        fl.on("mouseout",  (e) => { (e.target as L.Path).setStyle({ fillOpacity: 0.72, weight: 1.5, color: "#0f1117" }); setHoveredId(null); });
        fl.on("click", () => { if (district) drillDistrict(district); });
        if (price) {
          fl.bindTooltip(`<div style="font-family:system-ui;font-size:13px;line-height:1.5;padding:2px 4px;">
            <div style="font-weight:700;">${name}</div>
            <div style="color:${priceColor(price)};font-size:15px;font-weight:700;">${fmtFull(price)}</div>
            ${district ? `<div style="color:#9ca3af;font-size:11px;">${district.transactions.toLocaleString("cs-CZ")} transakcí</div>` : ""}
          </div>`, { sticky: true, direction: "top" });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const center = L.geoJSON(feature as any).getBounds().getCenter();
          const color = priceColor(price);
          markerLayerRef.current?.addLayer(L.marker([center.lat, center.lng], {
            icon: L.divIcon({
              className: "",
              html: `<div style="background:rgba(15,17,23,0.82);backdrop-filter:blur(4px);border:1.5px solid ${color}55;border-radius:6px;padding:2px 6px;white-space:nowrap;pointer-events:none;text-align:center;">
                <div style="font-size:12px;font-weight:800;color:${color};line-height:1.2;">${fmtK(price)}</div>
                <div style="font-size:8px;color:#6b7280;line-height:1;">Kč/m²</div>
              </div>`,
              iconAnchor: [28, 18], iconSize: [56, 36],
            }),
            interactive: false, zIndexOffset: 1000,
          }));
        }
      },
    }).addTo(map);
    geoLayerRef.current = layer;
  }

  // ─── Render: districts fallback circles ───────────────────────────────────
  function renderDistricts() {
    if (geoLayerRef.current) { geoLayerRef.current.remove(); geoLayerRef.current = null; }
    markerLayerRef.current?.clearLayers();
    const maxTx = Math.max(...districts.map(d => d.transactions || 0), 1);
    for (const d of districts) {
      if (!d.lat || !d.lon || !d.avg_price_m2) continue;
      const color = priceColor(d.avg_price_m2);
      const r = circleR(d.transactions, maxTx, 10, 28);
      const isHov = d.id === hoveredId;
      const circle = L.circleMarker([d.lat, d.lon], {
        radius: r, fillColor: color, fillOpacity: isHov ? 1 : 0.80,
        color: isHov ? "#ffffff" : "rgba(255,255,255,0.2)", weight: isHov ? 2 : 1.5,
      });
      circle.bindTooltip(`<div style="font-family:system-ui;font-size:13px;line-height:1.5;padding:2px 4px;">
        <div style="font-weight:700;">${d.name}</div>
        <div style="color:${color};font-size:15px;font-weight:700;">${fmtFull(d.avg_price_m2)}</div>
        <div style="color:#9ca3af;font-size:11px;">${d.transactions.toLocaleString("cs-CZ")} transakcí</div>
      </div>`, { sticky: true, direction: "top" });
      circle.on("mouseover", () => setHoveredId(d.id));
      circle.on("mouseout",  () => setHoveredId(null));
      circle.on("click",     () => drillDistrict(d));
      markerLayerRef.current?.addLayer(circle);
    }
  }

  // ─── Render: towns as bubble map ──────────────────────────────────────────
  function renderTowns() {
    if (geoLayerRef.current) { geoLayerRef.current.remove(); geoLayerRef.current = null; }
    markerLayerRef.current?.clearLayers();
    const maxTx = Math.max(...towns.map(t => t.tx_count), 1);
    for (const t of towns) {
      if (!t.lat || !t.lon) continue;
      const price = t.avg_price_m2 ?? 80000;
      const color = priceColor(price);
      const r = circleR(t.tx_count, maxTx, 7, 22);
      const isHov = t.id === hoveredId;

      const circle = L.circleMarker([t.lat, t.lon], {
        radius: r, fillColor: color, fillOpacity: isHov ? 1 : 0.82,
        color: isHov ? "#ffffff" : "rgba(255,255,255,0.25)", weight: isHov ? 2 : 1.5,
      });

      circle.bindTooltip(`<div style="font-family:system-ui;font-size:13px;line-height:1.5;padding:2px 4px;">
        <div style="font-weight:700;">${t.name}</div>
        <div style="color:${color};font-size:15px;font-weight:700;">${fmtFull(price)}</div>
        <div style="color:#9ca3af;font-size:11px;">${t.tx_count.toLocaleString("cs-CZ")} transakcí</div>
      </div>`, { sticky: true, direction: "top" });

      // Town name label above the circle
      markerLayerRef.current?.addLayer(L.marker([t.lat, t.lon], {
        icon: L.divIcon({
          className: "",
          html: `<div style="white-space:nowrap;font-size:10px;font-weight:700;color:#ffffff;
            text-shadow:0 1px 3px rgba(0,0,0,0.9),0 0 6px rgba(0,0,0,0.8);
            transform:translate(-50%,-${r + 6}px);pointer-events:none;letter-spacing:0.02em;">${t.name}</div>`,
          iconSize: [0, 0], iconAnchor: [0, 0],
        }),
        interactive: false, zIndexOffset: 900,
      }));

      circle.on("mouseover", () => setHoveredId(t.id));
      circle.on("mouseout",  () => setHoveredId(null));
      circle.on("click",     () => drillTown(t));
      markerLayerRef.current?.addLayer(circle);
    }
  }

  // ─── Render: transactions dots ────────────────────────────────────────────
  function renderTransactions() {
    if (geoLayerRef.current) { geoLayerRef.current.remove(); geoLayerRef.current = null; }
    markerLayerRef.current?.clearLayers();
    for (const t of transactions) {
      if (!t.lat || !t.lon) continue;
      const color = priceColor(t.ward_avg_price_m2 || 80000);
      const dot = L.circleMarker([t.lat, t.lon], {
        radius: 5, fillColor: color, fillOpacity: 0.78, color: "rgba(255,255,255,0.35)", weight: 1,
      });
      dot.bindPopup(`<div style="font-family:system-ui;font-size:13px;line-height:1.6;min-width:170px;">
        <div style="font-weight:600;color:#e5e7eb;">${t.title}</div>
        <div style="color:#9ca3af;font-size:11px;">${t.ward_name || t.municipality || ""}</div>
        <div style="color:#6b7280;font-size:11px;">${t.date ? fmtDate(t.date) : ""}</div>
        ${t.ward_avg_price_m2 ? `<div style="color:${priceColor(t.ward_avg_price_m2)};font-weight:600;margin-top:4px;">${fmtFull(t.ward_avg_price_m2)}</div>` : ""}
      </div>`);
      markerLayerRef.current?.addLayer(dot);
    }
  }

  // ─── Navigation ───────────────────────────────────────────────────────────
  const drillRegion = useCallback((region: GeoItem) => {
    setSelectedRegion(region); setSelectedDistrict(null); setSelectedTown(null); setHoveredId(null);
    mapRef.current?.flyTo([region.lat, region.lon], 9, { duration: 0.8 });
    setLoading(true);
    fetch(`/api/map/price-levels?level=districts&region_id=${region.id}`)
      .then(r => r.json())
      .then(data => { setDistricts(data.items || []); setTowns([]); setTransactions([]); setLevel("districts"); })
      .finally(() => setLoading(false));
  }, []);

  const drillDistrict = useCallback((district: GeoItem) => {
    setSelectedDistrict(district); setSelectedTown(null); setHoveredId(null);
    mapRef.current?.flyTo([district.lat, district.lon], 11, { duration: 0.8 });
    setLoading(true);
    fetch(`/api/map/price-levels?level=towns&district_id=${district.id}`)
      .then(r => r.json())
      .then(data => { setTowns(data.items || []); setDistricts([]); setTransactions([]); setLevel("towns"); })
      .finally(() => setLoading(false));
  }, []);

  const drillTown = useCallback((town: TownItem) => {
    setSelectedTown(town); setHoveredId(null);
    mapRef.current?.flyTo([town.lat, town.lon], 13, { duration: 0.8 });
    setLoading(true);
    fetch(`/api/map/price-levels?level=transactions&district_id=${town.district_id}`)
      .then(r => r.json())
      .then(data => {
        // Filter to just this ward's transactions if possible
        const all = data.items || [];
        setTransactions(all); setTowns([]); setLevel("transactions");
      })
      .finally(() => setLoading(false));
  }, []);

  function backToRegions() {
    setSelectedRegion(null); setSelectedDistrict(null); setSelectedTown(null);
    setDistricts([]); setTowns([]); setTransactions([]);
    setLevel("regions");
    mapRef.current?.flyTo([49.8, 15.5], 7, { duration: 0.8 });
  }

  function backToDistricts() {
    if (!selectedRegion) return;
    setSelectedDistrict(null); setSelectedTown(null); setTowns([]); setTransactions([]);
    mapRef.current?.flyTo([selectedRegion.lat, selectedRegion.lon], 9, { duration: 0.8 });
    setLoading(true);
    fetch(`/api/map/price-levels?level=districts&region_id=${selectedRegion.id}`)
      .then(r => r.json())
      .then(data => { setDistricts(data.items || []); setLevel("districts"); })
      .finally(() => setLoading(false));
  }

  function backToTowns() {
    if (!selectedDistrict) return;
    setSelectedTown(null); setTransactions([]);
    mapRef.current?.flyTo([selectedDistrict.lat, selectedDistrict.lon], 11, { duration: 0.8 });
    setLoading(true);
    fetch(`/api/map/price-levels?level=towns&district_id=${selectedDistrict.id}`)
      .then(r => r.json())
      .then(data => { setTowns(data.items || []); setLevel("towns"); })
      .finally(() => setLoading(false));
  }

  // ─── Left panel data ──────────────────────────────────────────────────────
  const regionList   = Array.from(regionPrices.values()).sort((a, b) => (b.avg_price_m2 ?? 0) - (a.avg_price_m2 ?? 0));
  const districtList = districts.slice().sort((a, b) => (b.avg_price_m2 ?? 0) - (a.avg_price_m2 ?? 0));
  const townList     = towns.slice().sort((a, b) => b.tx_count - a.tx_count);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .leaflet-popup-content-wrapper { background:#1a1d27;color:#e5e7eb;border:1px solid #2a2e3d;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.6); }
        .leaflet-popup-tip { background:#1a1d27; }
        .leaflet-popup-close-button { color:#6b7280!important; }
        .leaflet-tooltip { background:#1a1d27;border:1px solid #2a2e3d;border-radius:8px;color:#e5e7eb;padding:6px 10px;box-shadow:0 4px 12px rgba(0,0,0,0.5); }
        .leaflet-tooltip::before { border-top-color:#2a2e3d!important; }
      `}</style>

      <div className="flex rounded-xl overflow-hidden border border-border" style={{ height: "calc(100vh - 180px)", minHeight: 560 }}>

        {/* ── Left panel ── */}
        <div className="w-72 shrink-0 flex flex-col bg-card border-r border-border overflow-hidden">

          {/* Breadcrumb */}
          <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
            <div className="flex items-center gap-1 text-xs flex-wrap">
              <button onClick={backToRegions} className={`transition-colors ${level === "regions" ? "text-foreground font-semibold" : "text-muted hover:text-foreground"}`}>
                Česká republika
              </button>
              {selectedRegion && (<>
                <span className="text-border">›</span>
                <button onClick={backToDistricts} className={`transition-colors ${level === "districts" ? "text-foreground font-semibold" : "text-muted hover:text-foreground"}`}>
                  {selectedRegion.name}
                </button>
              </>)}
              {selectedDistrict && (<>
                <span className="text-border">›</span>
                <button onClick={backToTowns} className={`transition-colors ${level === "towns" ? "text-foreground font-semibold" : "text-muted hover:text-foreground"}`}>
                  {selectedDistrict.name}
                </button>
              </>)}
              {selectedTown && (<>
                <span className="text-border">›</span>
                <span className="text-foreground font-semibold">{selectedTown.name}</span>
              </>)}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">
                {level === "regions"      && `${regionList.length} krajů`}
                {level === "districts"    && `${districtList.length} okresů`}
                {level === "towns"        && `${townList.length} obcí / částí`}
                {level === "transactions" && `${transactions.length} transakcí`}
                {(loading || geoLoading) && <span className="ml-1 animate-pulse">…</span>}
              </span>
              {level !== "regions" && (
                <button
                  onClick={level === "transactions" ? backToTowns : level === "towns" ? backToDistricts : backToRegions}
                  className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                  Zpět
                </button>
              )}
            </div>

            {/* Selected district summary */}
            {selectedDistrict?.avg_price_m2 && level !== "districts" && (
              <div className="rounded-lg border border-border/50 bg-background/50 px-3 py-2">
                <div className="text-xs text-muted">Průměr okresu</div>
                <div className="text-base font-bold" style={{ color: priceColor(selectedDistrict.avg_price_m2) }}>
                  {fmtFull(selectedDistrict.avg_price_m2)}
                </div>
              </div>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {level === "transactions" ? (
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-sm font-semibold">{transactions.length} prodejů</div>
                  <div className="text-xs text-muted mt-0.5">Kliknutím na bod zobrazíte detail</div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "< 40k Kč/m²", color: "#22c55e", fn: (p: number) => p < 40000 },
                    { label: "40 – 80k",     color: "#eab308", fn: (p: number) => p >= 40000 && p < 80000 },
                    { label: "80 – 140k",    color: "#f97316", fn: (p: number) => p >= 80000 && p < 140000 },
                    { label: "> 140k",       color: "#dc2626", fn: (p: number) => p >= 140000 },
                  ].map(band => {
                    const count = transactions.filter(t => t.ward_avg_price_m2 && band.fn(t.ward_avg_price_m2)).length;
                    const pct = transactions.length > 0 ? Math.round(count / transactions.length * 100) : 0;
                    return (
                      <div key={band.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted">{band.label}</span>
                          <span className="font-semibold" style={{ color: band.color }}>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-border overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: band.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : level === "towns" ? (
              townList.map(t => {
                const isHov = t.id === hoveredId;
                const price = t.avg_price_m2;
                return (
                  <button
                    key={t.id}
                    onClick={() => drillTown(t)}
                    onMouseEnter={() => setHoveredId(t.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 text-left transition-all ${isHov ? "bg-accent/8" : "hover:bg-card-hover"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium truncate ${isHov ? "text-accent-light" : "text-foreground"}`}>{t.name}</div>
                      <div className="text-xs text-muted mt-0.5">{t.tx_count.toLocaleString("cs-CZ")} transakcí</div>
                    </div>
                    <div className="shrink-0 text-right">
                      {price ? (
                        <><div className="text-sm font-bold" style={{ color: priceColor(price) }}>{fmtK(price)}</div>
                        <div className="text-[10px] text-muted">Kč/m²</div></>
                      ) : <span className="text-xs text-muted">—</span>}
                    </div>
                  </button>
                );
              })
            ) : (
              (level === "regions" ? regionList : districtList).map(item => {
                const isHov = item.id === hoveredId;
                return (
                  <button
                    key={item.id}
                    onClick={() => level === "regions" ? drillRegion(item) : drillDistrict(item)}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 text-left transition-all ${isHov ? "bg-accent/8" : "hover:bg-card-hover"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium truncate ${isHov ? "text-accent-light" : "text-foreground"}`}>{item.name}</div>
                      <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
                        <span>{item.transactions?.toLocaleString("cs-CZ")} tx</span>
                        {item.price_change != null && Math.abs(item.price_change) > 0.5 && (
                          <span className={item.price_change > 0 ? "text-red" : "text-green"}>
                            {item.price_change > 0 ? "↑" : "↓"}{Math.abs(item.price_change).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {item.avg_price_m2 ? (
                        <><div className="text-sm font-bold" style={{ color: priceColor(item.avg_price_m2) }}>{fmtK(item.avg_price_m2)}</div>
                        <div className="text-[10px] text-muted">Kč/m²</div></>
                      ) : <span className="text-xs text-muted">—</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="text-[11px] text-muted font-medium uppercase tracking-wider mb-2">Cena / m²</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {[
                { color: "#22c55e", label: "< 40 000" }, { color: "#84cc16", label: "40 – 60k" },
                { color: "#eab308", label: "60 – 80k" }, { color: "#f97316", label: "80 – 100k" },
                { color: "#ef4444", label: "100 – 140k" }, { color: "#dc2626", label: "> 140 000" },
              ].map(b => (
                <div key={b.color} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: b.color }} />
                  <span className="text-[11px] text-muted">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Map ── */}
        <div className="flex-1 relative">
          {geoLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span className="text-sm text-muted">Načítání hranic krajů…</span>
              </div>
            </div>
          )}
          <div ref={mapContainerRef} className="h-full w-full" />
          {!geoLoading && (
            <div className="absolute bottom-4 right-4 rounded-lg bg-background/80 backdrop-blur-sm px-3 py-2 text-xs text-muted border border-border/40 pointer-events-none">
              {level === "regions"      && "Klikněte na kraj → okresy"}
              {level === "districts"    && "Klikněte na okres → města"}
              {level === "towns"        && "Klikněte na město → transakce"}
              {level === "transactions" && `${transactions.length} prodejů · klik pro detail`}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
