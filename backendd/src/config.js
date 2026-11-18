function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET;
  if (typeof jwtSecret !== "string" || Buffer.byteLength(jwtSecret, "utf8") < 32) {
    throw new Error("JWT_SECRET must be at least 32 bytes");
  }

  return {
    port: Number(env.PORT || 8087),
    db: {
      host: env.DB_HOST || "localhost",
      port: Number(env.DB_PORT || 3306),
      database: env.DB_NAME || "greenpulse",
      user: env.DB_USERNAME || "greenpulse",
      password: env.DB_PASSWORD || "greenpulse",
      ssl: env.DB_SSL === "true"
    },
    jwtSecret,
    jwtExpirationMs: Number(env.JWT_EXPIRATION_MS || 3600000),
    corsOrigin: env.CORS_ALLOWED_ORIGIN || "http://localhost:5173",
    mlServiceUrl: (env.ML_SERVICE_URL || "http://localhost:8001").replace(/\/+$/, ""),
    allowRegistration: "true" === "true"
  };
}

module.exports = { loadConfig };
