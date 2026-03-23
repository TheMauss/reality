import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/** Universal search across locations, wards, districts, regions */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const db = getDB();
  const pattern = `%${q}%`;

  const results: Array<{
    type: string;
    id: number | string;
    name: string;
    parent?: string;
    avg_price_m2?: number;
    count?: number;
  }> = [];

  // Search sold regions (use latest price from history, fallback to table avg)
  try {
    const regions = await db
      .prepare(
        `SELECT r.id, r.name, COALESCE(h.avg_price_m2, r.avg_price_m2) as avg_price_m2
        FROM sold_regions r
        LEFT JOIN (
          SELECT entity_id, avg_price_m2 FROM sold_price_history
          WHERE entity_type = 'region' AND category = 'byty'
          GROUP BY entity_id
          HAVING (year * 100 + month) = MAX(year * 100 + month)
        ) h ON h.entity_id = r.id
        WHERE r.name LIKE ? LIMIT 5`
      )
      .all(pattern) as unknown as Array<{ id: number; name: string; avg_price_m2: number }>;
    for (const r of regions) {
      results.push({ type: "region", id: r.id, name: r.name, avg_price_m2: r.avg_price_m2 });
    }
  } catch { /* table might not exist */ }

  // Search sold districts (use latest price from history, fallback to table avg)
  try {
    const districts = await db
      .prepare(
        `SELECT d.id, d.name, r.name as region_name, COALESCE(h.avg_price_m2, d.avg_price_m2) as avg_price_m2
        FROM sold_districts d
        JOIN sold_regions r ON r.id = d.region_id
        LEFT JOIN (
          SELECT entity_id, avg_price_m2 FROM sold_price_history
          WHERE entity_type = 'district' AND category = 'byty'
          GROUP BY entity_id
          HAVING (year * 100 + month) = MAX(year * 100 + month)
        ) h ON h.entity_id = d.id
        WHERE d.name LIKE ? LIMIT 10`
      )
      .all(pattern) as unknown as Array<{ id: number; name: string; avg_price_m2: number; region_name: string }>;
    for (const d of districts) {
      results.push({ type: "district", id: d.id, name: d.name, parent: d.region_name, avg_price_m2: d.avg_price_m2 });
    }
  } catch { /* */ }

  // Search sold wards (use latest price from history, fallback to ward avg)
  try {
    const wards = await db
      .prepare(
        `SELECT w.id, w.name, d.name as district_name,
          COALESCE(h.avg_price_m2, w.avg_price_m2) as avg_price_m2
        FROM sold_wards w
        JOIN sold_districts d ON d.id = w.district_id
        LEFT JOIN (
          SELECT entity_id, avg_price_m2 FROM sold_price_history
          WHERE entity_type = 'ward' AND category = 'byty'
          GROUP BY entity_id
          HAVING (year * 100 + month) = MAX(year * 100 + month)
        ) h ON h.entity_id = w.id
        WHERE w.name LIKE ?
        GROUP BY w.name, w.district_id
        LIMIT 10`
      )
      .all(pattern) as unknown as Array<{ id: number; name: string; avg_price_m2: number; district_name: string }>;
    for (const w of wards) {
      results.push({ type: "ward", id: w.id, name: w.name, parent: w.district_name, avg_price_m2: w.avg_price_m2 });
    }
  } catch { /* */ }

  // Search listing locations
  const locationCounts = await db
    .prepare(
      `SELECT location, COUNT(*) as count
      FROM listings
      WHERE location LIKE ?
      GROUP BY location
      ORDER BY count DESC
      LIMIT 10`
    )
    .all(pattern) as unknown as Array<{ location: string; count: number }>;
  for (const l of locationCounts) {
    results.push({ type: "location", id: l.location, name: l.location, count: l.count });
  }

  return NextResponse.json({ results });
}
