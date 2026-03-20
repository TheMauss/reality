import "dotenv/config";
import Database from "better-sqlite3";
import path from "path";
import { scrapeAllListings, scrapeLatestListings, DistrictInfo } from "./sreality";
import { scrapeAllBezrealitky, scrapeLatestBezrealitky } from "./bezrealitky";
import { runWatchdog } from "./watchdog";
import type { ScrapeEvents, ParsedListing } from "./watchdog";

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, "..", "..", "cenovypad.db");

export async function runScrape() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Init schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      location TEXT,
      area_m2 REAL,
      category TEXT,
      price INTEGER NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT,
      removed_at TEXT,
      lat REAL,
      lon REAL,
      region_id INTEGER,
      district_id INTEGER,
      description TEXT,
      image_url TEXT
    );
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id TEXT NOT NULL,
      price INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS price_drops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id TEXT NOT NULL,
      old_price INTEGER NOT NULL,
      new_price INTEGER NOT NULL,
      drop_pct REAL NOT NULL,
      detected_at TEXT NOT NULL,
      title TEXT,
      url TEXT,
      location TEXT,
      category TEXT,
      area_m2 REAL
    );
    CREATE INDEX IF NOT EXISTS idx_ph_listing ON price_history(listing_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_pd_detected ON price_drops(detected_at);

    CREATE TABLE IF NOT EXISTS listing_sources (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id   TEXT NOT NULL REFERENCES listings(id),
      source       TEXT NOT NULL,
      source_id    TEXT NOT NULL,
      url          TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at  TEXT,
      removed_at    TEXT,
      UNIQUE(source, source_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ls_listing ON listing_sources(listing_id);
    CREATE INDEX IF NOT EXISTS idx_ls_source ON listing_sources(source, source_id);

    CREATE TABLE IF NOT EXISTS listing_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      detected_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lc_listing ON listing_changes(listing_id, detected_at);

    CREATE TABLE IF NOT EXISTS watchdogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      category TEXT,
      region_id INTEGER,
      district_id INTEGER,
      location TEXT,
      price_min INTEGER,
      price_max INTEGER,
      area_min REAL,
      area_max REAL,
      keywords TEXT,
      watch_new INTEGER NOT NULL DEFAULT 1,
      watch_drops INTEGER NOT NULL DEFAULT 0,
      watch_drops_min_pct REAL DEFAULT 5,
      watch_underpriced INTEGER NOT NULL DEFAULT 0,
      watch_underpriced_pct REAL DEFAULT 15,
      watch_returned INTEGER NOT NULL DEFAULT 0,
      notify_email INTEGER NOT NULL DEFAULT 1,
      notify_telegram INTEGER NOT NULL DEFAULT 0,
      notify_frequency TEXT NOT NULL DEFAULT 'instant',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_wd_user ON watchdogs(user_id);
    CREATE INDEX IF NOT EXISTS idx_wd_active ON watchdogs(active);

    CREATE TABLE IF NOT EXISTS watchdog_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      watchdog_id INTEGER NOT NULL,
      listing_id TEXT NOT NULL,
      match_type TEXT NOT NULL,
      match_detail TEXT,
      notified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_wm_watchdog ON watchdog_matches(watchdog_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_wm_listing ON watchdog_matches(listing_id);
    CREATE INDEX IF NOT EXISTS idx_wm_notified ON watchdog_matches(notified);
  `);

  // Migrations for existing DBs
  const addColumn = (col: string, type: string) => {
    try { db.exec(`ALTER TABLE listings ADD COLUMN ${col} ${type}`); } catch { /* exists */ }
  };
  addColumn("lat", "REAL");
  addColumn("lon", "REAL");
  addColumn("region_id", "INTEGER");
  addColumn("district_id", "INTEGER");
  addColumn("last_seen_at", "TEXT");
  addColumn("removed_at", "TEXT");
  addColumn("description", "TEXT");
  addColumn("image_url", "TEXT");

  try { db.exec("CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region_id)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_listings_district ON listings(district_id)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_listings_location ON listings(location)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_listings_last_seen ON listings(last_seen_at)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_listings_removed ON listings(removed_at)"); } catch { /* */ }

  // Migrate existing Sreality listings into listing_sources (idempotent)
  try {
    db.exec(`
      INSERT OR IGNORE INTO listing_sources (listing_id, source, source_id, url, first_seen_at, last_seen_at, removed_at)
      SELECT id, 'sreality', id, url, first_seen_at, last_seen_at, removed_at FROM listings
    `);
  } catch { /* listing_sources may not exist in very old DBs — schema init above handles it */ }

  console.log("Starting scrape...");

  const regionEnv = process.env.SCRAPE_REGIONS;
  const regionIds = regionEnv
    ? regionEnv.split(",").map((s) => parseInt(s.trim(), 10))
    : undefined;

  let districts: DistrictInfo[] | undefined;
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sold_districts'").get();
    if (tableExists) {
      districts = db.prepare("SELECT id, region_id, name FROM sold_districts").all() as DistrictInfo[];
      console.log(`Loaded ${districts.length} districts for per-district scraping`);
    }
  } catch { /* no sold_districts table yet */ }

  const scraped = await scrapeAllListings(regionIds, districts);
  const now = new Date().toISOString();

  const findListing = db.prepare("SELECT price, title, url, location, area_m2, removed_at FROM listings WHERE id = ?");
  const insertListing = db.prepare(
    "INSERT INTO listings (id, title, url, location, area_m2, category, price, first_seen_at, last_seen_at, lat, lon, region_id, district_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const updateListing = db.prepare(
    "UPDATE listings SET title = ?, url = ?, location = ?, area_m2 = ?, price = ?, last_seen_at = ?, removed_at = NULL, lat = ?, lon = ?, region_id = ?, district_id = ? WHERE id = ?"
  );
  const insertHistory = db.prepare(
    "INSERT INTO price_history (listing_id, price, recorded_at) VALUES (?, ?, ?)"
  );
  const insertDrop = db.prepare(
    "INSERT INTO price_drops (listing_id, old_price, new_price, drop_pct, detected_at, title, url, location, category, area_m2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertChange = db.prepare(
    "INSERT INTO listing_changes (listing_id, field, old_value, new_value, detected_at) VALUES (?, ?, ?, ?, ?)"
  );
  const upsertSource = db.prepare(
    "INSERT INTO listing_sources (listing_id, source, source_id, url, first_seen_at, last_seen_at, removed_at) VALUES (?, 'sreality', ?, ?, ?, ?, NULL) ON CONFLICT(source, source_id) DO UPDATE SET last_seen_at = excluded.last_seen_at, removed_at = NULL"
  );

  let newCount = 0;
  let updatedCount = 0;
  let dropCount = 0;
  let changeCount = 0;
  let returnedCount = 0;

  // Watchdog events
  const events: ScrapeEvents = {
    newListings: [],
    priceDrops: [],
    returnedListings: [],
  };

  interface ExistingListing {
    price: number;
    title: string;
    url: string;
    location: string;
    area_m2: number | null;
    removed_at: string | null;
  }

  const processAll = db.transaction(() => {
    for (const item of scraped) {
      const existing = findListing.get(item.id) as ExistingListing | undefined;

      if (!existing) {
        insertListing.run(item.id, item.title, item.url, item.location, item.area_m2, item.category, item.price, now, now, item.lat, item.lon, item.region_id, item.district_id);
        upsertSource.run(item.id, item.id, item.url, now, now);
        events.newListings.push(item);
        newCount++;
      } else {
        // Track field-level changes
        const changes: [string, string | null, string | null][] = [];
        if (existing.title !== item.title) changes.push(["title", existing.title, item.title]);
        if (existing.url !== item.url) changes.push(["url", existing.url, item.url]);
        if (existing.location !== item.location) changes.push(["location", existing.location, item.location]);
        if (existing.area_m2 !== item.area_m2) changes.push(["area_m2", String(existing.area_m2), String(item.area_m2)]);

        // Track re-appearance of previously removed listings
        if (existing.removed_at) {
          insertChange.run(item.id, "returned", existing.removed_at, null, now);
          events.returnedListings.push(item);
          returnedCount++;
        }

        for (const [field, oldVal, newVal] of changes) {
          insertChange.run(item.id, field, oldVal, newVal, now);
          changeCount++;
        }

        updateListing.run(item.title, item.url, item.location, item.area_m2, item.price, now, item.lat, item.lon, item.region_id, item.district_id, item.id);
        upsertSource.run(item.id, item.id, item.url, now, now);
        updatedCount++;
      }

      insertHistory.run(item.id, item.price, now);

      if (existing && existing.price > item.price) {
        const dropPct = Math.round(((existing.price - item.price) / existing.price) * 10000) / 100;
        insertDrop.run(item.id, existing.price, item.price, dropPct, now, item.title, item.url, item.location, item.category, item.area_m2);
        events.priceDrops.push({ listing: item, oldPrice: existing.price, newPrice: item.price, dropPct });
        dropCount++;
        console.log(`  DROP: ${item.title} ${existing.price} → ${item.price} (-${dropPct.toFixed(1)}%)`);
      }
    }
  });

  processAll();

  // Mark listings not seen in this run as removed
  // Only affects records that have last_seen_at set (i.e. at least one previous scrape)
  const markRemoved = db.prepare(
    "UPDATE listings SET removed_at = ? WHERE last_seen_at IS NOT NULL AND last_seen_at != ? AND removed_at IS NULL"
  );
  const removedResult = markRemoved.run(now, now);
  const removedCount = removedResult.changes;

  // Run watchdog checks
  const watchdogMatches = runWatchdog(db, events);

  console.log(`Done: ${newCount} new, ${updatedCount} updated, ${dropCount} drops, ${changeCount} field changes, ${removedCount} removed, ${returnedCount} returned, ${watchdogMatches} watchdog matches`);
  db.close();
}

/**
 * Fast scan: only new + repriced listings, no delisting logic.
 * Runs every minute. Full scan (runScrape) handles delistings every 2h.
 */
export async function runFastScan() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Load all active listing IDs for early-termination in scrapeLatestListings
  const activeIds = db
    .prepare("SELECT id FROM listings WHERE removed_at IS NULL")
    .all() as Array<{ id: string }>;
  const knownIds = new Set(activeIds.map(r => r.id));

  const regionEnv = process.env.SCRAPE_REGIONS;
  const regionIds = regionEnv
    ? regionEnv.split(",").map(s => parseInt(s.trim(), 10))
    : undefined;

  const scraped = await scrapeLatestListings(knownIds, regionIds);
  if (scraped.length === 0) {
    db.close();
    return;
  }

  const now = new Date().toISOString();

  const findListing = db.prepare(
    "SELECT price, removed_at FROM listings WHERE id = ?"
  );
  const insertListing = db.prepare(
    "INSERT INTO listings (id, title, url, location, area_m2, category, price, first_seen_at, last_seen_at, lat, lon, region_id, district_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const updateListing = db.prepare(
    "UPDATE listings SET title = ?, url = ?, location = ?, area_m2 = ?, price = ?, last_seen_at = ?, removed_at = NULL, lat = ?, lon = ?, region_id = ?, district_id = ? WHERE id = ?"
  );
  const insertHistory = db.prepare(
    "INSERT INTO price_history (listing_id, price, recorded_at) VALUES (?, ?, ?)"
  );
  const insertDrop = db.prepare(
    "INSERT INTO price_drops (listing_id, old_price, new_price, drop_pct, detected_at, title, url, location, category, area_m2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const upsertSource = db.prepare(
    "INSERT INTO listing_sources (listing_id, source, source_id, url, first_seen_at, last_seen_at, removed_at) VALUES (?, 'sreality', ?, ?, ?, ?, NULL) ON CONFLICT(source, source_id) DO UPDATE SET last_seen_at = excluded.last_seen_at, removed_at = NULL"
  );

  let newCount = 0;
  let updatedCount = 0;
  let dropCount = 0;
  let returnedCount = 0;

  // Watchdog events
  const events: ScrapeEvents = {
    newListings: [],
    priceDrops: [],
    returnedListings: [],
  };

  interface ExistingRow { price: number; removed_at: string | null }

  const processAll = db.transaction(() => {
    for (const item of scraped) {
      const existing = findListing.get(item.id) as ExistingRow | undefined;

      if (!existing) {
        insertListing.run(
          item.id, item.title, item.url, item.location, item.area_m2,
          item.category, item.price, now, now,
          item.lat, item.lon, item.region_id, item.district_id
        );
        upsertSource.run(item.id, item.id, item.url, now, now);
        insertHistory.run(item.id, item.price, now);
        events.newListings.push(item);
        newCount++;
      } else {
        if (existing.removed_at) {
          events.returnedListings.push(item);
          returnedCount++;
        }

        updateListing.run(
          item.title, item.url, item.location, item.area_m2,
          item.price, now, item.lat, item.lon, item.region_id, item.district_id,
          item.id
        );
        upsertSource.run(item.id, item.id, item.url, now, now);
        insertHistory.run(item.id, item.price, now);

        if (existing.price > item.price) {
          const dropPct = Math.round(((existing.price - item.price) / existing.price) * 10000) / 100;
          insertDrop.run(
            item.id, existing.price, item.price, dropPct, now,
            item.title, item.url, item.location, item.category, item.area_m2
          );
          events.priceDrops.push({ listing: item, oldPrice: existing.price, newPrice: item.price, dropPct });
          dropCount++;
          console.log(`  DROP: ${item.title} ${existing.price} → ${item.price} (-${dropPct.toFixed(1)}%)`);
        }
        updatedCount++;
      }
    }
  });

  processAll();

  // Run watchdog checks
  const watchdogMatches = runWatchdog(db, events);

  db.close();

  if (newCount + dropCount + returnedCount + watchdogMatches > 0) {
    console.log(`Fast scan: ${newCount} new, ${updatedCount} updated, ${dropCount} drops, ${returnedCount} returned, ${watchdogMatches} watchdog matches`);
  }
}

function findDuplicate(
  db: Database.Database,
  category: string,
  lat: number | null,
  lon: number | null,
  area_m2: number | null,
  price: number,
): string | null {
  if (!lat || !lon) return null;
  const row = db.prepare(`
    SELECT id FROM listings
    WHERE category = ?
      AND removed_at IS NULL
      AND lat IS NOT NULL AND lon IS NOT NULL
      AND ABS(lat - ?) < 0.0009
      AND ABS(lon - ?) < 0.0013
      AND (? IS NULL OR ABS(COALESCE(area_m2, 0) - ?) <= 5)
      AND ABS(CAST(price AS REAL) - ?) / MAX(CAST(price AS REAL), 1) < 0.03
    LIMIT 1
  `).get(category, lat, lon, area_m2, area_m2 ?? 0, price) as { id: string } | undefined;
  return row?.id ?? null;
}

export async function runBezrealitkyScan(mode: "fast" | "full"): Promise<void> {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Ensure listing_sources table exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS listing_sources (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id   TEXT NOT NULL REFERENCES listings(id),
        source       TEXT NOT NULL,
        source_id    TEXT NOT NULL,
        url          TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at  TEXT,
        removed_at    TEXT,
        UNIQUE(source, source_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ls_listing ON listing_sources(listing_id);
      CREATE INDEX IF NOT EXISTS idx_ls_source ON listing_sources(source, source_id);
    `);
  } catch { /* already exists */ }

  // Load known Bezrealitky source IDs for early-termination in fast mode
  const knownSourceIds = new Set<string>(
    (db.prepare("SELECT source_id FROM listing_sources WHERE source = 'bezrealitky'").all() as Array<{ source_id: string }>)
      .map(r => r.source_id)
  );

  const scraped =
    mode === "fast"
      ? await scrapeLatestBezrealitky(knownSourceIds)
      : await scrapeAllBezrealitky();

  if (scraped.length === 0) {
    db.close();
    return;
  }

  const now = new Date().toISOString();

  const findSource = db.prepare(
    "SELECT listing_id FROM listing_sources WHERE source = 'bezrealitky' AND source_id = ?"
  );
  const updateSourceSeen = db.prepare(
    "UPDATE listing_sources SET last_seen_at = ? WHERE source = 'bezrealitky' AND source_id = ?"
  );
  const insertSourceRow = db.prepare(
    "INSERT OR IGNORE INTO listing_sources (listing_id, source, source_id, url, first_seen_at, last_seen_at, removed_at) VALUES (?, 'bezrealitky', ?, ?, ?, ?, NULL)"
  );
  const insertNewListing = db.prepare(
    "INSERT INTO listings (id, title, url, location, area_m2, category, price, first_seen_at, last_seen_at, lat, lon, region_id, district_id, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const fillMissingData = db.prepare(
    "UPDATE listings SET description = ?, image_url = ? WHERE id = ? AND description IS NULL AND image_url IS NULL"
  );
  const insertHistory = db.prepare(
    "INSERT INTO price_history (listing_id, price, recorded_at) VALUES (?, ?, ?)"
  );

  let newCount = 0;
  let matchedCount = 0;
  let updatedCount = 0;

  const processAll = db.transaction(() => {
    for (const item of scraped) {
      const existingSource = findSource.get(item.source_id) as { listing_id: string } | undefined;

      if (existingSource) {
        // Already tracked — just update last_seen_at
        updateSourceSeen.run(now, item.source_id);
        updatedCount++;
        continue;
      }

      // Try to match against an existing canonical listing
      const duplicateId = findDuplicate(db, item.category, item.lat, item.lon, item.area_m2, item.price);

      if (duplicateId) {
        // Link to existing listing + fill missing description/image if canonical lacks them
        insertSourceRow.run(duplicateId, item.source_id, item.url, now, now);
        if (item.description || item.image_url) {
          fillMissingData.run(item.description, item.image_url, duplicateId);
        }
        matchedCount++;
      } else {
        // Create a new listing with a "bz_" prefixed ID
        const newId = `bz_${item.source_id}`;
        try {
          insertNewListing.run(
            newId, item.title, item.url, item.location, item.area_m2,
            item.category, item.price, now, now,
            item.lat, item.lon, item.region_id, null,
            item.description, item.image_url,
          );
          insertHistory.run(newId, item.price, now);
          insertSourceRow.run(newId, item.source_id, item.url, now, now);
          newCount++;
        } catch (err) {
          console.error(`  BR: failed to insert listing bz_${item.source_id}:`, err);
        }
      }
    }
  });

  processAll();
  db.close();

  console.log(`BR ${mode}: ${newCount} new, ${matchedCount} matched, ${updatedCount} updated`);
}

// Run directly
runScrape().catch(console.error);
