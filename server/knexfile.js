require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });

function make(database) {
  return {
    client: "mysql2",
    connection: {
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "root",
      database,
      charset: "utf8mb4",
      timezone: "+08:00",
      supportBigNumbers: true,
    },
    pool: { min: 0, max: 10 },
    migrations: { directory: "./migrations" },
    seeds: { directory: "./seeds" },
  };
}

module.exports = {
  development: make(process.env.DB_NAME || "variety_shop"),
  test: make(process.env.DB_TEST_NAME || "variety_shop_test"),
};
