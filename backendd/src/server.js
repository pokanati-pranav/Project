const path = require("node:path");
const fs = require("node:fs");
const envFiles = [
  path.resolve(__dirname, "..", ".env"),
  path.resolve(__dirname, "..", "..", "backend", ".env")
];
const envFile = envFiles.find((file) => fs.existsSync(file));
if (envFile) require("dotenv").config({ path: envFile });

const { loadConfig } = require("./config");
const { pool } = require("./db");
const { createApp } = require("./app");

const config = loadConfig();
const app = createApp({ db: pool, config });
const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`GreenPulse Node API listening on port ${config.port}`);
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async (error) => {
    try {
      await pool.end();
    } catch (poolError) {
      console.error("Failed to close database pool", poolError);
      process.exitCode = 1;
    }
    if (error) {
      console.error("Failed to close HTTP server", error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
