import "dotenv/config";
import Database from "better-sqlite3";
import path from "path";
import { scrapeAllListings, DistrictInfo } from "./sreality";

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
      lat REAL,
      lon REAL,
      region_id INTEGER,
      district_id INTEGER
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

    CREATE TABLE IF NOT EXISTS listing_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      detected_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lc_listing ON listing_changes(listing_id, detected_at);
  `);

  // Migrations for existing DBs
  const addColumn = (col: string, type: string) => {
    try { db.exec(`ALTER TABLE listings ADD COLUMN ${col} ${type}`); } catch { /* exists */ }
  };
  addColumn("lat", "REAL");
  addColumn("lon", "REAL");
  addColumn("region_id", "INTEGER");
  addColumn("district_id", "INTEGER");

  // Create indexes for new columns
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region_id)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_listings_district ON listings(district_id)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_listings_location ON listings(location)"); } catch { /* */ }

  console.log("Starting scrape...");

  // Parse region filter from env if provided
  const regionEnv = process.env.SCRAPE_REGIONS;
  const regionIds = regionEnv
    ? regionEnv.split(",").map((s) => parseInt(s.trim(), 10))
    : undefined;

  // Load districts from sold_districts table for per-district scraping
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

  const findListing = db.prepare("SELECT * FROM listings WHERE id = ?");
  const insertListing = db.prepare(
    "INSERT INTO listings (id, title, url, location, area_m2, category, price, first_seen_at, lat, lon, region_id, district_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const updateListing = db.prepare(
    "UPDATE listings SET title = ?, url = ?, location = ?, area_m2 = ?, price = ?, lat = ?, lon = ?, region_id = ?, district_id = ? WHERE id = ?"
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

  let newCount = 0;
  let updatedCount = 0;
  let dropCount = 0;
  let changeCount = 0;

  interface ExistingListing {
    price: number;
    title: string;
    url: string;
    location: string;
    area_m2: number | null;
  }

  const processAll = db.transaction(() => {
    for (const item of scraped) {
      const existing = findListing.get(item.id) as ExistingListing | undefined;

      if (!existing) {
        insertListing.run(item.id, item.title, item.url, item.location, item.area_m2, item.category, item.price, now, item.lat, item.lon, item.region_id, item.district_id);
        newCount++;
      } else {
        // Track field-level changes
        const changes: [string, string | null, string | null][] = [];
        if (existing.title !== item.title) changes.push(["title", existing.title, item.title]);
        if (existing.url !== item.url) changes.push(["url", existing.url, item.url]);
        if (existing.location !== item.location) changes.push(["location", existing.location, item.location]);
        if (existing.area_m2 !== item.area_m2) changes.push(["area_m2", String(existing.area_m2), String(item.area_m2)]);

        for (const [field, oldVal, newVal] of changes) {
          insertChange.run(item.id, field, oldVal, newVal, now);
          changeCount++;
        }

        updateListing.run(item.title, item.url, item.location, item.area_m2, item.price, item.lat, item.lon, item.region_id, item.district_id, item.id);
        updatedCount++;
      }

      insertHistory.run(item.id, item.price, now);

      if (existing && existing.price > item.price) {
        const dropPct = Math.round(((existing.price - item.price) / existing.price) * 10000) / 100;
        insertDrop.run(item.id, existing.price, item.price, dropPct, now, item.title, item.url, item.location, item.category, item.area_m2);
        dropCount++;
        console.log(`  DROP: ${item.title} ${existing.price} → ${item.price} (-${dropPct.toFixed(1)}%)`);
      }
    }
  });

  processAll();

  console.log(`Done: ${newCount} new, ${updatedCount} updated, ${dropCount} drops, ${changeCount} field changes`);
  db.close();
}

// Run directly
runScrape().catch(console.error);
