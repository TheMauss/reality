import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// GET /api/avg-price?district_id=X or ?region_id=X
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const districtId = sp.get("district_id");
  const regionId = sp.get("region_id");

  const db = getDB();

  if (districtId) {
    const row = db
      .prepare("SELECT avg_price_m2, name FROM sold_districts WHERE id = ?")
      .get(parseInt(districtId, 10)) as { avg_price_m2: number | null; name: string } | undefined;

    return NextResponse.json({
      avg_price_m2: row?.avg_price_m2 ?? null,
      name: row?.name ?? null,
      level: "district",
    });
  }

  if (regionId) {
    const row = db
      .prepare("SELECT avg_price_m2, name FROM sold_regions WHERE id = ?")
      .get(parseInt(regionId, 10)) as { avg_price_m2: number | null; name: string } | undefined;

    return NextResponse.json({
      avg_price_m2: row?.avg_price_m2 ?? null,
      name: row?.name ?? null,
      level: "region",
    });
  }

  return NextResponse.json({ error: "district_id or region_id required" }, { status: 400 });
}
