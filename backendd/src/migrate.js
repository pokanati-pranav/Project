const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const envFiles = [
  path.resolve(__dirname, "..", ".env"),
  path.resolve(__dirname, "..", "..", "backend", ".env")
];
const envFile = envFiles.find((file) => fs.existsSync(file));
if (envFile) dotenv.config({ path: envFile });

const { pool } = require("./db");

async function migrate() {
  const schema = fs.readFileSync(path.resolve(__dirname, "..", "sql", "schema.sql"), "utf8");
  const statements = schema.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  const connection = await pool.getConnection();
  try {
    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log("GreenPulse schema is ready");
  } finally {
    connection.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Schema initialization failed:", error.message);
  process.exitCode = 1;
});
