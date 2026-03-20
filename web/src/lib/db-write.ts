import Database from "better-sqlite3";
import path from "path";

const DB_PATH =
  process.env.SQLITE_PATH ||
  path.join(process.cwd(), "..", "cenovypad.db");

let db: Database.Database | null = null;

export function getWriteDB(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
