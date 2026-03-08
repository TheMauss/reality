import "dotenv/config";
import Database from "better-sqlite3";
import path from "path";
import { scrapeAllListings } from "./sreality";

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
      first_seen_at TEXT NOT NULL
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
  `);

  console.log("Starting scrape...");
  const scraped = await scrapeAllListings();
  const now = new Date().toISOString();

  const findListing = db.prepare("SELECT * FROM listings WHERE id = ?");
  const insertListing = db.prepare(
    "INSERT INTO listings (id, title, url, location, area_m2, category, price, first_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const updateListing = db.prepare(
    "UPDATE listings SET title = ?, location = ?, area_m2 = ?, price = ? WHERE id = ?"
  );
  const insertHistory = db.prepare(
    "INSERT INTO price_history (listing_id, price, recorded_at) VALUES (?, ?, ?)"
  );
  const insertDrop = db.prepare(
    "INSERT INTO price_drops (listing_id, old_price, new_price, drop_pct, detected_at, title, url, location, category, area_m2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  let newCount = 0;
  let updatedCount = 0;
  let dropCount = 0;

  const processAll = db.transaction(() => {
    for (const item of scraped) {
      const existing = findListing.get(item.id) as { price: number } | undefined;

      if (!existing) {
        insertListing.run(item.id, item.title, item.url, item.location, item.area_m2, item.category, item.price, now);
        newCount++;
      } else {
        updateListing.run(item.title, item.location, item.area_m2, item.price, item.id);
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

  console.log(`Done: ${newCount} new, ${updatedCount} updated, ${dropCount} drops detected`);
  db.close();
}

// Run directly
runScrape().catch(console.error);
