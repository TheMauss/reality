import "dotenv/config";
import { processAlerts } from "./notifier";

console.log("Running alert processor...");
processAlerts()
  .then(() => {
    console.log("Alert processing complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Alert processing failed:", err);
    process.exit(1);
  });
