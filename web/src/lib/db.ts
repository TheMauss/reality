import Database from "better-sqlite3";
import path from "path";

const DB_PATH =
  process.env.SQLITE_PATH ||
  path.join(process.cwd(), "..", "cenovypad.db");

let db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH, { readonly: true });
  db.pragma("journal_mode = WAL");
  return db;
}
