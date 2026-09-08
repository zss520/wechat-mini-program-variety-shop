import { createApp } from "./app";
import { config } from "./config";
import { startJobs } from "./jobs";
import fs from "fs";

fs.mkdirSync(config.uploadDir, { recursive: true });

const app = createApp();
app.listen(config.port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`variety-shop API listening on ${config.port}`);
  startJobs();
});
