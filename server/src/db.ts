import knex, { Knex } from "knex";

const kf = require("../knexfile") as Knex.Config;

export const db = knex(kf);
export type Db = Knex;
