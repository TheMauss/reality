import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// GET /api/watchdogs/[id]/matches?page=1
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const perPage = 30;
  const offset = (page - 1) * perPage;

  const db = getDB();
  const watchdogId = parseInt(id, 10);

  const countRow = await db
    .prepare("SELECT COUNT(*) as total FROM watchdog_matches WHERE watchdog_id = ?")
    .get(watchdogId) as unknown as { total: number };

  const matches = await db
    .prepare(
      `SELECT wm.*, l.title, l.url, l.location, l.category, l.area_m2, l.price, l.image_url
       FROM watchdog_matches wm
       LEFT JOIN listings l ON l.id = wm.listing_id
       WHERE wm.watchdog_id = ?
       ORDER BY wm.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(watchdogId, perPage, offset);

  return NextResponse.json({
    matches,
    total: countRow.total,
    page,
    pages: Math.ceil(countRow.total / perPage),
  });
}
