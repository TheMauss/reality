import "dotenv/config";
import cron from "node-cron";
import { runScrape } from "./scrape";

const INTERVAL = process.env.SCRAPE_INTERVAL_MINUTES || "120";

console.log(`CenovýPád Scraper starting...`);
console.log(`Scrape interval: every ${INTERVAL} minutes`);

// Run immediately on start
runScrape()
  .then(() => console.log("Initial scrape complete"))
  .catch((err) => console.error("Initial scrape failed:", err));

// Schedule via cron (every N minutes)
const cronExpr = `*/${INTERVAL} * * * *`;
cron.schedule(cronExpr, () => {
  console.log(`\n[${new Date().toISOString()}] Scheduled scrape starting...`);
  runScrape().catch((err) => console.error("Scheduled scrape failed:", err));
});

console.log(`Cron scheduled: ${cronExpr}`);
