import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// Czech district GeoJSON sources (tried in order)
// Layer 15 = Okres in CUZK RUIAN MapServer — confirmed 76 features, field "nazev"
const SOURCES = [
  {
    url: "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer/15/query?where=1%3D1&outFields=NAZEV&returnGeometry=true&maxAllowableOffset=0.005&geometryPrecision=4&f=geojson&resultRecordCount=100",
    nameField: (p: Record<string, string>) => p["nazev"] || p["NAZEV"],
  },
  {
    url: "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-czech-republic-okr/exports/geojson",
    nameField: (p: Record<string, string>) => p["okr_name"] || p["okr_nazev"] || p["name"],
  },
];

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")    // strip diacritics
    .replace(/\bhlavni\s+mesto\s+/g, "") // "Hlavní město Praha" → "Praha"
    .replace(/\bokres\s+/g, "")          // strip "Okres" prefix
    .replace(/[^a-z0-9\-]/g, "")        // keep only letters, numbers, hyphens
    .trim();
}

let cachedGeoJSON: { type: string; features: unknown[] } | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 24 * 30 * 1000; // 30 days

/**
 * Fetches Czech district (okres) boundaries as GeoJSON.
 * Primary source: CUZK RUIAN ArcGIS MapServer layer 15 (Okres) — 76 features.
 * Matches features to sold_districts by normalised name, attaches sreality_id + prices.
 */
export async function GET() {
  try {
    // Serve from memory cache
    if (cachedGeoJSON && Date.now() - cacheTime < CACHE_TTL) {
      return NextResponse.json(cachedGeoJSON, {
        headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
      });
    }

    const db = getDB();

    // Load all districts with their names and latest prices
    const districts = await db.prepare(`
      SELECT d.id, d.name, d.region_id,
        COALESCE(
          (SELECT h.avg_price_m2 FROM sold_price_history h
           WHERE h.entity_type = 'district' AND h.entity_id = d.id AND h.category = 'byty'
           ORDER BY h.year DESC, h.month DESC LIMIT 1),
          d.avg_price_m2
        ) as avg_price_m2,
        d.transactions, d.price_change
      FROM sold_districts d
      WHERE d.avg_price_m2 IS NOT NULL
    `).all() as unknown as {
      id: number; name: string; region_id: number;
      avg_price_m2: number | null; transactions: number; price_change: number | null;
    }[];

    // Build normalised-name → district lookup
    const districtByNorm = new Map<string, typeof districts[0]>();
    for (const d of districts) {
      districtByNorm.set(normName(d.name), d);
    }

    // Try each source in order
    let rawFeatures: { properties: Record<string, string>; [k: string]: unknown }[] = [];
    let nameField: ((p: Record<string, string>) => string | undefined) = () => undefined;

    for (const src of SOURCES) {
      try {
        const res = await fetch(src.url, {
          signal: AbortSignal.timeout(25000),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          next: { revalidate: 0 } as any,
        });
        if (!res.ok) continue;
        const data = await res.json() as { features?: unknown[] };
        if (data?.features && data.features.length > 10) {
          rawFeatures = data.features as typeof rawFeatures;
          nameField = src.nameField;
          break;
        }
      } catch {
        // try next source
      }
    }

    if (rawFeatures.length === 0) {
      return NextResponse.json(
        { type: "FeatureCollection", features: [], error: "No district GeoJSON source available" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Enrich features with Sreality district data
    const enriched = rawFeatures.map(feature => {
      const rawName = nameField(feature.properties) || "";
      const norm = normName(rawName);
      const district = districtByNorm.get(norm);

      return {
        ...feature,
        properties: {
          ...feature.properties,
          display_name: rawName,
          sreality_id: district?.id ?? null,
          avg_price_m2: district?.avg_price_m2 ?? null,
          transactions: district?.transactions ?? null,
          price_change: district?.price_change ?? null,
          region_id: district?.region_id ?? null,
        },
      };
    });

    const result = { type: "FeatureCollection", features: enriched };
    cachedGeoJSON = result;
    cacheTime = Date.now();

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    });
  } catch (err) {
    return NextResponse.json(
      { type: "FeatureCollection", features: [], error: String(err) },
      { status: 500 }
    );
  }
}
