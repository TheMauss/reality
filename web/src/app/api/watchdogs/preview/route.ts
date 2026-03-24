import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    categories, property_type, district_id, region_id, location,
    price_min, price_max, area_min, area_max,
    price_m2_min, price_m2_max,
    layout, keywords,
  } = body;

  const db = getDB();

  const conditions: string[] = ["removed_at IS NULL"];
  const args: unknown[] = [];

  if (categories && Array.isArray(categories) && categories.length > 0) {
    conditions.push(`category IN (${categories.map(() => "?").join(",")})`);
    args.push(...categories);
  }
  if (property_type && Array.isArray(property_type) && property_type.length > 0) {
    conditions.push(`dispozice IN (${property_type.map(() => "?").join(",")})`);
    args.push(...property_type);
  }
  if (district_id) { conditions.push("district_id = ?"); args.push(district_id); }
  else if (region_id) { conditions.push("region_id = ?"); args.push(region_id); }
  else if (location) { conditions.push("location LIKE ?"); args.push(`%${location}%`); }
  if (price_min) { conditions.push("price >= ?"); args.push(price_min); }
  if (price_max) { conditions.push("price <= ?"); args.push(price_max); }
  if (area_min) { conditions.push("area_m2 >= ?"); args.push(area_min); }
  if (area_max) { conditions.push("area_m2 <= ?"); args.push(area_max); }
  if (price_m2_min) { conditions.push("area_m2 > 0 AND ROUND(price * 1.0 / area_m2) >= ?"); args.push(price_m2_min); }
  if (price_m2_max) { conditions.push("area_m2 > 0 AND ROUND(price * 1.0 / area_m2) <= ?"); args.push(price_m2_max); }

  const where = conditions.join(" AND ");

  const rows = await db
    .prepare(`SELECT id, title, price, CASE WHEN area_m2 > 0 THEN ROUND(price * 1.0 / area_m2) ELSE NULL END as price_m2, area_m2, location, category FROM listings WHERE ${where} ORDER BY first_seen_at DESC LIMIT 200`)
    .all(...(args as import("@libsql/client").InValue[])) as unknown as Array<{ id: string; title: string; price: number; price_m2: number | null; area_m2: number | null; location: string; category: string }>;

  // JS-side filters for layout and keywords
  let filtered = rows;

  if (layout && Array.isArray(layout) && layout.length > 0) {
    filtered = filtered.filter(r =>
      layout.some((l: string) => r.title.toLowerCase().includes(l.toLowerCase()))
    );
  }

  if (keywords && Array.isArray(keywords) && keywords.length > 0) {
    filtered = filtered.filter(r =>
      keywords.some((kw: string) => r.title.toLowerCase().includes(kw.toLowerCase()) || r.location.toLowerCase().includes(kw.toLowerCase()))
    );
  }

  return NextResponse.json({ count: filtered.length, samples: filtered.slice(0, 3) });
}
