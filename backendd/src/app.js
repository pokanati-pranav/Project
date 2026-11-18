const cors = require("cors");
const express = require("express");
const { loadConfig } = require("./config");
const { HttpError } = require("./errors");
const { createApiRouter } = require("./routes");

function createApp(options = {}) {
  const config = options.config || loadConfig();
  const db = options.db || require("./db").pool;
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"]
  }));
  app.use(express.json({ limit: "10mb" }));

  app.get(["/health", "/actuator/health"], async (_req, res, next) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "UP" });
    } catch (error) {
      next(new HttpError(503, "Database is unavailable"));
    }
  });

  app.use("/api/v1", createApiRouter(db, config));
  app.use((_req, _res, next) => next(new HttpError(404, "Route not found")));
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.code === "ER_DUP_ENTRY" ? 409 : 500);
    const message = status === 500
      ? "An unexpected server error occurred"
      : error.message;
    const data = error.code === "ER_DUP_ENTRY"
      ? { error: "A record with those values already exists" }
      : error.details === undefined
        ? { error: message }
        : error.details;
    if (status === 500) console.error(error);
    res.status(status).json({
      success: false,
      message: error.code === "ER_DUP_ENTRY" ? "Conflicting data" : message,
      data,
      timestamp: new Date().toISOString()
    });
  });

  return app;
}

module.exports = { createApp };
