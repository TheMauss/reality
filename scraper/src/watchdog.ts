import type { Client } from "./turso";

interface Watchdog {
  id: number;
  user_id: number;
  name: string;
  active: number;
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
  watch_drops: number;
  watch_drops_min_pct: number;
  watch_underpriced: number;
  watch_underpriced_pct: number;
  watch_returned: number;
  notify_email: number;
  notify_telegram: number;
  notify_frequency: string;
}

export interface ParsedListing {
  id: string;
  title: string;
  url: string;
  location: string;
  area_m2: number | null;
  category: string;
  dispozice?: string | null;
  price: number;
  lat: number | null;
  lon: number | null;
  region_id: number | null;
  district_id: number | null;
  description?: string | null;
}

export interface ScrapeEvents {
  newListings: ParsedListing[];
  priceDrops: { listing: ParsedListing; oldPrice: number; newPrice: number; dropPct: number }[];
  returnedListings: ParsedListing[];
}

interface WatchdogMatchInsert {
  watchdog_id: number;
  listing_id: string;
  match_type: string;
  match_detail: string | null;
}

/**
 * Main watchdog entry point — call after each scrape run.
 */
export async function runWatchdog(client: Client, events: ScrapeEvents): Promise<number> {
  const watchdogRows = (await client.execute("SELECT * FROM watchdogs WHERE active = 1")).rows;
  const watchdogs = watchdogRows as unknown as Watchdog[];

  if (watchdogs.length === 0) return 0;

  const matches: WatchdogMatchInsert[] = [];
  const avgPriceCache = new Map<string, number | null>();

  // Helper: get avg for a listing (cached)
  async function avgFor(listing: ParsedListing): Promise<number | null> {
    return getCachedLocalAvgPriceM2(client, listing, avgPriceCache);
  }

  // Check new listings
  const newWatchdogs = watchdogs.filter((w) => w.watch_new);
  for (const listing of events.newListings) {
    for (const wd of newWatchdogs) {
      if (matchesFilter(listing, wd)) {
        const avg = await avgFor(listing);
        matches.push({
          watchdog_id: wd.id,
          listing_id: listing.id,
          match_type: "new",
          match_detail: JSON.stringify({
            price: listing.price,
            area_m2: listing.area_m2,
            location: listing.location,
            avg_price_m2: avg ? Math.round(avg) : null,
          }),
        });
      }
    }
  }

  // Check price drops
  const dropWatchdogs = watchdogs.filter((w) => w.watch_drops);
  for (const drop of events.priceDrops) {
    for (const wd of dropWatchdogs) {
      if (
        drop.dropPct >= (wd.watch_drops_min_pct || 0) &&
        matchesFilter(drop.listing, wd)
      ) {
        const avg = await avgFor(drop.listing);
        matches.push({
          watchdog_id: wd.id,
          listing_id: drop.listing.id,
          match_type: "drop",
          match_detail: JSON.stringify({
            old_price: drop.oldPrice,
            new_price: drop.newPrice,
            drop_pct: drop.dropPct,
            avg_price_m2: avg ? Math.round(avg) : null,
          }),
        });
      }
    }
  }

  // Check returned listings
  const returnedWatchdogs = watchdogs.filter((w) => w.watch_returned);
  for (const listing of events.returnedListings) {
    for (const wd of returnedWatchdogs) {
      if (matchesFilter(listing, wd)) {
        const avg = await avgFor(listing);
        matches.push({
          watchdog_id: wd.id,
          listing_id: listing.id,
          match_type: "returned",
          match_detail: JSON.stringify({
            price: listing.price,
            location: listing.location,
            avg_price_m2: avg ? Math.round(avg) : null,
          }),
        });
      }
    }
  }

  // Check underpriced listings
  const underpricedWatchdogs = watchdogs.filter((w) => w.watch_underpriced);
  if (underpricedWatchdogs.length > 0) {
    const allRelevant = [
      ...events.newListings,
      ...events.priceDrops.map((d) => d.listing),
    ];

    for (const listing of allRelevant) {
      if (!listing.area_m2 || listing.area_m2 <= 0) continue;

      for (const wd of underpricedWatchdogs) {
        if (!matchesFilter(listing, wd)) continue;

        const avgPriceM2 = await getCachedLocalAvgPriceM2(client, listing, avgPriceCache);
        if (avgPriceM2 === null) continue;

        const listingPriceM2 = listing.price / listing.area_m2;
        const diffPct = ((avgPriceM2 - listingPriceM2) / avgPriceM2) * 100;

        if (diffPct >= (wd.watch_underpriced_pct || 15)) {
          const alreadyMatched = matches.some(
            (m) => m.watchdog_id === wd.id && m.listing_id === listing.id
          );
          if (alreadyMatched) continue;

          matches.push({
            watchdog_id: wd.id,
            listing_id: listing.id,
            match_type: "underpriced",
            match_detail: JSON.stringify({
              avg_price_m2: Math.round(avgPriceM2),
              listing_price_m2: Math.round(listingPriceM2),
              diff_pct: Math.round(diffPct * 10) / 10,
              price: listing.price,
              area_m2: listing.area_m2,
            }),
          });
        }
      }
    }
  }

  // Insert all matches (skip duplicates via unique index)
  if (matches.length > 0) {
    const stmts = matches.map((m) => ({
      sql: `INSERT OR IGNORE INTO watchdog_matches (watchdog_id, listing_id, match_type, match_detail)
            VALUES (?, ?, ?, ?)`,
      args: [m.watchdog_id, m.listing_id, m.match_type, m.match_detail] as any[],
    }));
    await client.batch(stmts, "write");
    console.log(`Watchdog: ${matches.length} matches for ${watchdogs.length} active watchdogs`);
  }

  return matches.length;
}

