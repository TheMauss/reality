import { getClient } from "./turso";
import { Resend } from "resend";

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
  watchdog_name: string;
  notify_email: number;
  notify_telegram: number;
  user_email: string | null;
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
    `SELECT wm.*, l.title, l.url, l.location, l.price, l.area_m2, l.category,
            w.name as watchdog_name, w.notify_email, w.notify_telegram,
            u.email as user_email, u.telegram_id
     FROM watchdog_matches wm
     LEFT JOIN listings l ON l.id = wm.listing_id
     JOIN watchdogs w ON w.id = wm.watchdog_id
     JOIN users u ON u.id = w.user_id
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

  for (const [, wdMatches] of byWatchdog) {
    const first = wdMatches[0];

    let sent = false;
    if (first.notify_email && first.user_email) {
      await sendWatchdogEmail(first.user_email, first.watchdog_name, wdMatches);
      sent = true;
    }
    if (first.notify_telegram && first.telegram_id) {
      const ok = await sendWatchdogTelegram(first.telegram_id, first.watchdog_name, wdMatches);
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

  const matches = (await client.execute({
    sql: `SELECT wm.*, l.title, l.url, l.location, l.price, l.area_m2, l.category,
            w.name as watchdog_name, w.notify_email, w.notify_telegram,
            u.email as user_email, u.telegram_id
       FROM watchdog_matches wm
       LEFT JOIN listings l ON l.id = wm.listing_id
       JOIN watchdogs w ON w.id = wm.watchdog_id
       JOIN users u ON u.id = w.user_id
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

  for (const [, wdMatches] of byWatchdog) {
    const first = wdMatches[0];

    let sent = false;
    if (first.notify_email && first.user_email) {
      await sendWatchdogEmail(
        first.user_email,
        `${first.watchdog_name} — ${frequency === "daily" ? "denní" : "týdenní"} souhrn`,
        wdMatches
      );
      sent = true;
    }
    if (first.notify_telegram && first.telegram_id) {
      const ok = await sendWatchdogTelegram(first.telegram_id, first.watchdog_name, wdMatches);
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
    from: "Cenolov <alerts@cenolov.cz>",
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

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendWatchdogTelegram(chatId: string, watchdogName: string, matches: MatchRow[]): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log(`[TG SKIP] No token, would send ${matches.length} watchdog matches to ${chatId}`);
    return false;
  }

  try {
    const lines = matches.slice(0, 10).map((m) => {
      const detail = m.match_detail ? JSON.parse(m.match_detail) : {};
      const typeEmoji: Record<string, string> = { new: "🆕", drop: "📉", underpriced: "💰", returned: "🔄" };
      const emoji = typeEmoji[m.match_type] || "📋";
      const title = escapeHtml(m.title || "Inzerát");
      const loc = escapeHtml(m.location || "—");
      const priceStr = (m.price || 0).toLocaleString("cs-CZ");
      const priceM2 = m.area_m2 && m.area_m2 > 0 && m.price
        ? `${Math.round(m.price / m.area_m2).toLocaleString("cs-CZ")} Kč/m²`
        : null;
      let info = "";
      if (m.match_type === "drop") {
        info = ` <b>-${detail.drop_pct?.toFixed(1)}%</b>`;
      } else if (m.match_type === "underpriced") {
        info = ` <b>${detail.diff_pct?.toFixed(1)}% pod průměrem</b>`;
      }
      const avgStr = detail.avg_price_m2
        ? ` · ø ${Math.round(detail.avg_price_m2).toLocaleString("cs-CZ")} Kč/m²`
        : "";
      const priceLine = priceM2 ? `${priceStr} Kč (${priceM2}${avgStr})` : `${priceStr} Kč`;
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
    console.log(`Watchdog TG sent to ${chatId}: ${matches.length} matches`);
    await delay(50);
    return true;
  } catch (err) {
    console.error(`[WATCHDOG TG ERROR] chatId=${chatId}`, err);
    return false;
  }
}
