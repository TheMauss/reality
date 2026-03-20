import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

const DISTRICT_EXTRACT = `
  CASE
    WHEN l.location LIKE '%Praha 1 %' OR l.location LIKE '%Praha 1' THEN 'Praha 1'
    WHEN l.location LIKE '%Praha 2 %' OR l.location LIKE '%Praha 2' THEN 'Praha 2'
    WHEN l.location LIKE '%Praha 3 %' OR l.location LIKE '%Praha 3' THEN 'Praha 3'
    WHEN l.location LIKE '%Praha 4 %' OR l.location LIKE '%Praha 4' THEN 'Praha 4'
    WHEN l.location LIKE '%Praha 5 %' OR l.location LIKE '%Praha 5' THEN 'Praha 5'
    WHEN l.location LIKE '%Praha 6 %' OR l.location LIKE '%Praha 6' THEN 'Praha 6'
    WHEN l.location LIKE '%Praha 7 %' OR l.location LIKE '%Praha 7' THEN 'Praha 7'
    WHEN l.location LIKE '%Praha 8 %' OR l.location LIKE '%Praha 8' THEN 'Praha 8'
    WHEN l.location LIKE '%Praha 9 %' OR l.location LIKE '%Praha 9' THEN 'Praha 9'
    WHEN l.location LIKE '%Praha 10%' THEN 'Praha 10'
    WHEN l.location LIKE '%Praha%' THEN 'Praha (ostatní)'
    ELSE 'Mimo Prahu'
  END
`;

export async function GET() {
  const db = getDB();

  // Price index over time (daily avg price/m² for byty-prodej)
  const priceIndex = await db
    .prepare(
      `SELECT
        DATE(ph.recorded_at) as day,
        ROUND(AVG(CASE WHEN l.area_m2 > 0 THEN ph.price * 1.0 / l.area_m2 END)) as avg_price_m2,
        COUNT(DISTINCT ph.listing_id) as sample_size
      FROM price_history ph
      JOIN listings l ON l.id = ph.listing_id
      WHERE l.category = 'byty-prodej'
        AND l.location LIKE '%Praha%'
        AND l.area_m2 > 0
      GROUP BY day
      ORDER BY day`
    )
    .all();

  // Per-district price index over time
  const districtIndex = await db
    .prepare(
      `SELECT
        DATE(ph.recorded_at) as day,
        ${DISTRICT_EXTRACT} as district,
        ROUND(AVG(CASE WHEN l.area_m2 > 0 THEN ph.price * 1.0 / l.area_m2 END)) as avg_price_m2,
        COUNT(DISTINCT ph.listing_id) as sample_size
      FROM price_history ph
      JOIN listings l ON l.id = ph.listing_id
      WHERE l.category = 'byty-prodej'
        AND l.location LIKE '%Praha%'
        AND l.area_m2 > 0
      GROUP BY day, district
      ORDER BY day, district`
    )
    .all();

  return NextResponse.json({ priceIndex, districtIndex });
}
