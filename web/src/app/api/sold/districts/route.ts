import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(req: NextRequest) {
  const regionId = req.nextUrl.searchParams.get("region_id");
  if (!regionId) {
    return NextResponse.json({ error: "Missing region_id" }, { status: 400 });
  }

  const db = getDB();

  const region = db
    .prepare("SELECT * FROM sold_regions WHERE id = ?")
    .get(regionId);

  const districts = db
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

  // Get asking prices per district from listings
  const askingPrices = db
    .prepare(
      `SELECT district_id,
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as asking_m2,
        COUNT(CASE WHEN category = 'byty-prodej' THEN 1 END) as listing_count
      FROM listings
      WHERE district_id IS NOT NULL AND region_id = ?
      GROUP BY district_id`
    )
    .all(regionId) as Array<{ district_id: number; asking_m2: number | null; listing_count: number }>;

  const askingMap = Object.fromEntries(
    askingPrices.map((a) => [a.district_id, a])
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (districts as any[]).map((d) => {
    const lastSoldPrice = d.latest_price_m2 ?? d.avg_price_m2;
    return {
      ...d,
      avg_price_m2: lastSoldPrice,
      asking_m2: askingMap[d.id]?.asking_m2 ?? null,
      listing_count: askingMap[d.id]?.listing_count ?? 0,
      spread: askingMap[d.id]?.asking_m2 && lastSoldPrice
        ? (((askingMap[d.id].asking_m2! - lastSoldPrice) / lastSoldPrice) * 100)
        : null,
    };
  });

  return NextResponse.json({ region, districts: enriched });
}
