import "dotenv/config";
import { getClient, type Client, type InValue } from "./turso";
import { scrapeAllListings, scrapeLatestListings, DistrictInfo } from "./sreality";
import { scrapeAllBezrealitky, scrapeLatestBezrealitky } from "./bezrealitky";
import { runWatchdog } from "./watchdog";
import type { ScrapeEvents, ParsedListing } from "./watchdog";

const SCHEMA_SQL = `
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
    listing_id   TEXT NOT NULL,
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
    category TEXT, region_id INTEGER, district_id INTEGER, location TEXT,
    price_min INTEGER, price_max INTEGER, area_min REAL, area_max REAL,
    keywords TEXT,
    watch_new INTEGER NOT NULL DEFAULT 1,
    watch_drops INTEGER NOT NULL DEFAULT 0, watch_drops_min_pct REAL DEFAULT 5,
    watch_underpriced INTEGER NOT NULL DEFAULT 0, watch_underpriced_pct REAL DEFAULT 15,
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
`;

const MIGRATION_SQLS = [
  "ALTER TABLE listings ADD COLUMN lat REAL",
  "ALTER TABLE listings ADD COLUMN lon REAL",
  "ALTER TABLE listings ADD COLUMN region_id INTEGER",
  "ALTER TABLE listings ADD COLUMN district_id INTEGER",
  "ALTER TABLE listings ADD COLUMN last_seen_at TEXT",
  "ALTER TABLE listings ADD COLUMN removed_at TEXT",
  "ALTER TABLE listings ADD COLUMN description TEXT",
  "ALTER TABLE listings ADD COLUMN image_url TEXT",
  "CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region_id)",
  "CREATE INDEX IF NOT EXISTS idx_listings_district ON listings(district_id)",
  "CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category)",
  "CREATE INDEX IF NOT EXISTS idx_listings_location ON listings(location)",
  "CREATE INDEX IF NOT EXISTS idx_listings_last_seen ON listings(last_seen_at)",
  "CREATE INDEX IF NOT EXISTS idx_listings_removed ON listings(removed_at)",
];

async function initSchema(client: Client) {
  await client.executeMultiple(SCHEMA_SQL);
  for (const sql of MIGRATION_SQLS) {
    try { await client.execute(sql); } catch { /* exists */ }
  }
  try {
    await client.execute(`
      INSERT OR IGNORE INTO listing_sources (listing_id, source, source_id, url, first_seen_at, last_seen_at, removed_at)
      SELECT id, 'sreality', id, url, first_seen_at, last_seen_at, removed_at FROM listings
    `);
  } catch { /* */ }
}

