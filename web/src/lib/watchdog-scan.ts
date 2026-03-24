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
  if (wd.location) { conditions.push("location LIKE ?"); args.push(`%${wd.location}%`); }

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
    `SELECT id, title, url, location, price, area_m2, category, region_id, district_id, dispozice FROM listings WHERE ${conditions.join(" AND ")} ORDER BY first_seen_at DESC LIMIT 200`
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
        sql: `INSERT OR IGNORE INTO watchdog_matches (watchdog_id, listing_id, match_type, match_detail)
              VALUES (?, ?, 'new', ?)`,
        args: [wd.id, r.id, JSON.stringify({ price: r.price, area_m2: r.area_m2, location: r.location, source: "db_scan" })],
      });
    }
  }

  // 'underpriced' matches
  if (wd.watch_underpriced) {
    const minPct = wd.watch_underpriced_pct || 15;
    const avgMap = await loadAvgPrices(db, filtered);

    for (const r of filtered) {
      if (!r.area_m2 || r.area_m2 <= 0) continue;

      const avgPriceM2 = lookupAvg(avgMap, r);
      if (avgPriceM2 === null) continue;

      const listingPriceM2 = r.price / r.area_m2;
      const diffPct = ((avgPriceM2 - listingPriceM2) / avgPriceM2) * 100;

      if (diffPct >= minPct) {
        stmts.push({
          sql: `INSERT OR IGNORE INTO watchdog_matches (watchdog_id, listing_id, match_type, match_detail)
              VALUES (?, ?, 'underpriced', ?)`,
          args: [wd.id, r.id, JSON.stringify({
                  avg_price_m2: Math.round(avgPriceM2),
                  listing_price_m2: Math.round(listingPriceM2),
                  diff_pct: Math.round(diffPct * 10) / 10,
                  price: r.price,
                  area_m2: r.area_m2,
                  source: "db_scan",
                })],
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

// --- Batch avg price loader (3 queries total instead of 3 per listing) ---

function soldCategory(category: string): string {
  if (category.startsWith("domy")) return "domy";
  return "byty";
}

type DB = ReturnType<typeof getDB>;

interface AvgPriceMap {
  // key: "ward_{district_id}_{wardName}_{cat}" or "district_{id}_{cat}" or "region_{id}_{cat}"
  ward: Map<string, number>;
  district: Map<string, number>;
  region: Map<string, number>;
}

async function loadAvgPrices(db: DB, listings: ListingRow[]): Promise<AvgPriceMap> {
  const result: AvgPriceMap = { ward: new Map(), district: new Map(), region: new Map() };

  // Load all latest ward avg prices in one query
  try {
    const wardRows = await db.prepare(
      `SELECT w.district_id, w.name, h.category, h.avg_price_m2
       FROM sold_price_history h
       JOIN sold_wards w ON w.id = h.entity_id
       WHERE h.entity_type = 'ward'
       GROUP BY w.district_id, w.name, h.category
       HAVING (h.year * 100 + h.month) = MAX(h.year * 100 + h.month)`
    ).all() as unknown as Array<{ district_id: number; name: string; category: string; avg_price_m2: number }>;
    for (const r of wardRows) {
      result.ward.set(`${r.district_id}_${r.name}_${r.category}`, r.avg_price_m2);
    }
  } catch { /* table might not exist */ }

  // Load all latest district avg prices
  try {
    const distRows = await db.prepare(
      `SELECT entity_id, category, avg_price_m2 FROM sold_price_history
       WHERE entity_type = 'district'
       GROUP BY entity_id, category
       HAVING (year * 100 + month) = MAX(year * 100 + month)`
    ).all() as unknown as Array<{ entity_id: number; category: string; avg_price_m2: number }>;
    for (const r of distRows) {
      result.district.set(`${r.entity_id}_${r.category}`, r.avg_price_m2);
    }
  } catch { /* */ }

  // Load all latest region avg prices
  try {
    const regRows = await db.prepare(
      `SELECT entity_id, category, avg_price_m2 FROM sold_price_history
       WHERE entity_type = 'region'
       GROUP BY entity_id, category
       HAVING (year * 100 + month) = MAX(year * 100 + month)`
    ).all() as unknown as Array<{ entity_id: number; category: string; avg_price_m2: number }>;
    for (const r of regRows) {
      result.region.set(`${r.entity_id}_${r.category}`, r.avg_price_m2);
    }
  } catch { /* */ }

  return result;
}

function lookupAvg(avgMap: AvgPriceMap, listing: ListingRow): number | null {
  const cat = soldCategory(listing.category);

  // 1. Ward
  if (listing.district_id && listing.location) {
    const wardName = listing.location.split(",")[0].trim();
    const v = avgMap.ward.get(`${listing.district_id}_${wardName}_${cat}`);
    if (v) return v;
  }
  // 2. District
  if (listing.district_id) {
    const v = avgMap.district.get(`${listing.district_id}_${cat}`);
    if (v) return v;
  }
  // 3. Region
  if (listing.region_id) {
    const v = avgMap.region.get(`${listing.region_id}_${cat}`);
    if (v) return v;
  }
  return null;
}
