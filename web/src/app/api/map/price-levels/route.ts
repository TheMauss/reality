import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// Approximate centroids for Czech regions (Sreality region IDs)
const REGION_CENTROIDS: Record<number, [number, number]> = {
  1:  [49.05, 14.48],  // Jihočeský
  2:  [49.74, 13.38],  // Plzeňský
  3:  [50.23, 12.87],  // Karlovarský
  4:  [50.65, 13.90],  // Ústecký
  5:  [50.76, 15.05],  // Liberecký
  6:  [50.35, 15.83],  // Královéhradecký
  7:  [49.95, 15.75],  // Pardubický
  8:  [49.60, 17.25],  // Olomoucký
  9:  [49.22, 17.66],  // Zlínský
  10: [50.075, 14.44], // Praha
  11: [49.90, 14.70],  // Středočeský
  12: [49.80, 18.25],  // Moravskoslezský
  13: [49.43, 15.60],  // Vysočina
  14: [49.20, 16.60],  // Jihomoravský
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const level = sp.get("level") || "regions";
  const regionId = sp.get("region_id");
  const districtId = sp.get("district_id");

  const db = getDB();

  // ── Level 1: all regions ──────────────────────────────────────────────────
  if (level === "regions") {
    const rows = await db.prepare(`
      SELECT r.id, r.name, r.transactions, r.price_change,
        COALESCE(
          (SELECT h.avg_price_m2 FROM sold_price_history h
           WHERE h.entity_type = 'region' AND h.entity_id = r.id AND h.category = 'byty'
           ORDER BY h.year DESC, h.month DESC LIMIT 1),
          r.avg_price_m2
        ) as avg_price_m2
      FROM sold_regions r
      WHERE r.avg_price_m2 IS NOT NULL
      ORDER BY r.transactions DESC
    `).all() as { id: number; name: string; avg_price_m2: number; transactions: number; price_change: number | null }[];

    const items = rows.map(r => ({
      ...r,
      lat: REGION_CENTROIDS[r.id]?.[0] ?? null,
      lon: REGION_CENTROIDS[r.id]?.[1] ?? null,
    })).filter(r => r.lat !== null);

    return NextResponse.json({ level: "regions", items });
  }

  // ── Level 2: districts for a region ──────────────────────────────────────
  if (level === "districts" && regionId) {
    // Compute centroid per district by averaging a sample of transaction GPS; use latest history price
    const rows = await db.prepare(`
      SELECT
        sd.id, sd.name, sd.transactions, sd.price_change, sd.region_id,
        COALESCE(
          (SELECT h.avg_price_m2 FROM sold_price_history h
           WHERE h.entity_type = 'district' AND h.entity_id = sd.id AND h.category = 'byty'
           ORDER BY h.year DESC, h.month DESC LIMIT 1),
          sd.avg_price_m2
        ) as avg_price_m2,
        AVG(t.lat) as lat,
        AVG(t.lon) as lon
      FROM sold_districts sd
      JOIN sold_wards sw ON sw.district_id = sd.id
      JOIN sold_transactions t ON t.ward_id = sw.id AND t.lat IS NOT NULL AND t.lon IS NOT NULL
      WHERE sd.region_id = ?
      GROUP BY sd.id
      HAVING lat IS NOT NULL
      ORDER BY sd.transactions DESC
    `).all(parseInt(regionId, 10)) as {
      id: number; name: string; avg_price_m2: number; transactions: number;
      price_change: number | null; region_id: number; lat: number; lon: number;
    }[];

    return NextResponse.json({ level: "districts", items: rows });
  }

  // ── Level 3: transactions for a district (limit to keep DB light) ─────────
  if (level === "transactions" && districtId) {
    const wardIds = (await db.prepare(`
      SELECT id FROM sold_wards WHERE district_id = ?
    `).all(parseInt(districtId, 10)) as { id: number }[]).map(r => r.id);

    if (wardIds.length === 0) {
      return NextResponse.json({ level: "transactions", items: [], wardCount: 0 });
    }

    const placeholders = wardIds.map(() => "?").join(",");
    const transactions = await db.prepare(`
      SELECT
        id, lat, lon, title, validation_date AS date,
        ward_avg_price_m2, ward_name, municipality
      FROM sold_transactions
      WHERE ward_id IN (${placeholders})
        AND lat IS NOT NULL AND lon IS NOT NULL
      ORDER BY validation_date DESC
      LIMIT 800
    `).all(...wardIds) as {
      id: number; lat: number; lon: number; title: string; date: string;
      ward_avg_price_m2: number | null; ward_name: string; municipality: string;
    }[];

    return NextResponse.json({
      level: "transactions",
      items: transactions,
      wardCount: wardIds.length,
    });
  }

  // ── Level 2b: wards (towns) for a district — bubble map level ───────────
  if (level === "towns" && districtId) {
    const rows = await db.prepare(`
      SELECT
        sw.id, sw.name, sw.district_id,
        COUNT(t.id) as tx_count,
        AVG(t.lat) as lat,
        AVG(t.lon) as lon,
        AVG(t.ward_avg_price_m2) as avg_price_m2
      FROM sold_wards sw
      JOIN sold_transactions t ON t.ward_id = sw.id AND t.lat IS NOT NULL AND t.lon IS NOT NULL
      WHERE sw.district_id = ?
      GROUP BY sw.id
      HAVING tx_count >= 3
      ORDER BY tx_count DESC
    `).all(parseInt(districtId, 10)) as {
      id: number; name: string; district_id: number;
      tx_count: number; lat: number; lon: number; avg_price_m2: number | null;
    }[];

    return NextResponse.json({ level: "towns", items: rows });
  }

  return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
}
