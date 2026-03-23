import { NextRequest, NextResponse } from "next/server";
import { getWriteDB } from "@/lib/db-write";
import { auth } from "@/auth";

// PUT /api/watchdogs/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const db = getWriteDB();

  const existing = await db.prepare("SELECT * FROM watchdogs WHERE id = ? AND user_id = ?").get(parseInt(id, 10), session.user.id) as unknown as { id: number } | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Watchdog not found" }, { status: 404 });
  }

  await db.prepare(
    `UPDATE watchdogs SET
      name = ?, category = ?, region_id = ?, district_id = ?, location = ?,
      price_min = ?, price_max = ?, area_min = ?, area_max = ?,
      price_m2_min = ?, price_m2_max = ?,
      layout = ?, keywords = ?,
      watch_new = ?, watch_drops = ?, watch_drops_min_pct = ?,
      watch_underpriced = ?, watch_underpriced_pct = ?, watch_returned = ?,
      notify_email = 0, notify_telegram = ?, notify_frequency = ?,
      active = ?, updated_at = datetime('now')
    WHERE id = ?`
  ).run(
    body.name,
    body.category || null,
    body.region_id || null,
    body.district_id || null,
    body.location || null,
    body.price_min || null,
    body.price_max || null,
    body.area_min || null,
    body.area_max || null,
    body.price_m2_min || null,
    body.price_m2_max || null,
    body.layout?.length ? JSON.stringify(body.layout) : null,
    body.keywords?.length ? JSON.stringify(body.keywords) : null,
    body.watch_new ?? 1,
    body.watch_drops ?? 0,
    body.watch_drops_min_pct ?? 5,
    body.watch_underpriced ?? 0,
    body.watch_underpriced_pct ?? 15,
    body.watch_returned ?? 0,
    body.notify_telegram ?? 0,
    body.notify_frequency || "instant",
    body.active ?? 1,
    parseInt(id, 10)
  );

  const updated = await db.prepare("SELECT * FROM watchdogs WHERE id = ?").get(parseInt(id, 10));
  return NextResponse.json({ watchdog: updated });
}

// DELETE /api/watchdogs/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getWriteDB();

  // Delete matches first, then watchdog (only if owned by user)
  await db.prepare("DELETE FROM watchdog_matches WHERE watchdog_id = ? AND watchdog_id IN (SELECT id FROM watchdogs WHERE user_id = ?)").run(parseInt(id, 10), session.user.id);
  const result = await db.prepare("DELETE FROM watchdogs WHERE id = ? AND user_id = ?").run(parseInt(id, 10), session.user.id);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Watchdog not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// PATCH /api/watchdogs/[id] — toggle active
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getWriteDB();

  const existing = await db.prepare("SELECT active FROM watchdogs WHERE id = ? AND user_id = ?").get(parseInt(id, 10), session.user.id) as unknown as
    | { active: number }
    | undefined;

  if (!existing) {
    return NextResponse.json({ error: "Watchdog not found" }, { status: 404 });
  }

  const newActive = existing.active ? 0 : 1;
  await db.prepare("UPDATE watchdogs SET active = ?, updated_at = datetime('now') WHERE id = ?").run(
    newActive,
    parseInt(id, 10)
  );

  return NextResponse.json({ active: newActive });
}
