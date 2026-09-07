require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });

module.exports = {
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "shop",
    password: process.env.DB_PASSWORD || "shop123",
    database: process.env.DB_NAME || "variety_shop",
    charset: "utf8mb4",
    timezone: "+08:00",
  },
  pool: { min: 0, max: 10 },
  migrations: { directory: "./migrations" },
  seeds: { directory: "./seeds" },
};
