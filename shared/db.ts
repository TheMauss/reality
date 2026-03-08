import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, "..", "cenovypad.db");

let db: Database.Database;

export function getDB(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
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
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (listing_id) REFERENCES listings(id)
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
      area_m2 REAL,
      FOREIGN KEY (listing_id) REFERENCES listings(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      telegram_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      filters TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_ph_listing ON price_history(listing_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_pd_detected ON price_drops(detected_at);
    CREATE INDEX IF NOT EXISTS idx_pd_listing ON price_drops(listing_id);
    CREATE INDEX IF NOT EXISTS idx_ac_user ON alert_configs(user_id);
  `);
}

export function closeDB() {
  if (db) db.close();
}
