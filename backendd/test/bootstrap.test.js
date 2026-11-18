const test = require("node:test");
const assert = require("node:assert/strict");
const { createInitialAdmin } = require("../src/bootstrap");

function fakeConnection(userCount) {
  const calls = [];
  return {
    calls,
    async beginTransaction() {
      calls.push("BEGIN");
    },
    async commit() {
      calls.push("COMMIT");
    },
    async rollback() {
      calls.push("ROLLBACK");
    },
    async query(sql) {
      calls.push(sql);
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
      if (sql.includes("COUNT(*)")) return [[{ count: userCount }]];
      if (sql.includes("RELEASE_LOCK")) return [[{ released: 1 }]];
      throw new Error(`Unexpected query: ${sql}`);
    },
    async execute(sql, params) {
      calls.push({ sql, params });
      return [{ insertId: 42 }];
    }
  };
}

test("initial administrator is global and created only when users is empty", async () => {
  const connection = fakeConnection(0);
  const id = await createInitialAdmin(connection, {
    name: "Initial Admin",
    email: "admin@example.com",
    passwordHash: "$2a$12$hash"
  });

  assert.equal(id, 42);
  const insert = connection.calls.find((call) => typeof call === "object");
  assert.match(insert.sql, /'SUPER_ADMIN', NULL, TRUE/);
  assert.deepEqual(insert.params, ["Initial Admin", "admin@example.com", "$2a$12$hash"]);
  assert.ok(connection.calls.includes("COMMIT"));
  assert.ok(!connection.calls.includes("ROLLBACK"));
  assert.ok(connection.calls.some((sql) => typeof sql === "string" && sql.includes("RELEASE_LOCK")));
});

test("initial administrator bootstrap refuses when any user already exists", async () => {
  const connection = fakeConnection(1);
  await assert.rejects(
    createInitialAdmin(connection, {
      name: "Admin",
      email: "admin@example.com",
      passwordHash: "$2a$12$hash"
    }),
    /users table is empty/
  );
  assert.ok(connection.calls.includes("ROLLBACK"));
  assert.ok(connection.calls.some((sql) => typeof sql === "string" && sql.includes("RELEASE_LOCK")));
  assert.ok(!connection.calls.some((call) => typeof call === "object"));
});
