import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(req: NextRequest) {
  const wardId = req.nextUrl.searchParams.get("ward_id");
  if (!wardId) {
    return NextResponse.json({ error: "Missing ward_id" }, { status: 400 });
  }

  const db = getDB();

  const ward = await db
    .prepare(
      `SELECT w.*, d.name as district_name, d.id as district_id,
        r.name as region_name, r.id as region_id
      FROM sold_wards w
      JOIN sold_districts d ON d.id = w.district_id
      JOIN sold_regions r ON r.id = w.region_id
      WHERE w.id = ?`
    )
    .get(wardId);

  const transactions = await db
    .prepare(
      `SELECT * FROM sold_transactions
      WHERE ward_id = ?
      ORDER BY validation_date DESC`
    )
    .all(wardId);

  // Get asking price for the ward's district from listings, with region fallback
  const wardData = ward as Record<string, unknown> | undefined;
  let districtAskingM2: number | null = null;
  if (wardData?.district_id) {
    const asking = await db
      .prepare(
        `SELECT ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as asking_m2
        FROM listings WHERE district_id = ?`
      )
      .get(wardData.district_id) as { asking_m2: number | null } | undefined;
    districtAskingM2 = asking?.asking_m2 ?? null;
  }
  // Fallback to region-level if district has no data
  if (!districtAskingM2 && wardData?.region_id) {
    const regionAsking = await db
      .prepare(
        `SELECT ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as asking_m2
        FROM listings WHERE region_id = ?`
      )
      .get(wardData.region_id) as { asking_m2: number | null } | undefined;
    districtAskingM2 = regionAsking?.asking_m2 ?? null;
  }

  return NextResponse.json({ ward, transactions, district_asking_m2: districtAskingM2 });
}
