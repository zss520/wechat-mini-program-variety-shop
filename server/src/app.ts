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
import { db } from "./db";
import { markPaid } from "./orderService";

export function createApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(config.uploadDir));
  app.use("/static", express.static(config.staticDir));
  app.use("/privacy", (_req, res) => {
    res.type("html").send(`<!doctype html><meta charset="utf-8"><title>隐私政策</title>
<h1>社区杂货铺隐私政策</h1>
<p>我们仅收集提供购物服务所必需的信息（微信标识、手机号、收货地址、订单）。浏览与点击等行为数据用于改进商品展示与经营分析，不含手机号与 openid。</p>`);
  });
  app.get("/api/health", (_req, res) => res.json({ code: 0, message: "ok", data: { ok: true } }));
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
