import { getDB } from "@/lib/db";
import type { InValue } from "@libsql/client";

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
  watch_underpriced: number;
  watch_underpriced_pct: number;
}

interface ListingRow {
  id: string;
  title: string;
  url: string;
  location: string;
  price: number;
  area_m2: number | null;
  category: string;
  region_id: number | null;
  district_id: number | null;
  dispozice: string | null;
}

/**
 * Scans existing DB listings against a watchdog and inserts matches.
 * Supports both 'new' and 'underpriced' match types.
 * Returns number of new matches inserted.
 */
export async function scanExistingListings(wd: WatchdogConfig): Promise<number> {
  if (!wd.watch_new && !wd.watch_underpriced) return 0;

  const db = getDB();

  const conditions: string[] = ["removed_at IS NULL"];
  const args: InValue[] = [];

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
    `SELECT id, title, url, location, price, area_m2, category, region_id, district_id, dispozice FROM listings WHERE ${conditions.join(" AND ")} ORDER BY first_seen_at DESC LIMIT 500`
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

  const stmts: { sql: string; args: InValue[] }[] = [];

  // 'new' matches
  if (wd.watch_new) {
    for (const r of filtered) {
      stmts.push({
        sql: `INSERT INTO watchdog_matches (watchdog_id, listing_id, match_type, match_detail)
              SELECT ?, ?, 'new', ?
              WHERE NOT EXISTS (
                SELECT 1 FROM watchdog_matches
                WHERE watchdog_id = ? AND listing_id = ? AND match_type = 'new'
              )`,
        args: [wd.id, r.id, JSON.stringify({ price: r.price, area_m2: r.area_m2, location: r.location, source: "db_scan" }),
               wd.id, r.id],
      });
    }
  }

  // 'underpriced' matches
  if (wd.watch_underpriced) {
    const minPct = wd.watch_underpriced_pct || 15;
    const avgCache = new Map<string, number | null>();

    for (const r of filtered) {
      if (!r.area_m2 || r.area_m2 <= 0) continue;

      const avgPriceM2 = await getCachedAvgPriceM2(db, r, avgCache);
      if (avgPriceM2 === null) continue;

      const listingPriceM2 = r.price / r.area_m2;
      const diffPct = ((avgPriceM2 - listingPriceM2) / avgPriceM2) * 100;

      if (diffPct >= minPct) {
        stmts.push({
          sql: `INSERT INTO watchdog_matches (watchdog_id, listing_id, match_type, match_detail)
                SELECT ?, ?, 'underpriced', ?
                WHERE NOT EXISTS (
                  SELECT 1 FROM watchdog_matches
                  WHERE watchdog_id = ? AND listing_id = ? AND match_type = 'underpriced'
                )`,
          args: [wd.id, r.id, JSON.stringify({
                  avg_price_m2: Math.round(avgPriceM2),
                  listing_price_m2: Math.round(listingPriceM2),
                  diff_pct: Math.round(diffPct * 10) / 10,
                  price: r.price,
                  area_m2: r.area_m2,
                  source: "db_scan",
                }),
                wd.id, r.id],
        });
      }
    }
  }

  if (stmts.length === 0) return 0;

  // Insert in batches of 50
  const BATCH = 50;
  for (let i = 0; i < stmts.length; i += BATCH) {
    await db.batch(stmts.slice(i, i + BATCH));
  }

  return stmts.length;
}

// --- Underpriced helpers (mirrors scraper/src/watchdog.ts logic) ---

function soldCategory(category: string): string {
  if (category.startsWith("domy")) return "domy";
  return "byty";
}

type DB = ReturnType<typeof getDB>;

async function getAvgPriceM2(db: DB, listing: ListingRow): Promise<number | null> {
  const cat = soldCategory(listing.category);

  // 1. Ward
  if (listing.district_id && listing.location) {
    const wardName = listing.location.split(",")[0].trim();
    const row = await db.prepare(
      `SELECT h.avg_price_m2
       FROM sold_price_history h
       JOIN sold_wards w ON w.id = h.entity_id
       WHERE h.entity_type = 'ward' AND h.category = ?
         AND w.district_id = ? AND w.name = ?
       ORDER BY h.year * 100 + h.month DESC LIMIT 1`
    ).get(cat, listing.district_id, wardName) as unknown as { avg_price_m2: number } | undefined;
    if (row?.avg_price_m2) return row.avg_price_m2;
  }

  // 2. District
  if (listing.district_id) {
    const row = await db.prepare(
      `SELECT avg_price_m2 FROM sold_price_history
       WHERE entity_type = 'district' AND entity_id = ? AND category = ?
       ORDER BY year * 100 + month DESC LIMIT 1`
    ).get(listing.district_id, cat) as unknown as { avg_price_m2: number } | undefined;
    if (row?.avg_price_m2) return row.avg_price_m2;
  }

  // 3. Region
  if (listing.region_id) {
    const row = await db.prepare(
      `SELECT avg_price_m2 FROM sold_price_history
       WHERE entity_type = 'region' AND entity_id = ? AND category = ?
       ORDER BY year * 100 + month DESC LIMIT 1`
    ).get(listing.region_id, cat) as unknown as { avg_price_m2: number } | undefined;
    if (row?.avg_price_m2) return row.avg_price_m2;
  }

  return null;
}

async function getCachedAvgPriceM2(
  db: DB,
  listing: ListingRow,
  cache: Map<string, number | null>,
): Promise<number | null> {
  const wardName = listing.location ? listing.location.split(",")[0].trim() : "";
  const cat = soldCategory(listing.category);
  const key = `${cat}_${wardName}_${listing.district_id ?? "x"}_${listing.region_id ?? "x"}`;
  if (cache.has(key)) return cache.get(key)!;
  const result = await getAvgPriceM2(db, listing);
  cache.set(key, result);
  return result;
}
