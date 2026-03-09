import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const db = getDB();

  const listing = db
    .prepare("SELECT * FROM listings WHERE id = ?")
    .get(id);

  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const history = db
    .prepare(
      "SELECT price, recorded_at FROM price_history WHERE listing_id = ? ORDER BY recorded_at ASC"
    )
    .all(id);

  const drops = db
    .prepare(
      "SELECT * FROM price_drops WHERE listing_id = ? ORDER BY detected_at DESC"
    )
    .all(id);

  // Field-level changes (table may not exist yet)
  let changes: unknown[] = [];
  try {
    changes = db
      .prepare(
        "SELECT * FROM listing_changes WHERE listing_id = ? ORDER BY detected_at DESC"
      )
      .all(id);
  } catch {
    // table doesn't exist yet
  }

  return NextResponse.json({ listing, history, drops, changes });
}
