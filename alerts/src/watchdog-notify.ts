import { getClient } from "./turso";
import { Resend } from "resend";
import TelegramBot from "node-telegram-bot-api";

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
  category: string | null;
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

const MATCH_TYPE_LABELS: Record<string, string> = {
  new: "Nový inzerát",
  drop: "Cenový pád",
  underpriced: "Pod tržní cenou",
  returned: "Vrácený inzerát",
};

export async function sendInstantNotifications(): Promise<number> {
  const client = getClient();

  const matches = (await client.execute(
    `SELECT wm.*, l.title, l.url, l.location, l.price, l.area_m2, l.category
     FROM watchdog_matches wm
     LEFT JOIN listings l ON l.id = wm.listing_id
     JOIN watchdogs w ON w.id = wm.watchdog_id
     WHERE wm.notified = 0 AND w.notify_frequency = 'instant'
     ORDER BY wm.watchdog_id, wm.created_at DESC`
  )).rows as unknown as MatchRow[];

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
      await sendWatchdogEmail(user.email, wd.name, wdMatches);
    }

    if (wd.notify_telegram && user.telegram_id) {
      await sendWatchdogTelegram(user.telegram_id, wd.name, wdMatches);
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

export async function sendDigestNotifications(frequency: "daily" | "weekly"): Promise<number> {
  const client = getClient();

  const hoursAgo = frequency === "daily" ? 24 : 168;
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

  const matches = (await client.execute({
    sql: `SELECT wm.*, l.title, l.url, l.location, l.price, l.area_m2, l.category
       FROM watchdog_matches wm
       LEFT JOIN listings l ON l.id = wm.listing_id
       JOIN watchdogs w ON w.id = wm.watchdog_id
       WHERE wm.notified = 0 AND w.notify_frequency = ? AND wm.created_at >= ?
       ORDER BY wm.watchdog_id, wm.created_at DESC`,
    args: [frequency, since],
  })).rows as unknown as MatchRow[];

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
      await sendWatchdogEmail(
        user.email,
        `${wd.name} — ${frequency === "daily" ? "denní" : "týdenní"} souhrn`,
        wdMatches
      );
    }

    if (wd.notify_telegram && user.telegram_id) {
      await sendWatchdogTelegram(user.telegram_id, wd.name, wdMatches);
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

async function sendWatchdogEmail(to: string, watchdogName: string, matches: MatchRow[]): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL SKIP] No API key, would send ${matches.length} watchdog matches to ${to}`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const rows = matches
    .map((m) => {
      const detail = m.match_detail ? JSON.parse(m.match_detail) : {};
      let detailHtml = "";
      if (m.match_type === "drop") {
        detailHtml = `<span style="color:#ef4444">-${detail.drop_pct?.toFixed(1)}%</span> (${detail.old_price?.toLocaleString("cs-CZ")} → ${detail.new_price?.toLocaleString("cs-CZ")} Kč)`;
      } else if (m.match_type === "underpriced") {
        detailHtml = `<span style="color:#f59e0b">${detail.diff_pct?.toFixed(1)}% pod průměrem</span> (${detail.listing_price_m2?.toLocaleString("cs-CZ")} vs ${detail.avg_price_m2?.toLocaleString("cs-CZ")} Kč/m²)`;
      } else if (m.match_type === "returned") {
        detailHtml = `<span style="color:#3b82f6">Vrácen zpět</span>`;
      } else {
        detailHtml = `${(m.price || 0).toLocaleString("cs-CZ")} Kč`;
      }

      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #333">${MATCH_TYPE_LABELS[m.match_type] || m.match_type}</td>
        <td style="padding:8px;border-bottom:1px solid #333">${m.title || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #333">${m.location || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #333">${detailHtml}</td>
        <td style="padding:8px;border-bottom:1px solid #333"><a href="${m.url}" style="color:#3b82f6">Detail</a></td>
      </tr>`;
    })
    .join("");

  await resend.emails.send({
    from: "Bytolov <alerts@bytolov.cz>",
    to,
    subject: `Hlídací pes: ${watchdogName} — ${matches.length} nových`,
    html: `
      <div style="background:#000;color:#fff;padding:20px;font-family:sans-serif">
        <h1 style="color:#f59e0b">Hlídací pes: ${watchdogName}</h1>
        <p>${matches.length} nových výsledků:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="color:#999;text-align:left">
              <th style="padding:8px">Typ</th>
              <th style="padding:8px">Nemovitost</th>
              <th style="padding:8px">Lokalita</th>
              <th style="padding:8px">Detail</th>
              <th style="padding:8px"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  });

  console.log(`Watchdog email sent to ${to}: ${matches.length} matches for "${watchdogName}"`);
}

async function sendWatchdogTelegram(chatId: string, watchdogName: string, matches: MatchRow[]): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log(`[TG SKIP] No token, would send ${matches.length} watchdog matches to ${chatId}`);
    return;
  }

  const lines = matches.slice(0, 10).map((m) => {
    const detail = m.match_detail ? JSON.parse(m.match_detail) : {};
    const typeEmoji: Record<string, string> = { new: "🆕", drop: "📉", underpriced: "💰", returned: "🔄" };
    const emoji = typeEmoji[m.match_type] || "📋";
    let info = "";
    if (m.match_type === "drop") info = ` -${detail.drop_pct?.toFixed(1)}%`;
    else if (m.match_type === "underpriced") info = ` ${detail.diff_pct?.toFixed(1)}% pod průměrem`;
    return `${emoji} [${m.title || "Inzerát"}](${m.url})${info}\n   📍 ${m.location || "—"} | ${(m.price || 0).toLocaleString("cs-CZ")} Kč`;
  });

  const extra = matches.length > 10 ? `\n\n...a dalších ${matches.length - 10}` : "";
  const text = `🐕 *${watchdogName}*\n\n${lines.join("\n\n")}${extra}`;

  const bot = new TelegramBot(token);
  await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  console.log(`Watchdog TG sent to ${chatId}: ${matches.length} matches`);
}
