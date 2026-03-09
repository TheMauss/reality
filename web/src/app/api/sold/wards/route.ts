import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(req: NextRequest) {
  const districtId = req.nextUrl.searchParams.get("district_id");
  if (!districtId) {
    return NextResponse.json({ error: "Missing district_id" }, { status: 400 });
  }

  const db = getDB();

  const district = db
    .prepare(
      `SELECT d.*, r.name as region_name, r.id as region_id
      FROM sold_districts d
      JOIN sold_regions r ON r.id = d.region_id
      WHERE d.id = ?`
    )
    .get(districtId) as Record<string, unknown> | undefined;

  if (district) {
    // Get latest price from history for this district
    const latestPrice = db
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

  const wards = db
    .prepare(
      `SELECT w.*,
        (SELECT COUNT(*) FROM sold_transactions WHERE ward_id = w.id) as transaction_count
      FROM sold_wards w
      WHERE w.district_id = ?
      ORDER BY w.avg_price_m2 DESC`
    )
    .all(districtId);

  // Get asking prices per ward from listings using lat/lon proximity
  // Since listings don't have ward_id, we compute district-level asking price
  const districtAsking = db
    .prepare(
      `SELECT
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as asking_m2,
        COUNT(CASE WHEN category = 'byty-prodej' THEN 1 END) as listing_count
      FROM listings
      WHERE district_id = ?`
    )
    .get(districtId) as { asking_m2: number | null; listing_count: number } | undefined;

  return NextResponse.json({
    district,
    wards,
    district_asking_m2: districtAsking?.asking_m2 ?? null,
    district_listing_count: districtAsking?.listing_count ?? 0,
  });
}
