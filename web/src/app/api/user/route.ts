import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDB } from "@/lib/db";

// GET /api/user — current user profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB();
  const user = await db
    .prepare("SELECT id, email, telegram_id FROM users WHERE id = ?")
    .get(session.user.id) as unknown as { id: number; email: string; telegram_id: string | null } | undefined;

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ user });
}

// PATCH /api/user — update telegram_id
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const telegram_id = body.telegram_id?.toString().trim() || null;

  const db = getDB();
  await db
    .prepare("UPDATE users SET telegram_id = ? WHERE id = ?")
    .run(telegram_id, session.user.id);

  return NextResponse.json({ ok: true, telegram_id });
}
