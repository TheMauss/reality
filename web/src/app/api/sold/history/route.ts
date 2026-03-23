import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/** Returns monthly price history + transaction counts for a given entity */
export async function GET(req: NextRequest) {
  const entityType = req.nextUrl.searchParams.get("entity_type") || "country";
  const entityId = req.nextUrl.searchParams.get("entity_id") || "112";
  const category = req.nextUrl.searchParams.get("category") || "byty";

  const db = getDB();

  const history = await db
    .prepare(
      `SELECT year, month, avg_price_m2
       FROM sold_price_history
       WHERE entity_type = ? AND entity_id = ? AND category = ?
       ORDER BY year ASC, month ASC`
    )
    .all(entityType, entityId, category) as unknown as Array<{
    year: number;
    month: number;
    avg_price_m2: number;
  }>;

  // Monthly transaction counts per entity type
  // Volume: SUM(area_m2 * ward_avg_price_m2) per month, fallback to 62m² if area_m2 NULL
  let txCounts: Array<{ year: string; month: number; count: number; vol_mil_czk: number }> = [];
  try {
    const volExpr = `ROUND(SUM(COALESCE(t.area_m2, 62) * t.ward_avg_price_m2) / 1000000)`;
    if (entityType === "country") {
      txCounts = await db.prepare(`
        SELECT strftime('%Y', validation_date) as year,
               CAST(strftime('%m', validation_date) AS INTEGER) as month,
               COUNT(*) as count,
               ${volExpr} as vol_mil_czk
        FROM sold_transactions t
        WHERE category = ?
        GROUP BY year, month
      `).all(category) as unknown as typeof txCounts;
    } else if (entityType === "region") {
      txCounts = await db.prepare(`
        SELECT strftime('%Y', t.validation_date) as year,
               CAST(strftime('%m', t.validation_date) AS INTEGER) as month,
               COUNT(*) as count,
               ${volExpr} as vol_mil_czk
        FROM sold_transactions t
        JOIN sold_wards w ON t.ward_id = w.id
        WHERE w.region_id = ? AND t.category = ?
        GROUP BY year, month
      `).all(entityId, category) as unknown as typeof txCounts;
    } else if (entityType === "district") {
      txCounts = await db.prepare(`
        SELECT strftime('%Y', t.validation_date) as year,
               CAST(strftime('%m', t.validation_date) AS INTEGER) as month,
               COUNT(*) as count,
               ${volExpr} as vol_mil_czk
        FROM sold_transactions t
        JOIN sold_wards w ON t.ward_id = w.id
        WHERE w.district_id = ? AND t.category = ?
        GROUP BY year, month
      `).all(entityId, category) as unknown as typeof txCounts;
    }
  } catch { /* table might not exist */ }

  const txLookup = new Map<string, number>();
  for (const r of txCounts) {
    txLookup.set(`${r.year}-${r.month}`, r.count);
  }

  const volLookup = new Map<string, { count: number; vol_mil_czk: number }>();
  for (const r of txCounts) {
    volLookup.set(`${r.year}-${r.month}`, { count: r.count, vol_mil_czk: r.vol_mil_czk });
  }

  // Build a lookup for YOY: same month, previous year
  const priceByYearMonth = new Map<string, number>(
    history.map(h => [`${h.year}-${h.month}`, h.avg_price_m2])
  );

  const points = history.map(h => {
    const vol = volLookup.get(`${h.year}-${h.month}`);
    const prevPrice = priceByYearMonth.get(`${h.year - 1}-${h.month}`);
    const yoyPct = prevPrice && prevPrice > 0
      ? Math.round((h.avg_price_m2 - prevPrice) / prevPrice * 1000) / 10
      : null;
    return {
      year: h.year,
      month: h.month,
      avgPriceM2: h.avg_price_m2,
      label: `${String(h.month).padStart(2, "0")}/${h.year}`,
      txCount: vol?.count ?? 0,
      volMilCzk: vol?.vol_mil_czk ?? 0,
      yoyPct,
    };
  });

  return NextResponse.json({ history: points, entityType, entityId });
}
