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
  const minPrice = parseInt(sp.get("min_price") || "0", 10);
  const maxPrice = parseInt(sp.get("max_price") || "0", 10);
  const minArea = parseInt(sp.get("min_area") || "0", 10);
  const maxArea = parseInt(sp.get("max_area") || "0", 10);
  const layout = sp.get("layout") || "";
  const limit = Math.min(parseInt(sp.get("limit") || "500", 10), 2000);

  const db = getDB();

  let where = "WHERE lat IS NOT NULL AND lon IS NOT NULL AND removed_at IS NULL";
  const params: (string | number)[] = [];

  const categories = category ? category.split(",").map(s => s.trim()).filter(Boolean) : [];
  if (categories.length === 1) { where += " AND category = ?"; params.push(categories[0]); }
  else if (categories.length > 1) { where += ` AND category IN (${categories.map(() => "?").join(",")})`; params.push(...categories); }
  if (location) { where += " AND location LIKE ?"; params.push(`%${location}%`); }
  if (minPrice) { where += " AND price >= ?"; params.push(minPrice); }
  if (maxPrice) { where += " AND price <= ?"; params.push(maxPrice); }
  if (minArea)  { where += " AND area_m2 >= ?"; params.push(minArea); }
  if (maxArea)  { where += " AND area_m2 <= ?"; params.push(maxArea); }
  const layouts = layout ? layout.split(",").map(s => s.trim()).filter(Boolean) : [];
  if (layouts.length === 1) { where += " AND title LIKE ?"; params.push(`%${layouts[0]}%`); }
  else if (layouts.length > 1) { where += ` AND (${layouts.map(() => "title LIKE ?").join(" OR ")})`; params.push(...layouts.map(l => `%${l}%`)); }

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
