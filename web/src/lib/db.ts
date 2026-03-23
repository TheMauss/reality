import { createClient, type Client, type InValue } from "@libsql/client";

let client: Client | null = null;

function getClient(): Client {
  if (client) return client;
  client = createClient({
    url: process.env.TURSO_URL || "file:../cenovypad.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return client;
}

/**
 * Compatibility wrapper that mimics better-sqlite3 API but uses @libsql/client.
 * All methods return Promises (must use await).
 */
export function getDB() {
  const c = getClient();
  return {
    prepare: (sql: string) => ({
      get: async (...args: InValue[]) => {
        const result = await c.execute({ sql, args });
        return result.rows[0] ?? undefined;
      },
      all: async (...args: InValue[]) => {
        const result = await c.execute({ sql, args });
        return result.rows;
      },
      run: async (...args: InValue[]) => {
        const result = await c.execute({ sql, args });
        return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid };
      },
    }),
    execute: async (sql: string, args?: InValue[]) => {
      return c.execute({ sql, args: args || [] });
    },
    exec: async (sql: string) => {
      await c.executeMultiple(sql);
    },
    batch: async (stmts: { sql: string; args: InValue[] }[]) => {
      return c.batch(stmts, "write");
    },
    client: c,
  };
}
