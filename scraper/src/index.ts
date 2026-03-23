import "dotenv/config";
import cron from "node-cron";
import { runScrape, runFastScan, runBezrealitkyScan } from "./scrape";
import { runSoldScrape } from "./scrape-sold";
import { sendInstantNotifications, sendDigestNotifications } from "./watchdog-notify";
import { startBot } from "./bot";

const FULL_SCAN_INTERVAL = parseInt(process.env.SCRAPE_INTERVAL_MINUTES || "120", 10);

console.log(`Bytolov Scraper starting...`);
startBot();
console.log(`Fast scan:  every 1 minute (new listings + price changes)`);
console.log(`Full scan:  every ${FULL_SCAN_INTERVAL} minutes (delistings + full price sweep)`);
console.log(`Sold scan:  daily at 03:00`);

// Build a valid cron expression for intervals that may exceed 59 minutes.
function buildCronExpr(intervalMinutes: number): string {
  if (intervalMinutes <= 59) return `*/${intervalMinutes} * * * *`;
  const hours = Math.round(intervalMinutes / 60);
  return `0 */${hours} * * *`;
}

// Guard against overlapping runs — SQLite WAL handles concurrent reads fine,
// but concurrent writes from two full scans would cause lock contention.
let fullScanRunning = false;
let fastScanRunning = false;

// ── Initial startup: full sold → full listings → full bezrealitky ─────────────
runSoldScrape()
  .then(() => {
    console.log("Initial sold prices scrape complete");
    return runScrape();
  })
  .then(() => {
    console.log("Initial full scan complete");
    return runBezrealitkyScan("full");
  })
  .then(() => console.log("Initial Bezrealitky full scan complete"))
  .catch(err => console.error("Initial scrape failed:", err));

// ── Fast scan: every minute ───────────────────────────────────────────────────
cron.schedule("* * * * *", async () => {
  if (fastScanRunning || fullScanRunning) return; // skip if busy
  fastScanRunning = true;
  try {
    await runFastScan();
    await runBezrealitkyScan("fast");
    // Send instant watchdog notifications after each scan
    await sendInstantNotifications().catch(err =>
      console.error(`[${new Date().toISOString()}] Watchdog instant notify failed:`, err)
    );
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Fast scan failed:`, err);
  } finally {
    fastScanRunning = false;
  }
});

// ── Full scan: every N hours (delistings + complete price sweep) ──────────────
const fullCronExpr = buildCronExpr(FULL_SCAN_INTERVAL);
cron.schedule(fullCronExpr, async () => {
  if (fullScanRunning) return;
  fullScanRunning = true;
  fastScanRunning = true; // also block fast scan during full scan
  console.log(`\n[${new Date().toISOString()}] Full scan starting...`);
  try {
    await runScrape();
    await runBezrealitkyScan("full");
    await sendInstantNotifications().catch(err =>
      console.error(`[${new Date().toISOString()}] Watchdog instant notify failed:`, err)
    );
    console.log(`[${new Date().toISOString()}] Full scan complete`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Full scan failed:`, err);
  } finally {
    fullScanRunning = false;
    fastScanRunning = false;
  }
});

// ── Sold prices: daily at 03:00 ───────────────────────────────────────────────
cron.schedule("0 3 * * *", async () => {
  console.log(`\n[${new Date().toISOString()}] Daily sold prices scrape...`);
  try {
    await runSoldScrape();
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Sold prices scrape failed:`, err);
  }
});

// ── Watchdog daily digest: every day at 08:00 ────────────────────────────────
cron.schedule("0 8 * * *", async () => {
  console.log(`\n[${new Date().toISOString()}] Watchdog daily digest...`);
  try {
    const sent = await sendDigestNotifications("daily");
    if (sent > 0) console.log(`Watchdog daily digest: ${sent} notifications sent`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Watchdog daily digest failed:`, err);
  }
});

// ── Watchdog weekly digest: every Monday at 08:00 ────────────────────────────
cron.schedule("0 8 * * 1", async () => {
  console.log(`\n[${new Date().toISOString()}] Watchdog weekly digest...`);
  try {
    const sent = await sendDigestNotifications("weekly");
    if (sent > 0) console.log(`Watchdog weekly digest: ${sent} notifications sent`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Watchdog weekly digest failed:`, err);
  }
});

console.log(`Full scan cron: ${fullCronExpr} (every ${FULL_SCAN_INTERVAL} min)`);
