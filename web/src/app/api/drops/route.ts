import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") || "";
  const minDrop = parseFloat(sp.get("min_drop") || "0");
  const location = sp.get("location") || "";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const perPage = 30;
  const offset = (page - 1) * perPage;

  const db = getDB();

  let where = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (category) {
    where += " AND pd.category = ?";
    params.push(category);
  }
  if (minDrop > 0) {
    where += " AND pd.drop_pct >= ?";
    params.push(minDrop);
  }
  if (location) {
    where += " AND pd.location LIKE ?";
    params.push(`%${location}%`);
  }

  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM price_drops pd ${where}`)
    .get(...params) as unknown as { total: number };

  const rows = await db
    .prepare(
      `SELECT pd.*, l.price as current_price, l.url as listing_url, l.first_seen_at,
        sd.avg_price_m2 as market_price_m2,
        CASE WHEN sd.avg_price_m2 > 0 AND l.area_m2 > 0
          THEN ROUND(((pd.new_price / l.area_m2) - sd.avg_price_m2) / sd.avg_price_m2 * 100, 1)
          ELSE NULL END as vs_market_pct,
        (SELECT json_group_array(json_object('source', source, 'url', url))
         FROM listing_sources WHERE listing_id = l.id AND removed_at IS NULL) as sources_json
       FROM price_drops pd
       LEFT JOIN listings l ON l.id = pd.listing_id
       LEFT JOIN sold_districts sd ON sd.id = l.district_id
       ${where}
       ORDER BY pd.detected_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, perPage, offset);

  return NextResponse.json({
    drops: rows,
    total: countRow.total,
    page,
    pages: Math.ceil(countRow.total / perPage),
  });
}
