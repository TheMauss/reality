import Database from "better-sqlite3";

interface Watchdog {
  id: number;
  user_id: number;
  name: string;
  active: number;
  category: string | null;
  region_id: number | null;
  district_id: number | null;
  location: string | null;
  price_min: number | null;
  price_max: number | null;
  area_min: number | null;
  area_max: number | null;
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
 * Checks all active watchdogs against scrape events and inserts matches.
 */
export function runWatchdog(db: Database.Database, events: ScrapeEvents): number {
  const watchdogs = db
    .prepare("SELECT * FROM watchdogs WHERE active = 1")
    .all() as Watchdog[];

  if (watchdogs.length === 0) return 0;

  const matches: WatchdogMatchInsert[] = [];

  // Check new listings
  const newWatchdogs = watchdogs.filter((w) => w.watch_new);
  for (const listing of events.newListings) {
    for (const wd of newWatchdogs) {
      if (matchesFilter(listing, wd)) {
        matches.push({
          watchdog_id: wd.id,
          listing_id: listing.id,
          match_type: "new",
          match_detail: JSON.stringify({
            price: listing.price,
            area_m2: listing.area_m2,
            location: listing.location,
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
        matches.push({
          watchdog_id: wd.id,
          listing_id: drop.listing.id,
          match_type: "drop",
          match_detail: JSON.stringify({
            old_price: drop.oldPrice,
            new_price: drop.newPrice,
            drop_pct: drop.dropPct,
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
        matches.push({
          watchdog_id: wd.id,
          listing_id: listing.id,
          match_type: "returned",
          match_detail: JSON.stringify({
            price: listing.price,
            location: listing.location,
          }),
        });
      }
    }
  }

  // Check underpriced listings (new + price drops combined)
  const underpricedWatchdogs = watchdogs.filter((w) => w.watch_underpriced);
  if (underpricedWatchdogs.length > 0) {
    const allRelevant = [
      ...events.newListings,
      ...events.priceDrops.map((d) => d.listing),
    ];

    // Cache avg prices per district to avoid repeated queries
    const avgPriceCache = new Map<string, number | null>();

    for (const listing of allRelevant) {
      if (!listing.area_m2 || listing.area_m2 <= 0) continue;

      for (const wd of underpricedWatchdogs) {
        if (!matchesFilter(listing, wd)) continue;

        const avgPriceM2 = getCachedLocalAvgPriceM2(
          db,
          listing,
          avgPriceCache
        );
        if (avgPriceM2 === null) continue;

        const listingPriceM2 = listing.price / listing.area_m2;
        const diffPct =
          ((avgPriceM2 - listingPriceM2) / avgPriceM2) * 100;

        if (diffPct >= (wd.watch_underpriced_pct || 15)) {
          // Avoid duplicate if already matched as "new"
          const alreadyMatched = matches.some(
            (m) =>
              m.watchdog_id === wd.id &&
              m.listing_id === listing.id
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

  // Insert all matches in a transaction
  if (matches.length > 0) {
    const insertMatch = db.prepare(
      "INSERT INTO watchdog_matches (watchdog_id, listing_id, match_type, match_detail) VALUES (?, ?, ?, ?)"
    );

    const insertAll = db.transaction(() => {
      for (const m of matches) {
        insertMatch.run(m.watchdog_id, m.listing_id, m.match_type, m.match_detail);
      }
    });

    insertAll();
    console.log(`Watchdog: ${matches.length} matches for ${watchdogs.length} active watchdogs`);
  }

  return matches.length;
}

/**
 * Check if a listing matches a watchdog's filters.
 */
function matchesFilter(listing: ParsedListing, wd: Watchdog): boolean {
  if (wd.category && listing.category !== wd.category) return false;
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

  // Keyword matching — check title and description
  if (wd.keywords) {
    try {
      const keywords = JSON.parse(wd.keywords) as string[];
      if (keywords.length > 0) {
        const text = [
          listing.title,
          listing.location,
          listing.description || "",
        ]
          .join(" ")
          .toLowerCase();

        const anyMatch = keywords.some((kw) =>
          text.includes(kw.toLowerCase())
        );
        if (!anyMatch) return false;
      }
    } catch {
      // Invalid JSON — ignore keyword filter
    }
  }

  return true;
}

/**
 * Get average sold price per m² for a listing's location.
 * Uses sold_wards for municipality-level data, falls back to sold_districts.
 */
function getLocalAvgPriceM2(
  db: Database.Database,
  listing: ParsedListing
): number | null {
  // Try ward-level (most precise) — match by GPS proximity
  if (listing.lat && listing.lon) {
    const ward = db
      .prepare(
        `SELECT avg_price_m2 FROM sold_wards
         WHERE avg_price_m2 IS NOT NULL AND avg_price_m2 > 0
         ORDER BY ABS(
           (SELECT AVG(lat) FROM sold_transactions WHERE ward_id = sold_wards.id) - ?
         ) + ABS(
           (SELECT AVG(lon) FROM sold_transactions WHERE ward_id = sold_wards.id) - ?
         )
         LIMIT 1`
      )
      .get(listing.lat, listing.lon) as { avg_price_m2: number } | undefined;

    if (ward?.avg_price_m2) return ward.avg_price_m2;
  }

  // Fallback: district level
  if (listing.district_id) {
    const district = db
      .prepare(
        "SELECT avg_price_m2 FROM sold_districts WHERE id = ? AND avg_price_m2 IS NOT NULL"
      )
      .get(listing.district_id) as { avg_price_m2: number } | undefined;

    if (district?.avg_price_m2) return district.avg_price_m2;
  }

  // Fallback: region level
  if (listing.region_id) {
    const region = db
      .prepare(
        "SELECT avg_price_m2 FROM sold_regions WHERE id = ? AND avg_price_m2 IS NOT NULL"
      )
      .get(listing.region_id) as { avg_price_m2: number } | undefined;

    if (region?.avg_price_m2) return region.avg_price_m2;
  }

  return null;
}

/**
 * Cached wrapper for getLocalAvgPriceM2 — uses district_id as cache key.
 */
function getCachedLocalAvgPriceM2(
  db: Database.Database,
  listing: ParsedListing,
  cache: Map<string, number | null>
): number | null {
  const key = `${listing.district_id ?? "no-district"}_${listing.region_id ?? "no-region"}`;
  if (cache.has(key)) return cache.get(key)!;

  const result = getLocalAvgPriceM2(db, listing);
  cache.set(key, result);
  return result;
}
