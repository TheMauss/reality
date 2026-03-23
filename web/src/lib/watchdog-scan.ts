import type { Client, InValue } from "@libsql/client";

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
  watch_drops: number;
}

interface ListingRow {
  id: string;
  title: string;
  url: string;
  location: string;
  price: number;
  price_m2: number | null;
  area_m2: number | null;
  category: string;
  first_seen_at: string;
}

/**
 * Scans existing listings in DB against a watchdog and inserts matches.
 * Returns number of new matches inserted.
 */
export async function scanExistingListings(db: Client, wd: WatchdogConfig): Promise<number> {
  if (!wd.watch_new && !wd.watch_drops) return 0;

  const conditions: string[] = ["removed_at IS NULL"];
  const args: InValue[] = [];

  // Category filter (JSON array or plain string)
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

  const where = conditions.join(" AND ");
  const rows = (await db.execute({
    sql: `SELECT id, title, url, location, price, price_m2, area_m2, category, first_seen_at
          FROM listings WHERE ${where}
          ORDER BY first_seen_at DESC LIMIT 500`,
    args,
  })).rows as unknown as ListingRow[];

  // JS-side layout + keyword filters
  let filtered = rows;

  if (wd.layout) {
    try {
      const layouts = JSON.parse(wd.layout) as string[];
      if (layouts.length > 0) {
        filtered = filtered.filter(r =>
          layouts.some(l => r.title.toLowerCase().includes(l.toLowerCase()))
        );
      }
    } catch { /* */ }
  }

  if (wd.keywords) {
    try {
      const kws = JSON.parse(wd.keywords) as string[];
      if (kws.length > 0) {
        filtered = filtered.filter(r =>
          kws.some(kw =>
            r.title.toLowerCase().includes(kw.toLowerCase()) ||
            r.location.toLowerCase().includes(kw.toLowerCase())
          )
        );
      }
    } catch { /* */ }
  }

  if (filtered.length === 0) return 0;

  // Insert matches (skip already existing ones)
  const stmts = filtered.map(r => ({
    sql: `INSERT OR IGNORE INTO watchdog_matches (watchdog_id, listing_id, match_type, match_detail)
          VALUES (?, ?, 'new', ?)`,
    args: [
      wd.id,
      r.id,
      JSON.stringify({ price: r.price, area_m2: r.area_m2, location: r.location, source: "db_scan" }),
    ] as InValue[],
  }));

  await db.batch(stmts, "write");
  return filtered.length;
}
