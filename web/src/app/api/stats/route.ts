import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET() {
  const db = getDB();

  const totalListings = (
    db.prepare("SELECT COUNT(*) as c FROM listings").get() as { c: number }
  ).c;

  const totalDrops = (
    db.prepare("SELECT COUNT(*) as c FROM price_drops").get() as { c: number }
  ).c;

  const avgDrop = (
    db
      .prepare("SELECT AVG(drop_pct) as avg FROM price_drops")
      .get() as { avg: number | null }
  ).avg;

  const categories = db
    .prepare(
      "SELECT category, COUNT(*) as count FROM listings GROUP BY category ORDER BY count DESC"
    )
    .all();

  const recentDrops = db
    .prepare(
      `SELECT pd.*, l.url as listing_url
       FROM price_drops pd
       LEFT JOIN listings l ON l.id = pd.listing_id
       ORDER BY pd.detected_at DESC LIMIT 5`
    )
    .all();

  return NextResponse.json({
    totalListings,
    totalDrops,
    avgDrop: avgDrop ? Math.round(avgDrop * 100) / 100 : 0,
    categories,
    recentDrops,
  });
}
