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

  // Get latest sold price from price history for each region
  const latestPrices = db
    .prepare(
      `SELECT entity_id, avg_price_m2
      FROM sold_price_history
      WHERE entity_type = 'region' AND category = 'byty'
        AND (year * 100 + month) = (
          SELECT MAX(year * 100 + month)
          FROM sold_price_history h2
          WHERE h2.entity_type = 'region' AND h2.entity_id = sold_price_history.entity_id AND h2.category = 'byty'
        )`
    )
    .all() as Array<{ entity_id: number; avg_price_m2: number }>;

  const latestPriceMap = Object.fromEntries(
    latestPrices.map((p) => [p.entity_id, p.avg_price_m2])
  );

  // Also get asking price averages from listings per region
  const askingPrices = db
    .prepare(
      `SELECT region_id,
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as asking_m2,
        COUNT(CASE WHEN category = 'byty-prodej' THEN 1 END) as listing_count
      FROM listings
      WHERE region_id IS NOT NULL
      GROUP BY region_id`
    )
    .all() as Array<{ region_id: number; asking_m2: number | null; listing_count: number }>;

  const askingMap = Object.fromEntries(
    askingPrices.map((a) => [a.region_id, a])
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (regions as any[]).map((r) => {
    // Use latest price from history, fallback to DB avg
    const lastSoldPrice = latestPriceMap[r.id as number] ?? (r.avg_price_m2 as number);
    return {
      ...r,
      avg_price_m2: lastSoldPrice,
      asking_m2: askingMap[r.id as number]?.asking_m2 ?? null,
      listing_count: askingMap[r.id as number]?.listing_count ?? 0,
      spread: askingMap[r.id as number]?.asking_m2 && lastSoldPrice
        ? (((askingMap[r.id as number].asking_m2! - lastSoldPrice) / lastSoldPrice) * 100)
        : null,
    };
  });

  return NextResponse.json({ regions: enriched });
}
