import { createApp } from "./app";
import { config } from "./config";
import { startJobs } from "./jobs";
import { backfillMissingThumbs, ensureUploadDirs } from "./image";

ensureUploadDirs();

const app = createApp();
app.listen(config.port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`variety-shop API listening on ${config.port}`);
  startJobs();
  backfillMissingThumbs().catch((e) => {
    // eslint-disable-next-line no-console
    console.error("backfillMissingThumbs failed", e);
  });
});
