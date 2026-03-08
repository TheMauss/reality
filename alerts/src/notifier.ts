import Database from "better-sqlite3";
import path from "path";
import { sendDropEmail } from "./email";

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, "..", "..", "cenovypad.db");

interface AlertConfigRow {
  user_id: string;
  filters: string;
}

interface UserRow {
  email: string;
  telegram_id: string | null;
}

interface DropRow {
  listing_id: string;
  old_price: number;
  new_price: number;
  drop_pct: number;
  detected_at: string;
  title: string;
  url: string;
  location: string;
  category: string;
}

export async function processAlerts() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const recentDrops = db
    .prepare("SELECT * FROM price_drops WHERE detected_at >= ?")
    .all(threeHoursAgo) as DropRow[];

  if (recentDrops.length === 0) {
    console.log("No recent drops to alert on");
    db.close();
    return;
  }

  const alertConfigs = db.prepare("SELECT * FROM alert_configs").all() as AlertConfigRow[];

  for (const config of alertConfigs) {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(config.user_id) as UserRow | undefined;
    if (!user) continue;

    const filters = JSON.parse(config.filters);
    let matchingDrops = recentDrops;

    if (filters.location) {
      matchingDrops = matchingDrops.filter((d) =>
        d.location?.toLowerCase().includes(filters.location.toLowerCase())
      );
    }
    if (filters.category) {
      matchingDrops = matchingDrops.filter((d) => d.category === filters.category);
    }
    if (filters.min_drop_pct) {
      matchingDrops = matchingDrops.filter((d) => d.drop_pct >= filters.min_drop_pct);
    }

    if (matchingDrops.length === 0) continue;

    const dropAlerts = matchingDrops.map((d) => ({
      title: d.title,
      url: d.url,
      location: d.location,
      old_price: d.old_price,
      new_price: d.new_price,
      drop_pct: d.drop_pct,
    }));

    await sendDropEmail(user.email, dropAlerts);

    if (user.telegram_id) {
      console.log(`[TELEGRAM] Would send ${matchingDrops.length} drops to ${user.telegram_id}`);
    }
  }

  console.log(`Processed ${alertConfigs.length} alert configs, ${recentDrops.length} recent drops`);
  db.close();
}
