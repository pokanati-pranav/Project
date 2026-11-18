const path = require("node:path");
const fs = require("node:fs");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const bcrypt = require("bcryptjs");
const envFiles = [
  path.resolve(__dirname, "..", ".env"),
  path.resolve(__dirname, "..", "..", "backend", ".env")
];
const envFile = envFiles.find((file) => fs.existsSync(file));
if (envFile) require("dotenv").config({ path: envFile });

const { pool } = require("./db");
const { createInitialAdmin } = require("./bootstrap");

function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this command from an interactive terminal so the password can be hidden.");
  }

  return new Promise((resolve, reject) => {
    let value = "";
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();

    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          finish(new Error("Setup cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };

    stdin.on("data", onData);
  });
}

async function main() {
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  let name;
  let email;
  try {
    name = (await prompt.question("SUPER_ADMIN name: ")).trim();
    email = (await prompt.question("SUPER_ADMIN email: ")).trim().toLowerCase();
  } finally {
    prompt.close();
  }

  if (!name || name.length > 160) throw new Error("Enter a name between 1 and 160 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");

  const password = await readHidden("Password (at least 12 characters): ");
  const confirmation = await readHidden("Confirm password: ");
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");
  if (password !== confirmation) throw new Error("Passwords do not match.");

  const connection = await pool.getConnection();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const id = await createInitialAdmin(connection, { name, email, passwordHash });
    console.log(`Created global SUPER_ADMIN account (user ID ${id}).`);
    console.log("Log in, then create the first organization with POST /api/v1/organizations.");
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(async (error) => {
  console.error(`Initial administrator setup failed: ${error.message}`);
  try {
    await pool.end();
  } catch (closeError) {
    console.error("Could not close the database pool:", closeError.message);
  }
  process.exitCode = 1;
});
