import { getDB } from "@/lib/db";

interface WatchdogConfig {
  id: number;
  category: string | null;
  property_type: string | null;
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
  dispozice: string | null;
}

/**
 * Scans existing DB listings against a watchdog and inserts matches.
 * Returns number of new matches inserted.
 */
export async function scanExistingListings(wd: WatchdogConfig): Promise<number> {
  if (!wd.watch_new) return 0;

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
  if (wd.price_m2_min) { conditions.push("area_m2 > 0 AND ROUND(price * 1.0 / area_m2) >= ?"); args.push(wd.price_m2_min); }
  if (wd.price_m2_max) { conditions.push("area_m2 > 0 AND ROUND(price * 1.0 / area_m2) <= ?"); args.push(wd.price_m2_max); }

  if (wd.property_type) {
    try {
      const types = JSON.parse(wd.property_type) as string[];
      if (types.length > 0) {
        conditions.push(`dispozice IN (${types.map(() => "?").join(",")})`);
        args.push(...types);
      }
    } catch { /* */ }
  }

  const rows = await db.prepare(
    `SELECT id, title, url, location, price, area_m2, dispozice FROM listings WHERE ${conditions.join(" AND ")} ORDER BY first_seen_at DESC LIMIT 500`
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

  // Insert in batches of 50, skipping listings that already have a match for this watchdog
  let inserted = 0;
  const BATCH = 50;
  for (let i = 0; i < filtered.length; i += BATCH) {
    const chunk = filtered.slice(i, i + BATCH);
    await db.batch(chunk.map(r => ({
      sql: `INSERT INTO watchdog_matches (watchdog_id, listing_id, match_type, match_detail)
            SELECT ?, ?, 'new', ?
            WHERE NOT EXISTS (
              SELECT 1 FROM watchdog_matches
              WHERE watchdog_id = ? AND listing_id = ? AND match_type = 'new'
            )`,
      args: [wd.id, r.id, JSON.stringify({ price: r.price, area_m2: r.area_m2, location: r.location, source: "db_scan" }),
             wd.id, r.id] as import("@libsql/client").InValue[],
    })));
    inserted += chunk.length;
  }

  return inserted;
}
