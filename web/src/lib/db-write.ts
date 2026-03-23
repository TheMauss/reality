import { getDB } from "./db";

// Write operations now go through the same Turso client
export function getWriteDB() {
  return getDB();
}
