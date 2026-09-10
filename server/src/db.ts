import knex, { Knex } from "knex";

const all = require("../knexfile") as Record<string, Knex.Config>;
const env = process.env.KNEX_ENV || (process.env.NODE_ENV === "test" ? "test" : "development");
const cfg = all[env] || all.development;

if (!cfg) {
  throw new Error(`knex 配置缺失：${env}`);
}

export const db = knex(cfg);
export type Db = Knex;

db.on("query-error", (err: Error, q: { sql?: string }) => {
  // eslint-disable-next-line no-console
  console.error("[knex query-error]", err.message, q?.sql || "");
});

export async function pingDb() {
  await db.raw("SELECT 1 AS ok");
}
