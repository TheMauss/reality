import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDB } from "@/lib/db";
import { scanExistingListings } from "@/lib/watchdog-scan";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDB();

  const row = await db.prepare("SELECT * FROM watchdogs WHERE id = ? AND user_id = ?")
    .get(parseInt(id, 10), session.user.id) as any;

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const count = await scanExistingListings(db.client, row);
  return NextResponse.json({ ok: true, count });
}
