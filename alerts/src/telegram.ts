import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import Database from "better-sqlite3";
import path from "path";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, "..", "..", "cenovypad.db");

if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN not set");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

console.log("Telegram bot started");

bot.onText(/\/subscribe (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const email = match?.[1]?.trim();

  if (!email) {
    bot.sendMessage(chatId, "Použití: /subscribe vas@email.cz");
    return;
  }

  const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (existing) {
    db.prepare("UPDATE users SET telegram_id = ? WHERE email = ?").run(chatId.toString(), email);
  } else {
    db.prepare("INSERT INTO users (email, plan, telegram_id, created_at) VALUES (?, 'free', ?, ?)").run(
      email,
      chatId.toString(),
      new Date().toISOString()
    );
  }

  bot.sendMessage(
    chatId,
    `Přihlášeno! Budete dostávat upozornění na cenové pády na email ${email}.\n\nPro odhlášení: /unsubscribe`
  );
});

bot.onText(/\/unsubscribe/, (msg) => {
  const chatId = msg.chat.id;
  db.prepare("UPDATE users SET telegram_id = NULL WHERE telegram_id = ?").run(chatId.toString());
  bot.sendMessage(chatId, "Odhlášeno z Telegram notifikací.");
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Vítejte v CenovýPád botu!\n\n" +
      "/subscribe vas@email.cz – přihlásit se k upozorněním\n" +
      "/unsubscribe – odhlásit se\n" +
      "/status – stav\n" +
      "/watchdog list – seznam hlídacích psů\n" +
      "/watchdog add <název> – vytvořit hlídacího psa\n" +
      "/watchdog pause <id> – pozastavit\n" +
      "/watchdog resume <id> – obnovit\n" +
      "/watchdog delete <id> – smazat"
  );
});

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const totalListings = (db.prepare("SELECT COUNT(*) as count FROM listings").get() as { count: number }).count;
  const totalDrops = (db.prepare("SELECT COUNT(*) as count FROM price_drops").get() as { count: number }).count;
  bot.sendMessage(
    chatId,
    `Sledujeme ${totalListings} inzerátů.\nDetekováno ${totalDrops} cenových pádů.`
  );
});

// ── Watchdog commands ────────────────────────────────────────────────────────

interface WatchdogRow {
  id: number;
  name: string;
  active: number;
  category: string | null;
  location: string | null;
}

function getUserByTelegramId(chatId: number): { id: number; email: string } | undefined {
  return db.prepare("SELECT id, email FROM users WHERE telegram_id = ?").get(chatId.toString()) as
    | { id: number; email: string }
    | undefined;
}

bot.onText(/\/watchdog list/, (msg) => {
  const chatId = msg.chat.id;
  const user = getUserByTelegramId(chatId);
  if (!user) {
    bot.sendMessage(chatId, "Nejste přihlášeni. Použijte /subscribe vas@email.cz");
    return;
  }

  const watchdogs = db
    .prepare("SELECT id, name, active, category, location FROM watchdogs WHERE user_id = ? ORDER BY created_at DESC")
    .all(user.id) as WatchdogRow[];

  if (watchdogs.length === 0) {
    bot.sendMessage(chatId, "Nemáte žádné hlídací psy.\nVytvořte: /watchdog add <název>");
    return;
  }

  const lines = watchdogs.map((w) => {
    const status = w.active ? "✅" : "⏸";
    const filters = [w.category, w.location].filter(Boolean).join(", ");
    return `${status} #${w.id} *${w.name}*${filters ? ` (${filters})` : ""}`;
  });

  bot.sendMessage(chatId, `🐕 Vaši hlídací psi:\n\n${lines.join("\n")}`, {
    parse_mode: "Markdown",
  });
});

bot.onText(/\/watchdog add (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const name = match?.[1]?.trim();
  if (!name) {
    bot.sendMessage(chatId, "Použití: /watchdog add <název>");
    return;
  }

  const user = getUserByTelegramId(chatId);
  if (!user) {
    bot.sendMessage(chatId, "Nejste přihlášeni. Použijte /subscribe vas@email.cz");
    return;
  }

  // Ensure watchdogs table exists
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS watchdogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      category TEXT, region_id INTEGER, district_id INTEGER, location TEXT,
      price_min INTEGER, price_max INTEGER, area_min REAL, area_max REAL,
      keywords TEXT,
      watch_new INTEGER NOT NULL DEFAULT 1,
      watch_drops INTEGER NOT NULL DEFAULT 0, watch_drops_min_pct REAL DEFAULT 5,
      watch_underpriced INTEGER NOT NULL DEFAULT 0, watch_underpriced_pct REAL DEFAULT 15,
      watch_returned INTEGER NOT NULL DEFAULT 0,
      notify_email INTEGER NOT NULL DEFAULT 1,
      notify_telegram INTEGER NOT NULL DEFAULT 0,
      notify_frequency TEXT NOT NULL DEFAULT 'instant',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
  } catch { /* exists */ }

  const result = db
    .prepare(
      "INSERT INTO watchdogs (user_id, name, notify_telegram, notify_email) VALUES (?, ?, 1, 1)"
    )
    .run(user.id, name);

  bot.sendMessage(
    chatId,
    `✅ Hlídací pes *${name}* vytvořen (ID #${result.lastInsertRowid}).\n\nSleduje nové byty-prodej s instant notifikacemi.\nUpravte na webu: /watchdog nebo cenovypad.cz/watchdog`,
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/watchdog pause (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const wdId = parseInt(match?.[1] || "0", 10);
  const user = getUserByTelegramId(chatId);
  if (!user) {
    bot.sendMessage(chatId, "Nejste přihlášeni.");
    return;
  }

  const result = db
    .prepare("UPDATE watchdogs SET active = 0, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
    .run(wdId, user.id);

  if (result.changes === 0) {
    bot.sendMessage(chatId, "Hlídací pes nenalezen.");
  } else {
    bot.sendMessage(chatId, `⏸ Hlídací pes #${wdId} pozastaven.`);
  }
});

bot.onText(/\/watchdog resume (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const wdId = parseInt(match?.[1] || "0", 10);
  const user = getUserByTelegramId(chatId);
  if (!user) {
    bot.sendMessage(chatId, "Nejste přihlášeni.");
    return;
  }

  const result = db
    .prepare("UPDATE watchdogs SET active = 1, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
    .run(wdId, user.id);

  if (result.changes === 0) {
    bot.sendMessage(chatId, "Hlídací pes nenalezen.");
  } else {
    bot.sendMessage(chatId, `✅ Hlídací pes #${wdId} aktivován.`);
  }
});

bot.onText(/\/watchdog delete (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const wdId = parseInt(match?.[1] || "0", 10);
  const user = getUserByTelegramId(chatId);
  if (!user) {
    bot.sendMessage(chatId, "Nejste přihlášeni.");
    return;
  }

  db.prepare("DELETE FROM watchdog_matches WHERE watchdog_id = ? AND watchdog_id IN (SELECT id FROM watchdogs WHERE user_id = ?)").run(wdId, user.id);
  const result = db.prepare("DELETE FROM watchdogs WHERE id = ? AND user_id = ?").run(wdId, user.id);

  if (result.changes === 0) {
    bot.sendMessage(chatId, "Hlídací pes nenalezen.");
  } else {
    bot.sendMessage(chatId, `🗑 Hlídací pes #${wdId} smazán.`);
  }
});
