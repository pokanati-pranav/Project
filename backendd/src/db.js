const mysql = require("mysql2/promise");
const { loadConfig } = require("./config");

function createPool(config = loadConfig().db) {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: "Z",
    dateStrings: true,
    decimalNumbers: true,
    ssl: config.ssl ? { rejectUnauthorized: true } : undefined
  });
}

module.exports = { createPool, pool: createPool() };
