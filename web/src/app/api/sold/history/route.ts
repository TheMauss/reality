import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/** Returns monthly price history for a given entity (country, region, district) */
export async function GET(req: NextRequest) {
  const entityType = req.nextUrl.searchParams.get("entity_type") || "country";
  const entityId = req.nextUrl.searchParams.get("entity_id") || "112";
  const category = req.nextUrl.searchParams.get("category") || "byty";

  const db = getDB();

  const history = db
    .prepare(
      `SELECT year, month, avg_price_m2
      FROM sold_price_history
      WHERE entity_type = ? AND entity_id = ? AND category = ?
      ORDER BY year ASC, month ASC`
    )
    .all(entityType, entityId, category) as Array<{
    year: number;
    month: number;
    avg_price_m2: number;
  }>;

  const points = history.map((h) => ({
    year: h.year,
    month: h.month,
    avgPriceM2: h.avg_price_m2,
    label: `${String(h.month).padStart(2, "0")}/${h.year}`,
  }));

  return NextResponse.json({ history: points, entityType, entityId });
}
