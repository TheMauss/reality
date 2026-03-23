import { createClient, type Client, type InValue } from "@libsql/client";

let client: Client | null = null;

export function getClient(): Client {
  if (client) return client;
  client = createClient({
    url: process.env.TURSO_URL || "file:../../cenovypad.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return client;
}

export type { Client, InValue };
