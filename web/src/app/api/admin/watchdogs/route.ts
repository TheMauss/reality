import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDB } from "@/lib/db";

const ADMIN_EMAIL = "mausmaraa@gmail.com";

export async function GET() {
  const session = await auth();
  if (session?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDB();

  const users = await db.prepare(
    `SELECT id, email, telegram_id, created_at FROM users ORDER BY created_at DESC`
  ).all() as unknown as Array<{ id: number; email: string; telegram_id: string | null; created_at: string }>;

  const watchdogs = await db.prepare(
    `SELECT w.*, u.email as user_email,
      (SELECT COUNT(*) FROM watchdog_matches wm WHERE wm.watchdog_id = w.id) as match_count
    FROM watchdogs w
    JOIN users u ON u.id = w.user_id
    ORDER BY w.created_at DESC`
  ).all() as unknown as Array<Record<string, unknown>>;

  return NextResponse.json({ users, watchdogs });
}
