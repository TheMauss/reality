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
      "/status – stav"
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
