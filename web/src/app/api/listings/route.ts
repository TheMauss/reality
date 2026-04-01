import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") || "";
  const location = sp.get("location") || "";
  const sort = sp.get("sort") || "price_asc";
  const minPrice = parseInt(sp.get("min_price") || "0", 10);
  const maxPrice = parseInt(sp.get("max_price") || "0", 10);
  const minArea = parseInt(sp.get("min_area") || "0", 10);
  const maxArea = parseInt(sp.get("max_area") || "0", 10);
  const layout  = sp.get("layout") || "";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const perPage = 30;
  const offset = (page - 1) * perPage;

  const db = getDB();

  let where = "WHERE removed_at IS NULL";
  const params: (string | number)[] = [];

  // Support comma-separated categories (e.g. "byty-prodej,domy-prodej")
  const categories = category ? category.split(",").map(s => s.trim()).filter(Boolean) : [];
  if (categories.length === 1) {
    where += " AND category = ?";
    params.push(categories[0]);
  } else if (categories.length > 1) {
    where += ` AND category IN (${categories.map(() => "?").join(",")})`;
    params.push(...categories);
  }

  if (location) {
    where += " AND location LIKE ?";
    params.push(`%${location}%`);
  }
  if (minPrice > 0) {
    where += " AND price >= ?";
    params.push(minPrice);
  }
  if (maxPrice > 0) {
    where += " AND price <= ?";
    params.push(maxPrice);
  }
  if (minArea > 0) {
    where += " AND area_m2 >= ?";
    params.push(minArea);
  }
  if (maxArea > 0) {
    where += " AND area_m2 <= ?";
    params.push(maxArea);
  }
  // Support comma-separated layouts (e.g. "1+kk,2+kk") — use dispozice column for indexed lookups
  const layouts = layout ? layout.split(",").map(s => s.trim()).filter(Boolean) : [];
  if (layouts.length === 1) {
    where += " AND dispozice = ?";
    params.push(layouts[0]);
  } else if (layouts.length > 1) {
    where += ` AND dispozice IN (${layouts.map(() => "?").join(",")})`;
    params.push(...layouts);
  }

  const sortMap: Record<string, string> = {
    price_asc: "price ASC",
    price_desc: "price DESC",
    area_asc: "area_m2 ASC",
    area_desc: "area_m2 DESC",
    price_m2_asc: "CASE WHEN area_m2 > 0 THEN price * 1.0 / area_m2 ELSE 999999999 END ASC",
    price_m2_desc: "CASE WHEN area_m2 > 0 THEN price * 1.0 / area_m2 ELSE 0 END DESC",
    newest: "first_seen_at DESC",
  };
  const orderBy = sortMap[sort] || "price ASC";

  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM listings ${where}`)
    .get(...params) as unknown as { total: number };

  const rows = await db
    .prepare(
      `SELECT l.id, l.title, l.url, l.location, l.area_m2, l.category, l.dispozice,
        l.price, l.first_seen_at, l.last_seen_at, l.lat, l.lon, l.region_id, l.district_id,
        l.image_url,
        CASE WHEN l.area_m2 > 0 THEN ROUND(l.price * 1.0 / l.area_m2) ELSE NULL END as price_m2,
        sd.avg_price_m2 as market_price_m2,
        CASE WHEN sd.avg_price_m2 > 0 AND l.area_m2 > 0
          THEN ROUND(((l.price * 1.0 / l.area_m2) - sd.avg_price_m2) / sd.avg_price_m2 * 100, 1)
          ELSE NULL END as vs_market_pct
       FROM listings l
       LEFT JOIN sold_districts sd ON sd.id = l.district_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...params, perPage, offset);

  return NextResponse.json({
    listings: rows,
    total: countRow.total,
    page,
    pages: Math.ceil(countRow.total / perPage),
  });
}
