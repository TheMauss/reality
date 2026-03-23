import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * Extracts Prague district from location.
 * Prioritizes "Praha X" numbering, falls back to part names (část obce).
 * mode=numbered: groups by Praha 1-10 + ostatní
 * mode=detailed: groups by ward/část obce name for finer granularity
 */

const DISTRICT_NUMBERED = `
  CASE
    WHEN location LIKE '%Praha 1 %' OR location LIKE '%Praha 1,%' OR location LIKE '%, Praha 1' OR location = 'Praha 1' THEN 'Praha 1'
    WHEN location LIKE '%Praha 2 %' OR location LIKE '%Praha 2,%' OR location LIKE '%, Praha 2' OR location = 'Praha 2' THEN 'Praha 2'
    WHEN location LIKE '%Praha 3 %' OR location LIKE '%Praha 3,%' OR location LIKE '%, Praha 3' OR location = 'Praha 3' THEN 'Praha 3'
    WHEN location LIKE '%Praha 4 %' OR location LIKE '%Praha 4,%' OR location LIKE '%, Praha 4' OR location = 'Praha 4' THEN 'Praha 4'
    WHEN location LIKE '%Praha 5 %' OR location LIKE '%Praha 5,%' OR location LIKE '%, Praha 5' OR location = 'Praha 5' THEN 'Praha 5'
    WHEN location LIKE '%Praha 6 %' OR location LIKE '%Praha 6,%' OR location LIKE '%, Praha 6' OR location = 'Praha 6' THEN 'Praha 6'
    WHEN location LIKE '%Praha 7 %' OR location LIKE '%Praha 7,%' OR location LIKE '%, Praha 7' OR location = 'Praha 7' THEN 'Praha 7'
    WHEN location LIKE '%Praha 8 %' OR location LIKE '%Praha 8,%' OR location LIKE '%, Praha 8' OR location = 'Praha 8' THEN 'Praha 8'
    WHEN location LIKE '%Praha 9 %' OR location LIKE '%Praha 9,%' OR location LIKE '%, Praha 9' OR location = 'Praha 9' THEN 'Praha 9'
    WHEN location LIKE '%Praha 10%' THEN 'Praha 10'
    WHEN location LIKE '%Praha%' THEN 'Praha (ostatní)'
    ELSE 'Mimo Prahu'
  END
`;

/**
 * Extracts the ward/část obce from location strings like:
 * "Praha 5 - Smíchov" → "Smíchov"
 * "Praha, Vinohrady" → "Vinohrady"
 * Falls back to the numbered district.
 */
const DISTRICT_WARD = `
  CASE
    WHEN location LIKE '%Praha % - %' THEN
      SUBSTR(location, INSTR(location, ' - ') + 3)
    WHEN location LIKE '%Praha, %' THEN
      SUBSTR(location, INSTR(location, 'Praha, ') + 7)
    WHEN location LIKE '%Praha % -%' THEN
      TRIM(SUBSTR(location, INSTR(location, '-') + 1))
    ELSE ${DISTRICT_NUMBERED}
  END
`;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode") || "numbered"; // "numbered" | "ward"

  const db = getDB();

  const districtExpr = mode === "ward" ? DISTRICT_WARD : DISTRICT_NUMBERED;

  // Per-district aggregation
  const districts = await db
    .prepare(
      `SELECT
        ${districtExpr} as district,
        COUNT(*) as total_listings,
        COUNT(CASE WHEN category = 'byty-prodej' THEN 1 END) as byty_prodej,
        COUNT(CASE WHEN category = 'byty-najem' THEN 1 END) as byty_najem,
        COUNT(CASE WHEN category = 'domy-prodej' THEN 1 END) as domy_prodej,
        COUNT(CASE WHEN category = 'domy-najem' THEN 1 END) as domy_najem,
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as avg_price_m2_prodej,
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-najem' THEN price * 1.0 / area_m2 END)) as avg_price_m2_najem,
        ROUND(AVG(CASE WHEN category = 'byty-prodej' THEN price END)) as avg_price_byt_prodej,
        ROUND(AVG(CASE WHEN category = 'byty-najem' THEN price END)) as avg_price_byt_najem,
        ROUND(MIN(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as min_price_m2,
        ROUND(MAX(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as max_price_m2,
        ROUND(AVG(CASE WHEN area_m2 > 0 THEN area_m2 END)) as avg_area
      FROM listings
      WHERE location LIKE '%Praha%'
      GROUP BY district
      ORDER BY avg_price_m2_prodej DESC`
    )
    .all();

  // Prague-wide totals
  const pragueTotal = await db
    .prepare(
      `SELECT
        COUNT(*) as total,
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as avg_price_m2,
        ROUND(AVG(CASE WHEN category = 'byty-prodej' THEN price END)) as avg_price,
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-najem' THEN price * 1.0 / area_m2 END)) as avg_rent_m2,
        ROUND(AVG(CASE WHEN category = 'byty-najem' THEN price END)) as avg_rent
      FROM listings
      WHERE location LIKE '%Praha%'`
    )
    .get();

  return NextResponse.json({ districts, pragueTotal });
}
