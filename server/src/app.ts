import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";
import { adminRouter } from "./adminRoutes";
import { appRouter } from "./appRoutes";
import { errorHandler } from "./auth";
import { fail, HttpError } from "./http";
import { config } from "./config";
import { db, pingDb } from "./db";
import { buildLegalDoc, renderLegalHtml } from "./legal";
import { markPaid } from "./orderService";
import { getSettings } from "./settings";

export function createApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(config.uploadDir));
  app.use("/static", express.static(config.staticDir));
  app.get("/privacy", async (_req, res) => {
    try {
      res.type("html").send(renderLegalHtml(buildLegalDoc(await getSettings())));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[privacy]", e);
      res.type("html").send(renderLegalHtml(buildLegalDoc({ shop_name: "本店" })));
    }
  });
  app.get("/api/health", async (_req, res) => {
    try {
      await pingDb();
      res.json({ code: 0, message: "ok", data: { ok: true, db: true } });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[health] db ping failed", e);
      res.status(503).json({ code: 1, message: "db unavailable", data: { ok: false, db: false } });
    }
  });
  app.post("/api/pay/wechat/notify", async (req, res) => {
    try {
      const no = req.body?.out_trade_no || req.body?.order_no;
      if (!no) return res.status(400).json({ code: "FAIL", message: "missing order_no" });
      const order = await db("orders").where({ order_no: String(no) }).first();
      if (!order) return res.status(404).json({ code: "FAIL", message: "order not found" });
      await markPaid(order.id, String(req.body?.transaction_id || `notify_${Date.now()}`), req.body);
      res.json({ code: "SUCCESS", message: "成功" });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      res.status(500).json({ code: "FAIL", message: "error" });
    }
  });
  app.use("/api/admin", adminRouter);
  app.use("/api/app", appRouter);
  app.use((req, res) => fail(res, 404, "Not Found"));
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof ZodError) {
      return fail(res, 400, err.issues[0]?.message || "参数错误");
    }
    if (err instanceof HttpError) return errorHandler(err, req, res, next);
    return errorHandler(err, req, res, next);
  });
  return app;
}
