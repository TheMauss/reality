import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * Serves sold transactions with GPS from our local DB.
 * Query params:
 *   category: "byty" | "domy" (default: all)
 *   date_from: "2020-01" (YYYY-MM)
 *   date_to:   "2026-03" (YYYY-MM)
 *   limit:     max 8000 (default 5000)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") || "";
  const dateFrom = sp.get("date_from") || "";
  const dateTo = sp.get("date_to") || "";
  const limit = Math.min(parseInt(sp.get("limit") || "5000", 10), 8000);

  const db = getDB();

  const conditions: string[] = ["lat IS NOT NULL", "lon IS NOT NULL"];
  const params: (string | number)[] = [];

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }
  if (dateFrom) {
    conditions.push("validation_date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("validation_date <= ?");
    params.push(dateTo + "-31");
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const transactions = db
    .prepare(
      `SELECT id, title, validation_date as date, lat, lon,
              address, ward_name, ward_avg_price_m2, category, municipality
       FROM sold_transactions
       ${where}
       ORDER BY validation_date DESC
       LIMIT ?`
    )
    .all(...params, limit);

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM sold_transactions ${where}`).get(...params) as { c: number }
  ).c;

  return NextResponse.json({ transactions, count: (transactions as unknown[]).length, total });
}
