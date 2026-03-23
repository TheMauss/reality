import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDB } from "@/lib/db";

async function ensureTable() {
  const db = getDB();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id INTEGER NOT NULL,
      listing_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, listing_id)
    )
  `);
}

// GET /api/favorites — returns all saved listing ids for current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ids: [] });
  }
  await ensureTable();
  const db = getDB();
  const rows = await db
    .prepare("SELECT listing_id FROM user_favorites WHERE user_id = ?")
    .all(session.user.id) as unknown as { listing_id: string }[];
  return NextResponse.json({ ids: rows.map(r => r.listing_id) });
}

// POST /api/favorites — add { listing_id }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { listing_id } = await req.json();
  if (!listing_id) return NextResponse.json({ error: "listing_id required" }, { status: 400 });

  await ensureTable();
  const db = getDB();
  await db
    .prepare("INSERT OR IGNORE INTO user_favorites (user_id, listing_id) VALUES (?, ?)")
    .run(session.user.id, listing_id);
  return NextResponse.json({ ok: true });
}

// DELETE /api/favorites?listing_id=x
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const listing_id = req.nextUrl.searchParams.get("listing_id");
  if (!listing_id) return NextResponse.json({ error: "listing_id required" }, { status: 400 });

  await ensureTable();
  const db = getDB();
  await db
    .prepare("DELETE FROM user_favorites WHERE user_id = ? AND listing_id = ?")
    .run(session.user.id, listing_id);
  return NextResponse.json({ ok: true });
}
