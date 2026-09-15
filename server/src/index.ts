import { createApp } from "./app";
import { config } from "./config";
import { db } from "./db";
import { startJobs } from "./jobs";
import { backfillMissingThumbs, ensureUploadDirs } from "./image";
import { bindGracefulShutdown, bindHttpServer, installProcessGuards } from "./process";

installProcessGuards();
ensureUploadDirs();

db.migrate
  .latest()
  .then(() => {
    const app = createApp();
    const server = bindHttpServer(app, config.port, () => {
      // eslint-disable-next-line no-console
      console.log(`variety-shop API listening on ${config.port}`);
      try {
        startJobs();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("startJobs failed", e);
      }
      backfillMissingThumbs().catch((e) => {
        // eslint-disable-next-line no-console
        console.error("backfillMissingThumbs failed", e);
      });
    });
    bindGracefulShutdown(server, async () => {
      await db.destroy();
    });
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error("migrate failed", e);
    process.exit(1);
  });