function matchesFilter(listing: ParsedListing, wd: Watchdog): boolean {
  if (wd.category) {
    let cats: string[];
    try { cats = JSON.parse(wd.category); if (!Array.isArray(cats)) cats = [wd.category]; }
    catch { cats = [wd.category]; }
    if (cats.length > 0 && !cats.includes(listing.category)) return false;
  }
  if (wd.property_type) {
    try {
      const types = JSON.parse(wd.property_type) as string[];
      if (types.length > 0) {
        if (!listing.dispozice || !types.includes(listing.dispozice)) return false;
      }
    } catch { /* */ }
  }
  if (wd.region_id && listing.region_id !== wd.region_id) return false;
  if (wd.district_id && listing.district_id !== wd.district_id) return false;

  if (wd.location && listing.location) {
    if (!listing.location.toLowerCase().includes(wd.location.toLowerCase())) {
      return false;
    }
  }

  if (wd.price_min && listing.price < wd.price_min) return false;
  if (wd.price_max && listing.price > wd.price_max) return false;
  if (wd.area_min && (listing.area_m2 === null || listing.area_m2 < wd.area_min)) return false;
  if (wd.area_max && (listing.area_m2 === null || listing.area_m2 > wd.area_max)) return false;

  if (wd.layout) {
    try {
      const layouts = JSON.parse(wd.layout) as string[];
      if (layouts.length > 0) {
        if (!layouts.some((l) => listing.title.toLowerCase().includes(l.toLowerCase()))) return false;
      }
    } catch { /* */ }
  }

  if (wd.price_m2_min || wd.price_m2_max) {
    if (!listing.area_m2 || listing.area_m2 <= 0) return false;
    const priceM2 = listing.price / listing.area_m2;
    if (wd.price_m2_min && priceM2 < wd.price_m2_min) return false;
    if (wd.price_m2_max && priceM2 > wd.price_m2_max) return false;
  }

  if (wd.keywords) {
    try {
      const keywords = JSON.parse(wd.keywords) as string[];
      if (keywords.length > 0) {
        const text = [listing.title, listing.location, listing.description || ""]
          .join(" ")
          .toLowerCase();
        if (!keywords.some((kw) => text.includes(kw.toLowerCase()))) return false;
      }
    } catch { /* */ }
  }

  return true;
}

function soldCategory(listingCategory: string): string {
  if (listingCategory.startsWith("domy")) return "domy";
  return "byty"; // default for byty-prodej, byty-najem; pozemky/komercni have no sold data
}

async function getLocalAvgPriceM2(client: Client, listing: ParsedListing): Promise<number | null> {
  const cat = soldCategory(listing.category);

  // 1. Try ward — match first part of location string against sold_wards.name within district
  if (listing.district_id && listing.location) {
    const wardName = listing.location.split(",")[0].trim();
    const row = (await client.execute({
      sql: `SELECT h.avg_price_m2
            FROM sold_price_history h
            JOIN sold_wards w ON w.id = h.entity_id
            WHERE h.entity_type = 'ward' AND h.category = ?
              AND w.district_id = ? AND w.name = ?
            ORDER BY h.year * 100 + h.month DESC LIMIT 1`,
      args: [cat, listing.district_id, wardName],
    })).rows[0];
    if (row?.avg_price_m2) return row.avg_price_m2 as number;
  }

  // 2. Try district
  if (listing.district_id) {
    const row = (await client.execute({
      sql: `SELECT avg_price_m2 FROM sold_price_history
            WHERE entity_type = 'district' AND entity_id = ? AND category = ?
            ORDER BY year * 100 + month DESC LIMIT 1`,
      args: [listing.district_id, cat],
    })).rows[0];
    if (row?.avg_price_m2) return row.avg_price_m2 as number;
  }

  // 3. Try region
  if (listing.region_id) {
    const row = (await client.execute({
      sql: `SELECT avg_price_m2 FROM sold_price_history
            WHERE entity_type = 'region' AND entity_id = ? AND category = ?
            ORDER BY year * 100 + month DESC LIMIT 1`,
      args: [listing.region_id, cat],
    })).rows[0];
    if (row?.avg_price_m2) return row.avg_price_m2 as number;
  }

  return null;
}

async function getCachedLocalAvgPriceM2(
  client: Client,
  listing: ParsedListing,
  cache: Map<string, number | null>
): Promise<number | null> {
  const wardName = listing.location ? listing.location.split(",")[0].trim() : "";
  const cat = soldCategory(listing.category);
  const key = `${cat}_${wardName}_${listing.district_id ?? "no-district"}_${listing.region_id ?? "no-region"}`;
  if (cache.has(key)) return cache.get(key)!;
  const result = await getLocalAvgPriceM2(client, listing);
  cache.set(key, result);
  return result;
}
