import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const db = getDB();

  const listing = await db
    .prepare("SELECT * FROM listings WHERE id = ?")
    .get(id);

  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const history = await db
    .prepare(
      "SELECT price, recorded_at FROM price_history WHERE listing_id = ? ORDER BY recorded_at ASC"
    )
    .all(id);

  const drops = await db
    .prepare(
      "SELECT * FROM price_drops WHERE listing_id = ? ORDER BY detected_at DESC"
    )
    .all(id);

  // Field-level changes (table may not exist yet)
  let changes: unknown[] = [];
  try {
    changes = await db
      .prepare(
        "SELECT * FROM listing_changes WHERE listing_id = ? ORDER BY detected_at DESC"
      )
      .all(id);
  } catch {
    // table doesn't exist yet
  }

  let sources: unknown[] = [];
  try {
    sources = await db.prepare(
      "SELECT source, source_id, url, first_seen_at, last_seen_at, removed_at FROM listing_sources WHERE listing_id = ? ORDER BY first_seen_at ASC"
    ).all(id);
  } catch { /* table may not exist */ }

  return NextResponse.json({ listing, history, drops, changes, sources });
}
