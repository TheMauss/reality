import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * Returns listings with GPS for map display.
 * For listings without GPS in DB, we skip them (GPS will be populated on next scrape).
 *
 * Query params:
 * - category: filter by category
 * - location: filter by location (LIKE)
 * - limit: max results (default 500)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") || "";
  const location = sp.get("location") || "";
  const limit = Math.min(parseInt(sp.get("limit") || "500", 10), 2000);

  const db = getDB();

  let where = "WHERE lat IS NOT NULL AND lon IS NOT NULL";
  const params: (string | number)[] = [];

  if (category) {
    where += " AND category = ?";
    params.push(category);
  }
  if (location) {
    where += " AND location LIKE ?";
    params.push(`%${location}%`);
  }

  const listings = db
    .prepare(
      `SELECT
        id, title, location, area_m2, category, price, lat, lon, url,
        CASE WHEN area_m2 > 0 THEN ROUND(price * 1.0 / area_m2) ELSE NULL END as price_m2
      FROM listings
      ${where}
      ORDER BY price DESC
      LIMIT ?`
    )
    .all(...params, limit);

  const total = (
    db
      .prepare(`SELECT COUNT(*) as c FROM listings ${where}`)
      .get(...params) as { c: number }
  ).c;

  return NextResponse.json({ listings, total });
}
