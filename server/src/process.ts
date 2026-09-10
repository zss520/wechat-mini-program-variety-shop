import http from "http";
import type express from "express";

function errCode(err: unknown) {
  return String((err as { code?: string } | null)?.code || "");
}

function errMsg(err: unknown) {
  return String((err as { message?: string } | null)?.message || err || "");
}

/** 连接闪断等可恢复错误：记日志，避免整进程退出。 */
export function isRecoverableRuntimeError(err: unknown) {
  const code = errCode(err);
  const msg = errMsg(err);
  return (
    [
      "PROTOCOL_CONNECTION_LOST",
      "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
      "ECONNRESET",
      "ECONNREFUSED",
      "EPIPE",
      "ETIMEDOUT",
      "EHOSTUNREACH",
    ].includes(code) ||
    /Connection lost/i.test(msg) ||
    /ECONNRESET/i.test(msg) ||
    /read ETIMEDOUT/i.test(msg)
  );
}

let guardsInstalled = false;

export function installProcessGuards() {
  if (guardsInstalled) return;
  guardsInstalled = true;

  process.on("unhandledRejection", (reason) => {
    // eslint-disable-next-line no-console
    console.error("[unhandledRejection]", reason);
    if (!isRecoverableRuntimeError(reason)) {
      setTimeout(() => process.exit(1), 50).unref();
    }
  });

  process.on("uncaughtException", (err) => {
    // eslint-disable-next-line no-console
    console.error("[uncaughtException]", err);
    if (isRecoverableRuntimeError(err)) return;
    setTimeout(() => process.exit(1), 50).unref();
  });
}

export function bindHttpServer(app: express.Express, port: number, onListen?: () => void) {
  const server = http.createServer(app);
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 120000;
  server.on("error", (err: NodeJS.ErrnoException) => {
    // eslint-disable-next-line no-console
    console.error("[http] listen error", err.code || err.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", onListen);
  return server;
}

export function bindGracefulShutdown(server: http.Server, closeResources: () => Promise<void>) {
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    // eslint-disable-next-line no-console
    console.log(`[process] ${signal}, shutting down`);
    server.close(() => {
      closeResources()
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error("[process] resource close failed", e);
        })
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
