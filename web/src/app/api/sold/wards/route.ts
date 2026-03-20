import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(req: NextRequest) {
  const districtId = req.nextUrl.searchParams.get("district_id");
  if (!districtId) {
    return NextResponse.json({ error: "Missing district_id" }, { status: 400 });
  }

  const db = getDB();

  const district = await db
    .prepare(
      `SELECT d.*, r.name as region_name, r.id as region_id
      FROM sold_districts d
      JOIN sold_regions r ON r.id = d.region_id
      WHERE d.id = ?`
    )
    .get(districtId) as Record<string, unknown> | undefined;

  if (district) {
    // Get latest price from history for this district
    const latestPrice = await db
      .prepare(
        `SELECT avg_price_m2 FROM sold_price_history
        WHERE entity_type = 'district' AND entity_id = ? AND category = 'byty'
        ORDER BY year DESC, month DESC LIMIT 1`
      )
      .get(districtId) as { avg_price_m2: number } | undefined;

    if (latestPrice) {
      district.avg_price_m2 = latestPrice.avg_price_m2;
    }
  }

  const wards = await db
    .prepare(
      `SELECT w.*,
        (SELECT COUNT(*) FROM sold_transactions WHERE ward_id = w.id) as transaction_count
      FROM sold_wards w
      WHERE w.district_id = ?
      ORDER BY w.avg_price_m2 DESC`
    )
    .all(districtId);

  // Get asking + rental + liquidity for this district from listings
  const districtAsking = await db
    .prepare(
      `SELECT
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as asking_m2,
        COUNT(CASE WHEN category = 'byty-prodej' THEN 1 END) as listing_count,
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-najem' THEN price * 1.0 / area_m2 END)) as rent_m2,
        ROUND(AVG(CASE WHEN removed_at IS NULL AND category = 'byty-prodej' THEN julianday('now') - julianday(first_seen_at) END)) as avg_dom,
        ROUND(
          COUNT(DISTINCT CASE WHEN removed_at IS NULL AND category = 'byty-prodej' THEN pd.listing_id END) * 100.0
          / NULLIF(COUNT(DISTINCT CASE WHEN removed_at IS NULL AND category = 'byty-prodej' THEN listings.id END), 0)
        , 1) as drop_rate_pct
      FROM listings
      LEFT JOIN (SELECT DISTINCT listing_id FROM price_drops) pd ON pd.listing_id = listings.id
      WHERE district_id = ?`
    )
    .get(districtId) as { asking_m2: number | null; listing_count: number; rent_m2: number | null; avg_dom: number | null; drop_rate_pct: number | null } | undefined;

  // Fallback: region-level data when listings lack district_id
  let fallback: { asking_m2: number | null; listing_count: number; rent_m2: number | null; avg_dom: number | null; drop_rate_pct: number | null } | undefined;
  if ((!districtAsking?.asking_m2 || !districtAsking?.avg_dom) && district) {
    const regionId = (district as Record<string, unknown>).region_id;
    fallback = await db
      .prepare(
        `SELECT
          ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as asking_m2,
          COUNT(CASE WHEN category = 'byty-prodej' THEN 1 END) as listing_count,
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
      .get(regionId) as typeof fallback;
  }

  return NextResponse.json({
    district,
    wards,
    district_asking_m2: districtAsking?.asking_m2 ?? fallback?.asking_m2 ?? null,
    district_rent_m2: districtAsking?.rent_m2 ?? fallback?.rent_m2 ?? null,
    district_listing_count: districtAsking?.listing_count ?? fallback?.listing_count ?? 0,
    district_avg_dom: districtAsking?.avg_dom ?? fallback?.avg_dom ?? null,
    district_drop_rate_pct: districtAsking?.drop_rate_pct ?? fallback?.drop_rate_pct ?? null,
  });
}
