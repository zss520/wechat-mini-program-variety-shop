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
      connectTimeout: 10000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    },
    pool: {
      min: 0,
      max: 10,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 15000,
      createTimeoutMillis: 15000,
      propagateCreateError: false,
      afterCreate(conn, done) {
        if (conn && typeof conn.on === "function") {
          conn.on("error", (err) => {
            // eslint-disable-next-line no-console
            console.error("[mysql connection]", (err && (err.code || err.message)) || err);
          });
        }
        if (conn && typeof conn.query === "function") {
          conn.query("SELECT 1", (err) => done(err, conn));
          return;
        }
        done(null, conn);
      },
    },
    migrations: { directory: "./migrations" },
    seeds: { directory: "./seeds" },
  };
}

module.exports = {
  development: make(process.env.DB_NAME || "variety_shop"),
  test: make(process.env.DB_TEST_NAME || "variety_shop_test"),
};
