import { getClient } from "./turso";
import { sendDropEmail } from "./email";

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
  const client = getClient();

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const recentDrops = (await client.execute({
    sql: "SELECT * FROM price_drops WHERE detected_at >= ?",
    args: [threeHoursAgo],
  })).rows as unknown as DropRow[];

  if (recentDrops.length === 0) {
    console.log("No recent drops to alert on");
    return;
  }

  const alertConfigs = (await client.execute("SELECT * FROM alert_configs")).rows as unknown as AlertConfigRow[];

  for (const config of alertConfigs) {
    const user = (await client.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [config.user_id],
    })).rows[0] as unknown as UserRow | undefined;
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
}
