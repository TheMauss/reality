import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET() {
  const db = getDB();

  // Check if sold tables exist
  const tableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sold_regions'")
    .get();

  if (!tableExists) {
    return NextResponse.json({ regions: [], message: "Run scrape-sold first" });
  }

  const regions = db
    .prepare(
      `SELECT r.*,
        (SELECT COUNT(*) FROM sold_districts WHERE region_id = r.id) as district_count,
        (SELECT COUNT(*) FROM sold_wards WHERE region_id = r.id) as ward_count
      FROM sold_regions r
      ORDER BY r.avg_price_m2 DESC`
    )
    .all();

  // Get latest sold price + YOY from price history for each region
  const latestPrices = db
    .prepare(
      `WITH latest AS (
        SELECT entity_id, avg_price_m2, year, month
        FROM sold_price_history
        WHERE entity_type = 'region' AND category = 'byty'
        GROUP BY entity_id
        HAVING (year * 100 + month) = MAX(year * 100 + month)
      )
      SELECT l.entity_id, l.avg_price_m2,
        CASE WHEN p.avg_price_m2 > 0
             THEN ROUND((l.avg_price_m2 - p.avg_price_m2) / p.avg_price_m2 * 100, 1)
             ELSE NULL END as yoy_pct,
        l.year as latest_year, l.month as latest_month,
        p.avg_price_m2 as prev_year_price
      FROM latest l
      LEFT JOIN sold_price_history p
        ON p.entity_id = l.entity_id
        AND p.entity_type = 'region' AND p.category = 'byty'
        AND p.year = l.year - 1 AND p.month = l.month`
    )
    .all() as Array<{ entity_id: number; avg_price_m2: number; yoy_pct: number | null; latest_year: number; latest_month: number; prev_year_price: number | null }>;

  const latestPriceMap = Object.fromEntries(
    latestPrices.map((p) => [p.entity_id, p])
  );

  // Asking prices + liquidity per region from listings
  const askingPrices = db
    .prepare(
      `SELECT l.region_id,
        ROUND(AVG(CASE WHEN l.area_m2 > 0 AND l.category = 'byty-prodej' THEN l.price * 1.0 / l.area_m2 END)) as asking_m2,
        COUNT(CASE WHEN l.category = 'byty-prodej' THEN 1 END) as listing_count,
        ROUND(AVG(CASE WHEN l.removed_at IS NULL AND l.category = 'byty-prodej' THEN julianday('now') - julianday(l.first_seen_at) END)) as avg_dom,
        ROUND(
          COUNT(DISTINCT CASE WHEN l.removed_at IS NULL AND l.category = 'byty-prodej' THEN pd.listing_id END) * 100.0
          / NULLIF(COUNT(DISTINCT CASE WHEN l.removed_at IS NULL AND l.category = 'byty-prodej' THEN l.id END), 0)
        , 1) as drop_rate_pct
      FROM listings l
      LEFT JOIN (SELECT DISTINCT listing_id FROM price_drops) pd ON pd.listing_id = l.id
      WHERE l.region_id IS NOT NULL
      GROUP BY l.region_id`
    )
    .all() as Array<{ region_id: number; asking_m2: number | null; listing_count: number; avg_dom: number | null; drop_rate_pct: number | null }>;

  const askingMap = Object.fromEntries(
    askingPrices.map((a) => [a.region_id, a])
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (regions as any[]).map((r) => {
    // Use latest price from history, fallback to DB avg
    const histEntry = latestPriceMap[r.id as number];
    const lastSoldPrice = histEntry?.avg_price_m2 ?? (r.avg_price_m2 as number);
    const entry = askingMap[r.id as number];
    return {
      ...r,
      avg_price_m2: lastSoldPrice,
      yoy_pct: histEntry?.yoy_pct ?? null,
      prev_year_price: histEntry?.prev_year_price ?? null,
      asking_m2: entry?.asking_m2 ?? null,
      listing_count: entry?.listing_count ?? 0,
      spread: entry?.asking_m2 && lastSoldPrice
        ? (((entry.asking_m2 - lastSoldPrice) / lastSoldPrice) * 100)
        : null,
      avg_dom: entry?.avg_dom ?? null,
      drop_rate_pct: entry?.drop_rate_pct ?? null,
    };
  });

  return NextResponse.json({ regions: enriched });
}