export async function runScrape() {
  const client = getClient();
  await initSchema(client);

  console.log("Starting scrape...");

  const regionEnv = process.env.SCRAPE_REGIONS;
  const regionIds = regionEnv
    ? regionEnv.split(",").map((s) => parseInt(s.trim(), 10))
    : undefined;

  let districts: DistrictInfo[] | undefined;
  try {
    const tableExists = (await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sold_districts'")).rows[0];
    if (tableExists) {
      const rows = (await client.execute("SELECT id, region_id, name FROM sold_districts")).rows;
      districts = rows as unknown as DistrictInfo[];
      console.log(`Loaded ${districts.length} districts for per-district scraping`);
    }
  } catch { /* no sold_districts table yet */ }

  const scraped = await scrapeAllListings(regionIds, districts);
  const now = new Date().toISOString();

  let newCount = 0;
  let updatedCount = 0;
  let dropCount = 0;
  let changeCount = 0;
  let returnedCount = 0;

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

  // Process in batches using interactive transaction
  const BATCH_SIZE = 500;
  for (let batchStart = 0; batchStart < scraped.length; batchStart += BATCH_SIZE) {
    const batch = scraped.slice(batchStart, batchStart + BATCH_SIZE);
    const tx = await client.transaction("write");

    try {
      for (const item of batch) {
        const existingRow = (await tx.execute({
          sql: "SELECT price, title, url, location, area_m2, removed_at FROM listings WHERE id = ?",
          args: [item.id],
        })).rows[0] as unknown as ExistingListing | undefined;

        if (!existingRow) {
          await tx.execute({
            sql: "INSERT INTO listings (id, title, url, location, area_m2, category, price, first_seen_at, last_seen_at, lat, lon, region_id, district_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            args: [item.id, item.title, item.url, item.location, item.area_m2, item.category, item.price, now, now, item.lat, item.lon, item.region_id, item.district_id],
          });
          await tx.execute({
            sql: "INSERT INTO listing_sources (listing_id, source, source_id, url, first_seen_at, last_seen_at, removed_at) VALUES (?, 'sreality', ?, ?, ?, ?, NULL) ON CONFLICT(source, source_id) DO UPDATE SET last_seen_at = excluded.last_seen_at, removed_at = NULL",
            args: [item.id, item.id, item.url, now, now],
          });
          events.newListings.push(item);
          newCount++;
        } else {
          const changes: [string, string | null, string | null][] = [];
          if (existingRow.title !== item.title) changes.push(["title", existingRow.title, item.title]);
          if (existingRow.url !== item.url) changes.push(["url", existingRow.url, item.url]);
          if (existingRow.location !== item.location) changes.push(["location", existingRow.location, item.location]);
          if (existingRow.area_m2 !== item.area_m2) changes.push(["area_m2", String(existingRow.area_m2), String(item.area_m2)]);

          if (existingRow.removed_at) {
            await tx.execute({
              sql: "INSERT INTO listing_changes (listing_id, field, old_value, new_value, detected_at) VALUES (?, ?, ?, ?, ?)",
              args: [item.id, "returned", existingRow.removed_at, null, now],
            });
            events.returnedListings.push(item);
            returnedCount++;
          }

          for (const [field, oldVal, newVal] of changes) {
            await tx.execute({
              sql: "INSERT INTO listing_changes (listing_id, field, old_value, new_value, detected_at) VALUES (?, ?, ?, ?, ?)",
              args: [item.id, field, oldVal, newVal, now],
            });
            changeCount++;
          }

          await tx.execute({
            sql: "UPDATE listings SET title = ?, url = ?, location = ?, area_m2 = ?, price = ?, last_seen_at = ?, removed_at = NULL, lat = ?, lon = ?, region_id = ?, district_id = ? WHERE id = ?",
            args: [item.title, item.url, item.location, item.area_m2, item.price, now, item.lat, item.lon, item.region_id, item.district_id, item.id],
          });
          await tx.execute({
            sql: "INSERT INTO listing_sources (listing_id, source, source_id, url, first_seen_at, last_seen_at, removed_at) VALUES (?, 'sreality', ?, ?, ?, ?, NULL) ON CONFLICT(source, source_id) DO UPDATE SET last_seen_at = excluded.last_seen_at, removed_at = NULL",
            args: [item.id, item.id, item.url, now, now],
          });
          updatedCount++;
        }

        await tx.execute({
          sql: "INSERT INTO price_history (listing_id, price, recorded_at) VALUES (?, ?, ?)",
          args: [item.id, item.price, now],
        });

        if (existingRow && existingRow.price > item.price) {
          const dropPct = Math.round(((existingRow.price - item.price) / existingRow.price) * 10000) / 100;
          await tx.execute({
            sql: "INSERT INTO price_drops (listing_id, old_price, new_price, drop_pct, detected_at, title, url, location, category, area_m2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            args: [item.id, existingRow.price, item.price, dropPct, now, item.title, item.url, item.location, item.category, item.area_m2],
          });
          events.priceDrops.push({ listing: item, oldPrice: existingRow.price, newPrice: item.price, dropPct });
          dropCount++;
          console.log(`  DROP: ${item.title} ${existingRow.price} → ${item.price} (-${dropPct.toFixed(1)}%)`);
        }
      }

      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  // Mark listings not seen in this run as removed
  const removedResult = await client.execute({
    sql: "UPDATE listings SET removed_at = ? WHERE last_seen_at IS NOT NULL AND last_seen_at != ? AND removed_at IS NULL",
    args: [now, now],
  });
  const removedCount = removedResult.rowsAffected;

  // Run watchdog checks
  const watchdogMatches = await runWatchdog(client, events);

  console.log(`Done: ${newCount} new, ${updatedCount} updated, ${dropCount} drops, ${changeCount} field changes, ${removedCount} removed, ${returnedCount} returned, ${watchdogMatches} watchdog matches`);
}

/**
 * Fast scan: only new + repriced listings, no delisting logic.
 */
export async function runFastScan() {
  const client = getClient();

  const activeIds = (await client.execute("SELECT id FROM listings WHERE removed_at IS NULL")).rows;
  const knownIds = new Set(activeIds.map(r => r.id as string));

  const regionEnv = process.env.SCRAPE_REGIONS;
  const regionIds = regionEnv
    ? regionEnv.split(",").map(s => parseInt(s.trim(), 10))
    : undefined;

  const scraped = await scrapeLatestListings(knownIds, regionIds);
  if (scraped.length === 0) return;

  const now = new Date().toISOString();

  let newCount = 0;
  let updatedCount = 0;
  let dropCount = 0;
  let returnedCount = 0;

  const events: ScrapeEvents = {
    newListings: [],
    priceDrops: [],
    returnedListings: [],
  };

  interface ExistingRow { price: number; removed_at: string | null }

  const tx = await client.transaction("write");
  try {
    for (const item of scraped) {
      const existingRow = (await tx.execute({
        sql: "SELECT price, removed_at FROM listings WHERE id = ?",
        args: [item.id],
      })).rows[0] as unknown as ExistingRow | undefined;

      if (!existingRow) {
        await tx.execute({
          sql: "INSERT INTO listings (id, title, url, location, area_m2, category, price, first_seen_at, last_seen_at, lat, lon, region_id, district_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          args: [item.id, item.title, item.url, item.location, item.area_m2, item.category, item.price, now, now, item.lat, item.lon, item.region_id, item.district_id],
        });
        await tx.execute({
          sql: "INSERT INTO listing_sources (listing_id, source, source_id, url, first_seen_at, last_seen_at, removed_at) VALUES (?, 'sreality', ?, ?, ?, ?, NULL) ON CONFLICT(source, source_id) DO UPDATE SET last_seen_at = excluded.last_seen_at, removed_at = NULL",
          args: [item.id, item.id, item.url, now, now],
        });
        await tx.execute({
          sql: "INSERT INTO price_history (listing_id, price, recorded_at) VALUES (?, ?, ?)",
          args: [item.id, item.price, now],
        });
        events.newListings.push(item);
        newCount++;
      } else {
        if (existingRow.removed_at) {
          events.returnedListings.push(item);
          returnedCount++;
        }

        await tx.execute({
          sql: "UPDATE listings SET title = ?, url = ?, location = ?, area_m2 = ?, price = ?, last_seen_at = ?, removed_at = NULL, lat = ?, lon = ?, region_id = ?, district_id = ? WHERE id = ?",
          args: [item.title, item.url, item.location, item.area_m2, item.price, now, item.lat, item.lon, item.region_id, item.district_id, item.id],
        });
        await tx.execute({
          sql: "INSERT INTO listing_sources (listing_id, source, source_id, url, first_seen_at, last_seen_at, removed_at) VALUES (?, 'sreality', ?, ?, ?, ?, NULL) ON CONFLICT(source, source_id) DO UPDATE SET last_seen_at = excluded.last_seen_at, removed_at = NULL",
          args: [item.id, item.id, item.url, now, now],
        });
        await tx.execute({
          sql: "INSERT INTO price_history (listing_id, price, recorded_at) VALUES (?, ?, ?)",
          args: [item.id, item.price, now],
        });

        if (existingRow.price > item.price) {
          const dropPct = Math.round(((existingRow.price - item.price) / existingRow.price) * 10000) / 100;
          await tx.execute({
            sql: "INSERT INTO price_drops (listing_id, old_price, new_price, drop_pct, detected_at, title, url, location, category, area_m2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            args: [item.id, existingRow.price, item.price, dropPct, now, item.title, item.url, item.location, item.category, item.area_m2],
          });
          events.priceDrops.push({ listing: item, oldPrice: existingRow.price, newPrice: item.price, dropPct });
          dropCount++;
          console.log(`  DROP: ${item.title} ${existingRow.price} → ${item.price} (-${dropPct.toFixed(1)}%)`);
        }
        updatedCount++;
      }
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  // Run watchdog checks
  const watchdogMatches = await runWatchdog(client, events);

  if (newCount + dropCount + returnedCount + watchdogMatches > 0) {
    console.log(`Fast scan: ${newCount} new, ${updatedCount} updated, ${dropCount} drops, ${returnedCount} returned, ${watchdogMatches} watchdog matches`);
  }
}

async function findDuplicate(
  client: Client,
  category: string,
  lat: number | null,
  lon: number | null,
  area_m2: number | null,
  price: number,
): Promise<string | null> {
  if (!lat || !lon) return null;
  const result = await client.execute({
    sql: `SELECT id FROM listings
      WHERE category = ?
        AND removed_at IS NULL
        AND lat IS NOT NULL AND lon IS NOT NULL
        AND ABS(lat - ?) < 0.0009
        AND ABS(lon - ?) < 0.0013
        AND (? IS NULL OR ABS(COALESCE(area_m2, 0) - ?) <= 5)
        AND ABS(CAST(price AS REAL) - ?) / MAX(CAST(price AS REAL), 1) < 0.03
      LIMIT 1`,
    args: [category, lat, lon, area_m2, area_m2 ?? 0, price],
  });
  return (result.rows[0]?.id as string) ?? null;
}

export async function runBezrealitkyScan(mode: "fast" | "full"): Promise<void> {
  const client = getClient();

  // Ensure listing_sources table exists
  try {
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS listing_sources (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id   TEXT NOT NULL,
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

  const knownRows = (await client.execute("SELECT source_id FROM listing_sources WHERE source = 'bezrealitky'")).rows;
  const knownSourceIds = new Set<string>(knownRows.map(r => r.source_id as string));

  const scraped =
    mode === "fast"
      ? await scrapeLatestBezrealitky(knownSourceIds)
      : await scrapeAllBezrealitky();

  if (scraped.length === 0) return;

  const now = new Date().toISOString();

  let newCount = 0;
  let matchedCount = 0;
  let updatedCount = 0;

  const tx = await client.transaction("write");
  try {
    for (const item of scraped) {
      const existingSource = (await tx.execute({
        sql: "SELECT listing_id FROM listing_sources WHERE source = 'bezrealitky' AND source_id = ?",
        args: [item.source_id],
      })).rows[0] as { listing_id: string } | undefined;

      if (existingSource) {
        await tx.execute({
          sql: "UPDATE listing_sources SET last_seen_at = ? WHERE source = 'bezrealitky' AND source_id = ?",
          args: [now, item.source_id],
        });
        updatedCount++;
        continue;
      }

      const duplicateId = await findDuplicate(client, item.category, item.lat, item.lon, item.area_m2, item.price);

      if (duplicateId) {
        await tx.execute({
          sql: "INSERT OR IGNORE INTO listing_sources (listing_id, source, source_id, url, first_seen_at, last_seen_at, removed_at) VALUES (?, 'bezrealitky', ?, ?, ?, ?, NULL)",
          args: [duplicateId, item.source_id, item.url, now, now],
        });
        if (item.description || item.image_url) {
          await tx.execute({
            sql: "UPDATE listings SET description = ?, image_url = ? WHERE id = ? AND description IS NULL AND image_url IS NULL",
            args: [item.description, item.image_url, duplicateId],
          });
        }
        matchedCount++;
      } else {
        const newId = `bz_${item.source_id}`;
        try {
          await tx.execute({
            sql: "INSERT INTO listings (id, title, url, location, area_m2, category, price, first_seen_at, last_seen_at, lat, lon, region_id, district_id, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            args: [newId, item.title, item.url, item.location, item.area_m2, item.category, item.price, now, now, item.lat, item.lon, item.region_id, null, item.description, item.image_url],
          });
          await tx.execute({
            sql: "INSERT INTO price_history (listing_id, price, recorded_at) VALUES (?, ?, ?)",
            args: [newId, item.price, now],
          });
          await tx.execute({
            sql: "INSERT OR IGNORE INTO listing_sources (listing_id, source, source_id, url, first_seen_at, last_seen_at, removed_at) VALUES (?, 'bezrealitky', ?, ?, ?, ?, NULL)",
            args: [newId, item.source_id, item.url, now, now],
          });
          newCount++;
        } catch (err) {
          console.error(`  BR: failed to insert listing bz_${item.source_id}:`, err);
        }
      }
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  console.log(`BR ${mode}: ${newCount} new, ${matchedCount} matched, ${updatedCount} updated`);
}

// Run directly
runScrape().catch(console.error);
