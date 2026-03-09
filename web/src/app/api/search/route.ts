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

  // Search sold regions
  try {
    const regions = db
      .prepare("SELECT id, name, avg_price_m2 FROM sold_regions WHERE name LIKE ? LIMIT 5")
      .all(pattern) as Array<{ id: number; name: string; avg_price_m2: number }>;
    for (const r of regions) {
      results.push({ type: "region", id: r.id, name: r.name, avg_price_m2: r.avg_price_m2 });
    }
  } catch { /* table might not exist */ }

  // Search sold districts
  try {
    const districts = db
      .prepare(
        `SELECT d.id, d.name, d.avg_price_m2, r.name as region_name
        FROM sold_districts d JOIN sold_regions r ON r.id = d.region_id
        WHERE d.name LIKE ? LIMIT 10`
      )
      .all(pattern) as Array<{ id: number; name: string; avg_price_m2: number; region_name: string }>;
    for (const d of districts) {
      results.push({ type: "district", id: d.id, name: d.name, parent: d.region_name, avg_price_m2: d.avg_price_m2 });
    }
  } catch { /* */ }

  // Search sold wards
  try {
    const wards = db
      .prepare(
        `SELECT w.id, w.name, w.avg_price_m2, d.name as district_name
        FROM sold_wards w JOIN sold_districts d ON d.id = w.district_id
        WHERE w.name LIKE ? LIMIT 10`
      )
      .all(pattern) as Array<{ id: number; name: string; avg_price_m2: number; district_name: string }>;
    for (const w of wards) {
      results.push({ type: "ward", id: w.id, name: w.name, parent: w.district_name, avg_price_m2: w.avg_price_m2 });
    }
  } catch { /* */ }

  // Search listing locations
  const locationCounts = db
    .prepare(
      `SELECT location, COUNT(*) as count
      FROM listings
      WHERE location LIKE ?
      GROUP BY location
      ORDER BY count DESC
      LIMIT 10`
    )
    .all(pattern) as Array<{ location: string; count: number }>;
  for (const l of locationCounts) {
    results.push({ type: "location", id: l.location, name: l.location, count: l.count });
  }

  return NextResponse.json({ results });
}
