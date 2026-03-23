import { NextRequest, NextResponse } from "next/server";
import { getWriteDB } from "@/lib/db-write";
import { auth } from "@/auth";

// GET /api/watchdogs
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getWriteDB();
  const watchdogs = await db
    .prepare("SELECT * FROM watchdogs WHERE user_id = ? ORDER BY created_at DESC")
    .all(session.user.id);

  // Add match counts
  const countStmt = db.prepare(
    "SELECT COUNT(*) as count FROM watchdog_matches WHERE watchdog_id = ?"
  );
  const result = await Promise.all((watchdogs as Array<Record<string, unknown>>).map(async (wd) => ({
    ...wd,
    match_count: (await countStmt.get(wd.id as string) as unknown as { count: number }).count,
  })));

  return NextResponse.json({ watchdogs: result });
}

// POST /api/watchdogs
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
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
      session.user.id,
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
    .get(result.lastInsertRowid!);

  return NextResponse.json({ watchdog }, { status: 201 });
}
