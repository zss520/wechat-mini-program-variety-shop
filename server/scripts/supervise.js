#!/usr/bin/env node
"use strict";

/**
 * 开发态看门狗：子进程异常退出后自动拉起。
 * ts-node-dev 的 --respawn 只在文件变更时重启，进程崩溃后会一直停着。
 */
const { spawn } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
if (!args.length) {
  console.error("usage: node scripts/supervise.js <command> [args...]");
  process.exit(2);
}

const cwd = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";
let delayMs = 800;
const maxDelayMs = 15000;
let child = null;
let stopping = false;
let aliveTimer = null;

function start() {
  if (stopping) return;
  child = spawn(args[0], args.slice(1), {
    cwd,
    stdio: "inherit",
    env: process.env,
    shell: isWin,
  });
  aliveTimer = setTimeout(() => {
    delayMs = 800;
  }, 30000);
  child.on("exit", (code, signal) => {
    child = null;
    if (aliveTimer) clearTimeout(aliveTimer);
    if (stopping) {
      process.exit(code || (signal ? 1 : 0));
      return;
    }
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[supervise] API 进程退出（${reason}），${delayMs}ms 后拉起`);
    setTimeout(() => {
      delayMs = Math.min(maxDelayMs, Math.round(delayMs * 1.7));
      start();
    }, delayMs);
  });
  child.on("error", (err) => {
    console.error("[supervise] 无法启动 API", err);
    if (stopping) return;
    setTimeout(() => {
      delayMs = Math.min(maxDelayMs, Math.round(delayMs * 1.7));
      start();
    }, delayMs);
  });
}

function stop(signal) {
  stopping = true;
  if (aliveTimer) clearTimeout(aliveTimer);
  if (child) {
    try {
      child.kill(signal);
    } catch {
      /* ignore */
    }
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
start();
