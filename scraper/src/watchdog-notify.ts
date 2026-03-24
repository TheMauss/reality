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
  area_m2: number | null;
  watchdog_name: string;
  notify_email: number;
  notify_telegram: number;
  user_email: string | null;
  telegram_id: string | null;
}

export async function sendInstantNotifications(): Promise<number> {
  const client = getClient();

  const result = await client.execute(
    `SELECT wm.*, l.title, l.url, l.location, l.price, l.area_m2,
            w.name as watchdog_name, w.notify_email, w.notify_telegram,
            u.email as user_email, u.telegram_id
     FROM watchdog_matches wm
     LEFT JOIN listings l ON l.id = wm.listing_id
     JOIN watchdogs w ON w.id = wm.watchdog_id
     JOIN users u ON u.id = w.user_id
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

  for (const [, wdMatches] of byWatchdog) {
    const first = wdMatches[0];

    let sent = false;
    if (first.notify_email && first.user_email) {
      console.log(`[WATCHDOG EMAIL] Would send ${wdMatches.length} matches for "${first.watchdog_name}" to ${first.user_email}`);
      sent = true;
    }
    if (first.notify_telegram && first.telegram_id) {
      const ok = await sendTelegramNotification(first.telegram_id, first.watchdog_name, wdMatches);
      if (ok) sent = true;
    }

    if (sent) {
      const ids = wdMatches.map((m) => m.id);
      await client.execute({
        sql: `UPDATE watchdog_matches SET notified = 1 WHERE id IN (${ids.map(() => "?").join(",")})`,
        args: ids,
      });
      sentCount += wdMatches.length;
    }
  }

  return sentCount;
}

export async function sendDigestNotifications(frequency: "daily" | "weekly"): Promise<number> {
  const client = getClient();

  const hoursAgo = frequency === "daily" ? 24 : 168;
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

  const result = await client.execute({
    sql: `SELECT wm.*, l.title, l.url, l.location, l.price, l.area_m2,
            w.name as watchdog_name, w.notify_email, w.notify_telegram,
            u.email as user_email, u.telegram_id
       FROM watchdog_matches wm
       LEFT JOIN listings l ON l.id = wm.listing_id
       JOIN watchdogs w ON w.id = wm.watchdog_id
       JOIN users u ON u.id = w.user_id
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

  for (const [, wdMatches] of byWatchdog) {
    const first = wdMatches[0];

    let sent = false;
    if (first.notify_telegram && first.telegram_id) {
      const ok = await sendTelegramNotification(first.telegram_id, first.watchdog_name, wdMatches);
      if (ok) sent = true;
    }

    if (sent) {
      const ids = wdMatches.map((m) => m.id);
      await client.execute({
        sql: `UPDATE watchdog_matches SET notified = 1 WHERE id IN (${ids.map(() => "?").join(",")})`,
        args: ids,
      });
      sentCount += wdMatches.length;
    }
  }

  return sentCount;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegramNotification(chatId: string, watchdogName: string, matches: MatchRow[]): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const lines = matches.slice(0, 10).map((m) => {
      const detail = m.match_detail ? JSON.parse(m.match_detail) : {};
      const typeEmoji: Record<string, string> = { new: "🆕", drop: "📉", underpriced: "💰", returned: "🔄" };
      const emoji = typeEmoji[m.match_type] || "📋";
      const title = escapeHtml(m.title || "Inzerát");
      const loc = escapeHtml(m.location || "—");
      const priceStr = (m.price || 0).toLocaleString("cs-CZ");
      const priceM2 = m.price && m.area_m2 && m.area_m2 > 0
        ? `${Math.round(m.price / m.area_m2).toLocaleString("cs-CZ")} Kč/m²`
        : null;
      let info = "";
      if (m.match_type === "drop") {
        info = ` <b>-${detail.drop_pct?.toFixed(1)}%</b>`;
      } else if (m.match_type === "underpriced") {
        info = ` <b>${detail.diff_pct?.toFixed(1)}% pod průměrem</b>`;
        if (detail.avg_price_m2) {
          info += `\n   📊 Průměr: ${Math.round(detail.avg_price_m2).toLocaleString("cs-CZ")} Kč/m² vs ${Math.round(detail.listing_price_m2).toLocaleString("cs-CZ")} Kč/m²`;
        }
      }
      const priceLine = priceM2 ? `${priceStr} Kč (${priceM2})` : `${priceStr} Kč`;
      const link = m.url ? `\n   🔗 <a href="${m.url}">Detail</a>` : "";
      return `${emoji} ${title}${info}\n   📍 ${loc} | ${priceLine}${link}`;
    });

    const extra = matches.length > 10 ? `\n\n...a dalších ${matches.length - 10}` : "";
    const text = `🐕 <b>${escapeHtml(watchdogName)}</b>\n\n${lines.join("\n\n")}${extra}`;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      console.error(`[WATCHDOG TG ERROR] HTTP ${res.status}: ${await res.text()}`);
      return false;
    }
    await delay(50); // Rate limit: ~20 msg/sec max
    return true;
  } catch (err) {
    console.error(`[WATCHDOG TG ERROR]`, err);
    return false;
  }
}
