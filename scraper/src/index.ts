import "dotenv/config";
import cron from "node-cron";
import { runScrape } from "./scrape";
import { runSoldScrape } from "./scrape-sold";

const INTERVAL = process.env.SCRAPE_INTERVAL_MINUTES || "120";

console.log(`CenovýPád Scraper starting...`);
console.log(`Scrape interval: every ${INTERVAL} minutes`);

// Run listings scrape immediately
runScrape()
  .then(() => console.log("Initial listings scrape complete"))
  .catch((err) => console.error("Initial listings scrape failed:", err));

// Run sold prices scrape (once daily is enough — historical data)
runSoldScrape()
  .then(() => console.log("Initial sold prices scrape complete"))
  .catch((err) => console.error("Initial sold prices scrape failed:", err));

// Schedule listings scrape (every N minutes)
const cronExpr = `*/${INTERVAL} * * * *`;
cron.schedule(cronExpr, () => {
  console.log(`\n[${new Date().toISOString()}] Scheduled listings scrape...`);
  runScrape().catch((err) => console.error("Scheduled scrape failed:", err));
});

// Schedule sold prices scrape (once daily at 3 AM)
cron.schedule("0 3 * * *", () => {
  console.log(`\n[${new Date().toISOString()}] Daily sold prices scrape...`);
  runSoldScrape().catch((err) => console.error("Sold prices scrape failed:", err));
});

console.log(`Listings cron: ${cronExpr}`);
console.log(`Sold prices cron: 0 3 * * * (daily 3 AM)`);
