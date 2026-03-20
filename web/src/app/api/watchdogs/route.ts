import { NextRequest, NextResponse } from "next/server";
import { getWriteDB } from "@/lib/db-write";

// GET /api/watchdogs?user_id=1
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const userId = sp.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const db = getWriteDB();
  const watchdogs = await db
    .prepare("SELECT * FROM watchdogs WHERE user_id = ? ORDER BY created_at DESC")
    .all(parseInt(userId, 10));

  // Add match counts
  const countStmt = db.prepare(
    "SELECT COUNT(*) as count FROM watchdog_matches WHERE watchdog_id = ?"
  );
  const result = await Promise.all((watchdogs as Array<Record<string, unknown>>).map(async (wd) => ({
    ...wd,
    match_count: (await countStmt.get(wd.id) as { count: number }).count,
  })));

  return NextResponse.json({ watchdogs: result });
}

// POST /api/watchdogs
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.user_id || !body.name) {
    return NextResponse.json(
      { error: "user_id and name are required" },
      { status: 400 }
    );
  }

  const db = getWriteDB();

  const result = await db
    .prepare(
      `INSERT INTO watchdogs (
        user_id, name, category, region_id, district_id, location,
        price_min, price_max, area_min, area_max, keywords,
        watch_new, watch_drops, watch_drops_min_pct,
        watch_underpriced, watch_underpriced_pct, watch_returned,
        notify_email, notify_telegram, notify_frequency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      body.user_id,
      body.name,
      body.category || null,
      body.region_id || null,
      body.district_id || null,
      body.location || null,
      body.price_min || null,
      body.price_max || null,
      body.area_min || null,
      body.area_max || null,
      body.keywords ? JSON.stringify(body.keywords) : null,
      body.watch_new ?? 1,
      body.watch_drops ?? 0,
      body.watch_drops_min_pct ?? 5,
      body.watch_underpriced ?? 0,
      body.watch_underpriced_pct ?? 15,
      body.watch_returned ?? 0,
      body.notify_email ?? 1,
      body.notify_telegram ?? 0,
      body.notify_frequency || "instant"
    );

  const watchdog = await db
    .prepare("SELECT * FROM watchdogs WHERE id = ?")
    .get(result.lastInsertRowid);

  return NextResponse.json({ watchdog }, { status: 201 });
}
