import { getDB } from "@/lib/db";

interface WatchdogConfig {
  id: number;
  category: string | null;
  region_id: number | null;
  district_id: number | null;
  location: string | null;
  price_min: number | null;
  price_max: number | null;
  area_min: number | null;
  area_max: number | null;
  price_m2_min: number | null;
  price_m2_max: number | null;
  layout: string | null;
  keywords: string | null;
  watch_new: number;
}

interface ListingRow {
  id: string;
  title: string;
  url: string;
  location: string;
  price: number;
  area_m2: number | null;
}

/**
 * Scans existing DB listings against a watchdog and inserts matches.
 * Returns number of new matches inserted.
 */
export async function scanExistingListings(wd: WatchdogConfig): Promise<number> {
  const db = getDB();

  const conditions: string[] = ["removed_at IS NULL"];
  const args: import("@libsql/client").InValue[] = [];

  if (wd.category) {
    let cats: string[];
    try { cats = JSON.parse(wd.category); if (!Array.isArray(cats)) cats = [wd.category]; }
    catch { cats = [wd.category]; }
    if (cats.length > 0) {
      conditions.push(`category IN (${cats.map(() => "?").join(",")})`);
      args.push(...cats);
    }
  }

  if (wd.district_id) { conditions.push("district_id = ?"); args.push(wd.district_id); }
  else if (wd.region_id) { conditions.push("region_id = ?"); args.push(wd.region_id); }
  else if (wd.location) { conditions.push("location LIKE ?"); args.push(`%${wd.location}%`); }

  if (wd.price_min) { conditions.push("price >= ?"); args.push(wd.price_min); }
  if (wd.price_max) { conditions.push("price <= ?"); args.push(wd.price_max); }
  if (wd.area_min) { conditions.push("area_m2 >= ?"); args.push(wd.area_min); }
  if (wd.area_max) { conditions.push("area_m2 <= ?"); args.push(wd.area_max); }
  if (wd.price_m2_min) { conditions.push("price_m2 >= ?"); args.push(wd.price_m2_min); }
  if (wd.price_m2_max) { conditions.push("price_m2 <= ?"); args.push(wd.price_m2_max); }

  const rows = await db.prepare(
    `SELECT id, title, url, location, price, area_m2 FROM listings WHERE ${conditions.join(" AND ")} ORDER BY first_seen_at DESC LIMIT 500`
  ).all(...args) as unknown as ListingRow[];

  let filtered = rows;

  if (wd.layout) {
    try {
      const layouts = JSON.parse(wd.layout) as string[];
      if (layouts.length > 0)
        filtered = filtered.filter(r => layouts.some(l => r.title.toLowerCase().includes(l.toLowerCase())));
    } catch { /* */ }
  }

  if (wd.keywords) {
    try {
      const kws = JSON.parse(wd.keywords) as string[];
      if (kws.length > 0)
        filtered = filtered.filter(r => kws.some(kw =>
          r.title.toLowerCase().includes(kw.toLowerCase()) ||
          r.location.toLowerCase().includes(kw.toLowerCase())
        ));
    } catch { /* */ }
  }

  if (filtered.length === 0) return 0;

  // Insert in small batches to avoid Turso limits
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < filtered.length; i += BATCH) {
    const chunk = filtered.slice(i, i + BATCH);
    const stmts = chunk.map(r => ({
      sql: `INSERT OR IGNORE INTO watchdog_matches (watchdog_id, listing_id, match_type, match_detail) VALUES (?, ?, 'new', ?)`,
      args: [wd.id, r.id, JSON.stringify({ price: r.price, area_m2: r.area_m2, location: r.location, source: "db_scan" })] as import("@libsql/client").InValue[],
    }));
    await db.batch(stmts);
    inserted += chunk.length;
  }

  return inserted;
}
