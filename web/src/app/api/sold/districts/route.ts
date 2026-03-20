import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(req: NextRequest) {
  const regionId = req.nextUrl.searchParams.get("region_id");
  if (!regionId) {
    return NextResponse.json({ error: "Missing region_id" }, { status: 400 });
  }

  const db = getDB();

  const region = await db
    .prepare("SELECT * FROM sold_regions WHERE id = ?")
    .get(regionId);

  const districts = await db
    .prepare(
      `SELECT d.*,
        (SELECT COUNT(*) FROM sold_wards WHERE district_id = d.id) as ward_count,
        (SELECT COUNT(*) FROM sold_transactions t JOIN sold_wards w ON t.ward_id = w.id WHERE w.district_id = d.id) as transaction_count,
        (SELECT h.avg_price_m2 FROM sold_price_history h
         WHERE h.entity_type = 'district' AND h.entity_id = d.id AND h.category = 'byty'
         ORDER BY h.year DESC, h.month DESC LIMIT 1) as latest_price_m2
      FROM sold_districts d
      WHERE d.region_id = ?
      ORDER BY d.avg_price_m2 DESC`
    )
    .all(regionId);

  // Asking + rental prices + liquidity per district from listings
  const askingPrices = await db
    .prepare(
      `SELECT l.district_id,
        ROUND(AVG(CASE WHEN l.area_m2 > 0 AND l.category = 'byty-prodej' THEN l.price * 1.0 / l.area_m2 END)) as asking_m2,
        COUNT(CASE WHEN l.category = 'byty-prodej' THEN 1 END) as listing_count,
        ROUND(AVG(CASE WHEN l.area_m2 > 0 AND l.category = 'byty-najem' THEN l.price * 1.0 / l.area_m2 END)) as rent_m2,
        ROUND(AVG(CASE WHEN l.removed_at IS NULL AND l.category = 'byty-prodej' THEN julianday('now') - julianday(l.first_seen_at) END)) as avg_dom,
        ROUND(
          COUNT(DISTINCT CASE WHEN l.removed_at IS NULL AND l.category = 'byty-prodej' THEN pd.listing_id END) * 100.0
          / NULLIF(COUNT(DISTINCT CASE WHEN l.removed_at IS NULL AND l.category = 'byty-prodej' THEN l.id END), 0)
        , 1) as drop_rate_pct
      FROM listings l
      LEFT JOIN (SELECT DISTINCT listing_id FROM price_drops) pd ON pd.listing_id = l.id
      WHERE l.district_id IS NOT NULL AND l.region_id = ?
      GROUP BY l.district_id`
    )
    .all(regionId) as Array<{ district_id: number; asking_m2: number | null; listing_count: number; rent_m2: number | null; avg_dom: number | null; drop_rate_pct: number | null }>;

  const askingMap = Object.fromEntries(
    askingPrices.map((a) => [a.district_id, a])
  );

  // Region-level fallback (when listings lack district_id)
  const regionFallback = await db
    .prepare(
      `SELECT
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-najem' THEN price * 1.0 / area_m2 END)) as rent_m2,
        ROUND(AVG(CASE WHEN removed_at IS NULL AND category = 'byty-prodej' THEN julianday('now') - julianday(first_seen_at) END)) as avg_dom,
        ROUND(
          COUNT(DISTINCT CASE WHEN removed_at IS NULL AND category = 'byty-prodej' THEN pd.listing_id END) * 100.0
          / NULLIF(COUNT(DISTINCT CASE WHEN removed_at IS NULL AND category = 'byty-prodej' THEN listings.id END), 0)
        , 1) as drop_rate_pct
      FROM listings
      LEFT JOIN (SELECT DISTINCT listing_id FROM price_drops) pd ON pd.listing_id = listings.id
      WHERE region_id = ?`
    )
    .get(regionId) as { rent_m2: number | null; avg_dom: number | null; drop_rate_pct: number | null } | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (districts as any[]).map((d) => {
    const lastSoldPrice = d.latest_price_m2 ?? d.avg_price_m2;
    const entry = askingMap[d.id];
    const rentM2 = entry?.rent_m2 ?? regionFallback?.rent_m2 ?? null;
    const avgDom = entry?.avg_dom ?? regionFallback?.avg_dom ?? null;
    const dropRatePct = entry?.drop_rate_pct ?? regionFallback?.drop_rate_pct ?? null;
    return {
      ...d,
      avg_price_m2: lastSoldPrice,
      asking_m2: entry?.asking_m2 ?? null,
      listing_count: entry?.listing_count ?? 0,
      rent_m2: rentM2,
      yield_pct: rentM2 && lastSoldPrice ? ((rentM2 * 12) / lastSoldPrice) * 100 : null,
      spread: entry?.asking_m2 && lastSoldPrice
        ? (((entry.asking_m2 - lastSoldPrice) / lastSoldPrice) * 100)
        : null,
      avg_dom: avgDom,
      drop_rate_pct: dropRatePct,
    };
  });

  // Region-level asking price as fallback (when listings lack district_id)
  const regionAsking = await db
    .prepare(
      `SELECT
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as asking_m2,
        COUNT(CASE WHEN category = 'byty-prodej' THEN 1 END) as listing_count
      FROM listings
      WHERE region_id = ?`
    )
    .get(regionId) as { asking_m2: number | null; listing_count: number } | undefined;

  return NextResponse.json({ region, districts: enriched, region_asking_m2: regionAsking?.asking_m2 ?? null, region_listing_count: regionAsking?.listing_count ?? 0 });
}
