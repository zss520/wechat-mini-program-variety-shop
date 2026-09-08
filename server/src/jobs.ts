import cron from "node-cron";
import { closeExpiredOrders, expireGroupTeams } from "./orderService";
import { recomputeHeat } from "./analytics";

export function startJobs() {
  cron.schedule("* * * * *", () => {
    closeExpiredOrders().catch((e) => console.error("closeExpiredOrders", e));
    expireGroupTeams().catch((e) => console.error("expireGroupTeams", e));
  });
  cron.schedule("20 0 * * *", () => {
    recomputeHeat().catch((e) => console.error("recomputeHeat", e));
  });
}
