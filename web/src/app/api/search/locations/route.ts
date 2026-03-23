import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * GET /api/search/locations?q=Ambrožova&category=byty-prodej
 * Searches distinct listing location strings for matching addresses/streets.
 * Returns deduplicated locations with representative lat/lon.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() || "";
  const category = sp.get("category") || "";

  if (q.length < 2) return NextResponse.json({ locations: [] });

  const db = getDB();

  const params: (string | number)[] = [`%${q}%`];
  let catWhere = "";
  if (category) {
    catWhere = " AND category = ?";
    params.push(category);
  }

  const rows = await db
    .prepare(
      `SELECT
        location,
        AVG(lat) as lat,
        AVG(lon) as lon,
        COUNT(*) as cnt
      FROM listings
      WHERE location LIKE ? AND lat IS NOT NULL AND removed_at IS NULL
      ${catWhere}
      GROUP BY location
      ORDER BY cnt DESC
      LIMIT 8`
    )
    .all(...params) as unknown as Array<{ location: string; lat: number; lon: number; cnt: number }>;

  return NextResponse.json({ locations: rows });
}
