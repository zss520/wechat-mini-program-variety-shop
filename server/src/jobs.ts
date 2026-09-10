import cron from "node-cron";
import { closeExpiredOrders, expireGroupTeams } from "./orderService";
import { recomputeHeat } from "./analytics";

function safe(name: string, fn: () => Promise<unknown>) {
  return () => {
    Promise.resolve()
      .then(fn)
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(name, e);
      });
  };
}

export function startJobs() {
  cron.schedule("* * * * *", () => {
    safe("closeExpiredOrders", closeExpiredOrders)();
    safe("expireGroupTeams", expireGroupTeams)();
  });
  cron.schedule("20 0 * * *", safe("recomputeHeat", recomputeHeat));
}
