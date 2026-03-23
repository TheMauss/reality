import TelegramBot from "node-telegram-bot-api";
import { getClient } from "./turso";

export function startBot(): void {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) {
    console.log("TELEGRAM_BOT_TOKEN not set, skipping Telegram bot");
    return;
  }

  const bot = new TelegramBot(TOKEN, { polling: true });
  const client = getClient();
  console.log("Telegram bot started");

  bot.onText(/\/subscribe (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const email = match?.[1]?.trim();
    if (!email) { bot.sendMessage(chatId, "Použití: /subscribe vas@email.cz"); return; }

    const existing = (await client.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] })).rows[0];
    if (existing) {
      await client.execute({ sql: "UPDATE users SET telegram_id = ? WHERE email = ?", args: [chatId.toString(), email] });
    } else {
      await client.execute({ sql: "INSERT INTO users (email, plan, telegram_id, created_at) VALUES (?, 'free', ?, ?)", args: [email, chatId.toString(), new Date().toISOString()] });
    }
    bot.sendMessage(chatId, `Přihlášeno! Budete dostávat upozornění na cenové pády na email ${email}.\n\nPro odhlášení: /unsubscribe`);
  });

  bot.onText(/\/unsubscribe/, async (msg) => {
    const chatId = msg.chat.id;
    await client.execute({ sql: "UPDATE users SET telegram_id = NULL WHERE telegram_id = ?", args: [chatId.toString()] });
    bot.sendMessage(chatId, "Odhlášeno z Telegram notifikací.");
  });

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
      `Vítejte v CenovýPád botu!\n\n` +
      `Vaše Chat ID: \`${chatId}\`\n\n` +
      `Zkopírujte toto číslo do nastavení na webu (Hlídací pes → Telegram Chat ID) pro zapnutí notifikací.\n\n` +
      `/status – počty inzerátů\n` +
      `/watchdog list – seznam hlídacích psů`,
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const totalListings = ((await client.execute("SELECT COUNT(*) as count FROM listings")).rows[0] as any).count;
    const totalDrops = ((await client.execute("SELECT COUNT(*) as count FROM price_drops")).rows[0] as any).count;
    bot.sendMessage(chatId, `Sledujeme ${totalListings} inzerátů.\nDetekováno ${totalDrops} cenových pádů.`);
  });

  async function getUserByTelegramId(chatId: number): Promise<{ id: number; email: string } | undefined> {
    const row = (await client.execute({ sql: "SELECT id, email FROM users WHERE telegram_id = ?", args: [chatId.toString()] })).rows[0];
    return row as unknown as { id: number; email: string } | undefined;
  }

  bot.onText(/\/watchdog list/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getUserByTelegramId(chatId);
    if (!user) { bot.sendMessage(chatId, "Nejste přihlášeni. Použijte /subscribe vas@email.cz"); return; }

    const watchdogs = (await client.execute({ sql: "SELECT id, name, active, category, location FROM watchdogs WHERE user_id = ? ORDER BY created_at DESC", args: [user.id] })).rows as unknown as { id: number; name: string; active: number; category: string | null; location: string | null }[];
    if (watchdogs.length === 0) { bot.sendMessage(chatId, "Nemáte žádné hlídací psy.\nVytvořte: /watchdog add <název>"); return; }

    const lines = watchdogs.map(w => {
      const status = w.active ? "✅" : "⏸";
      const filters = [w.category, w.location].filter(Boolean).join(", ");
      return `${status} #${w.id} *${w.name}*${filters ? ` (${filters})` : ""}`;
    });
    bot.sendMessage(chatId, `🐕 Vaši hlídací psi:\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
  });

  bot.onText(/\/watchdog add (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const name = match?.[1]?.trim();
    if (!name) { bot.sendMessage(chatId, "Použití: /watchdog add <název>"); return; }
    const user = await getUserByTelegramId(chatId);
    if (!user) { bot.sendMessage(chatId, "Nejste přihlášeni. Použijte /subscribe vas@email.cz"); return; }

    const result = await client.execute({ sql: "INSERT INTO watchdogs (user_id, name, notify_telegram, notify_email) VALUES (?, ?, 1, 1)", args: [user.id, name] });
    bot.sendMessage(chatId, `✅ Hlídací pes *${name}* vytvořen (ID #${result.lastInsertRowid}).\n\nUpravte filtry na webu: /watchdog`, { parse_mode: "Markdown" });
  });

  bot.onText(/\/watchdog pause (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wdId = parseInt(match?.[1] || "0", 10);
    const user = await getUserByTelegramId(chatId);
    if (!user) { bot.sendMessage(chatId, "Nejste přihlášeni."); return; }
    const result = await client.execute({ sql: "UPDATE watchdogs SET active = 0, updated_at = datetime('now') WHERE id = ? AND user_id = ?", args: [wdId, user.id] });
    bot.sendMessage(chatId, result.rowsAffected === 0 ? "Hlídací pes nenalezen." : `⏸ Hlídací pes #${wdId} pozastaven.`);
  });

  bot.onText(/\/watchdog resume (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wdId = parseInt(match?.[1] || "0", 10);
    const user = await getUserByTelegramId(chatId);
    if (!user) { bot.sendMessage(chatId, "Nejste přihlášeni."); return; }
    const result = await client.execute({ sql: "UPDATE watchdogs SET active = 1, updated_at = datetime('now') WHERE id = ? AND user_id = ?", args: [wdId, user.id] });
    bot.sendMessage(chatId, result.rowsAffected === 0 ? "Hlídací pes nenalezen." : `✅ Hlídací pes #${wdId} aktivován.`);
  });

  bot.onText(/\/watchdog delete (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wdId = parseInt(match?.[1] || "0", 10);
    const user = await getUserByTelegramId(chatId);
    if (!user) { bot.sendMessage(chatId, "Nejste přihlášeni."); return; }
    await client.execute({ sql: "DELETE FROM watchdog_matches WHERE watchdog_id = ? AND watchdog_id IN (SELECT id FROM watchdogs WHERE user_id = ?)", args: [wdId, user.id] });
    const result = await client.execute({ sql: "DELETE FROM watchdogs WHERE id = ? AND user_id = ?", args: [wdId, user.id] });
    bot.sendMessage(chatId, result.rowsAffected === 0 ? "Hlídací pes nenalezen." : `🗑 Hlídací pes #${wdId} smazán.`);
  });
}
