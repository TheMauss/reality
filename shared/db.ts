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

    CREATE TABLE IF NOT EXISTS watchdogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
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
      watchdog_id INTEGER NOT NULL REFERENCES watchdogs(id),
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
}

export function closeDB() {
  if (db) db.close();
}
