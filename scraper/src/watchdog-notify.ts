import { getClient } from "./turso";

interface MatchRow {
  id: number;
  watchdog_id: number;
  listing_id: string;
  match_type: string;
  match_detail: string | null;
  created_at: string;
  title: string | null;
  url: string | null;
  location: string | null;
  price: number | null;
}

interface WatchdogRow {
  id: number;
  user_id: number;
  name: string;
  notify_email: number;
  notify_telegram: number;
  notify_frequency: string;
}

interface UserRow {
  email: string;
  telegram_id: string | null;
}

export async function sendInstantNotifications(): Promise<number> {
  const client = getClient();

  const result = await client.execute(
    `SELECT wm.*, l.title, l.url, l.location, l.price
     FROM watchdog_matches wm
     LEFT JOIN listings l ON l.id = wm.listing_id
     JOIN watchdogs w ON w.id = wm.watchdog_id
     WHERE wm.notified = 0 AND w.notify_frequency = 'instant'
     ORDER BY wm.watchdog_id, wm.created_at DESC`
  );
  const matches = result.rows as unknown as MatchRow[];

  if (matches.length === 0) return 0;

  const byWatchdog = new Map<number, MatchRow[]>();
  for (const m of matches) {
    const arr = byWatchdog.get(m.watchdog_id) || [];
    arr.push(m);
    byWatchdog.set(m.watchdog_id, arr);
  }

  let sentCount = 0;

  for (const [watchdogId, wdMatches] of byWatchdog) {
    const wd = (await client.execute({
      sql: "SELECT id, user_id, name, notify_email, notify_telegram, notify_frequency FROM watchdogs WHERE id = ?",
      args: [watchdogId],
    })).rows[0] as unknown as WatchdogRow | undefined;
    if (!wd) continue;

    const user = (await client.execute({
      sql: "SELECT email, telegram_id FROM users WHERE id = ?",
      args: [wd.user_id],
    })).rows[0] as unknown as UserRow | undefined;
    if (!user) continue;

    if (wd.notify_email && user.email) {
      console.log(`[WATCHDOG EMAIL] Would send ${wdMatches.length} matches for "${wd.name}" to ${user.email}`);
    }
    if (wd.notify_telegram && user.telegram_id) {
      console.log(`[WATCHDOG TG] Would send ${wdMatches.length} matches for "${wd.name}" to ${user.telegram_id}`);
      await sendTelegramNotification(user.telegram_id, wd.name, wdMatches);
    }

    sentCount += wdMatches.length;
  }

  // Mark all as notified
  if (matches.length > 0) {
    const matchIds = matches.map((m) => m.id);
    await client.execute({
      sql: `UPDATE watchdog_matches SET notified = 1 WHERE id IN (${matchIds.map(() => "?").join(",")})`,
      args: matchIds,
    });
  }

  return sentCount;
}

export async function sendDigestNotifications(frequency: "daily" | "weekly"): Promise<number> {
  const client = getClient();

  const hoursAgo = frequency === "daily" ? 24 : 168;
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

  const result = await client.execute({
    sql: `SELECT wm.*, l.title, l.url, l.location, l.price
       FROM watchdog_matches wm
       LEFT JOIN listings l ON l.id = wm.listing_id
       JOIN watchdogs w ON w.id = wm.watchdog_id
       WHERE wm.notified = 0 AND w.notify_frequency = ? AND wm.created_at >= ?
       ORDER BY wm.watchdog_id, wm.created_at DESC`,
    args: [frequency, since],
  });
  const matches = result.rows as unknown as MatchRow[];

  if (matches.length === 0) return 0;

  const byWatchdog = new Map<number, MatchRow[]>();
  for (const m of matches) {
    const arr = byWatchdog.get(m.watchdog_id) || [];
    arr.push(m);
    byWatchdog.set(m.watchdog_id, arr);
  }

  let sentCount = 0;

  for (const [watchdogId, wdMatches] of byWatchdog) {
    const wd = (await client.execute({
      sql: "SELECT id, user_id, name, notify_email, notify_telegram, notify_frequency FROM watchdogs WHERE id = ?",
      args: [watchdogId],
    })).rows[0] as unknown as WatchdogRow | undefined;
    if (!wd) continue;

    const user = (await client.execute({
      sql: "SELECT email, telegram_id FROM users WHERE id = ?",
      args: [wd.user_id],
    })).rows[0] as unknown as UserRow | undefined;
    if (!user) continue;

    console.log(`[WATCHDOG ${frequency.toUpperCase()}] ${wdMatches.length} matches for "${wd.name}" → ${user.email}`);

    if (wd.notify_telegram && user.telegram_id) {
      await sendTelegramNotification(user.telegram_id, wd.name, wdMatches);
    }

    sentCount += wdMatches.length;
  }

  if (matches.length > 0) {
    const matchIds = matches.map((m) => m.id);
    await client.execute({
      sql: `UPDATE watchdog_matches SET notified = 1 WHERE id IN (${matchIds.map(() => "?").join(",")})`,
      args: matchIds,
    });
  }

  return sentCount;
}

async function sendTelegramNotification(chatId: string, watchdogName: string, matches: MatchRow[]): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    const lines = matches.slice(0, 10).map((m) => {
      const detail = m.match_detail ? JSON.parse(m.match_detail) : {};
      const typeEmoji: Record<string, string> = { new: "🆕", drop: "📉", underpriced: "💰", returned: "🔄" };
      const emoji = typeEmoji[m.match_type] || "📋";
      let info = "";
      if (m.match_type === "drop") info = ` -${detail.drop_pct?.toFixed(1)}%`;
      else if (m.match_type === "underpriced") info = ` ${detail.diff_pct?.toFixed(1)}% pod průměrem`;
      const link = m.url ? `\n   🔗 ${m.url}` : "";
      return `${emoji} ${m.title || "Inzerát"}${info}\n   📍 ${m.location || "—"} | ${(m.price || 0).toLocaleString("cs-CZ")} Kč${link}`;
    });

    const extra = matches.length > 10 ? `\n\n...a dalších ${matches.length - 10}` : "";
    const text = `🐕 *${watchdogName}*\n\n${lines.join("\n\n")}${extra}`;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    if (!res.ok) {
      console.error(`[WATCHDOG TG ERROR] HTTP ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[WATCHDOG TG ERROR]`, err);
  }
}
