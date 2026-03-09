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

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM price_drops pd ${where}`)
    .get(...params) as { total: number };

  const rows = db
    .prepare(
      `SELECT pd.*, l.price as current_price, l.url as listing_url, l.first_seen_at
       FROM price_drops pd
       LEFT JOIN listings l ON l.id = pd.listing_id
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
