const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");

const config = {
  port: 0,
  db: {},
  jwtSecret: "a-test-secret-that-is-long-enough-to-work",
  jwtExpirationMs: 3600000,
  corsOrigin: "http://localhost:5173",
  mlServiceUrl: "http://localhost:8001",
  allowRegistration: false
};

async function withServer(app, run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("health returns success when the database responds", async () => {
  const app = createApp({
    config,
    db: { query: async () => [[]] }
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "UP" });
  });
});

test("protected API endpoints reject requests without a token", async () => {
  const app = createApp({ config, db: { execute: async () => { throw new Error("should not query"); } } });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Authentication required");
  });
});

test("organization registration stays disabled unless explicitly enabled", async () => {
  const app = createApp({ config, db: { execute: async () => { throw new Error("should not query"); } } });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register-organization`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).data.error, "Registration is disabled");
  });
});

test("public organization signup creates an organization and its first ORG_ADMIN", async () => {
  const registrationConfig = { ...config, allowRegistration: true };
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push("begin"); },
    async commit() { calls.push("commit"); },
    async rollback() { calls.push("rollback"); },
    release() { calls.push("release"); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("INSERT INTO organizations")) return [{ insertId: 5 }];
      if (sql.includes("INSERT INTO users")) return [{ insertId: 7 }];
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  const db = {
    getConnection: async () => connection
  };
  const app = createApp({ config: registrationConfig, db });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register-organization`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organization: { name: "Test Organization", country: "USA" },
        admin: {
          name: "Test Admin",
          email: "admin@example.com",
          password: "a-secure-local-test-password"
        },
        role: "SUPER_ADMIN"
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.user.role, "ORG_ADMIN");
    assert.equal(body.data.user.organizationId, 5);
    assert.ok(calls.includes("begin"));
    assert.ok(calls.includes("commit"));
    assert.ok(!calls.includes("rollback"));
    assert.ok(calls.includes("release"));
  });
});

test("employee account registration requires an authenticated administrator", async () => {
  const app = createApp({ config, db: { execute: async () => { throw new Error("should not query"); } } });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "New Analyst",
        email: "analyst@example.com",
        password: "a-secure-local-test-password",
        role: "ANALYST"
      })
    });
    assert.equal(response.status, 401);
  });
});

test("organization admins can only create users in their own organization", async () => {
  const statements = [];
  const db = {
    execute: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes("FROM users WHERE email")) {
        return [[{
          id: 8,
          name: "Org Admin",
          email: "admin@example.com",
          role: "ORG_ADMIN",
          organizationId: 5,
          enabled: 1
        }]];
      }
      if (sql.includes("FROM organizations")) {
        assert.deepEqual(params, [5]);
        return [[{ id: 5 }]];
      }
      if (sql.includes("INSERT INTO users")) return [{ insertId: 9 }];
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  const app = createApp({ config, db });
  const token = jwt.sign(
    { role: "ORG_ADMIN", org: 5 },
    config.jwtSecret,
    { subject: "admin@example.com", expiresIn: "1h" }
  );
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Analyst",
        email: "analyst@example.com",
        password: "a-secure-local-test-password",
        role: "ANALYST",
        organizationId: 99
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.organizationId, 5);
    const insert = statements.find((entry) => entry.sql.includes("INSERT INTO users"));
    assert.equal(insert.params[4], 5);

    const elevatedRoleResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Another Admin",
        email: "another-admin@example.com",
        password: "a-secure-local-test-password",
        role: "SUPER_ADMIN"
      })
    });
    assert.equal(elevatedRoleResponse.status, 400);
    assert.equal(statements.filter((entry) => entry.sql.includes("INSERT INTO users")).length, 1);
  });
});

test("organization admins only see users in their organization", async () => {
  let userListParams;
  const db = {
    execute: async (sql, params) => {
      if (sql.includes("FROM users WHERE email")) {
        return [[{
          id: 8,
          name: "Org Admin",
          email: "admin@example.com",
          role: "ORG_ADMIN",
          organizationId: 5,
          enabled: 1
        }]];
      }
      if (sql.includes("FROM users u LEFT JOIN organizations")) {
        userListParams = params;
        return [[{
          id: 9,
          name: "Analyst",
          email: "analyst@example.com",
          role: "ANALYST",
          organizationId: 5,
          organizationName: "Example Org",
          enabled: 1
        }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  const app = createApp({ config, db });
  const token = jwt.sign(
    { role: "ORG_ADMIN", org: 5 },
    config.jwtSecret,
    { subject: "admin@example.com", expiresIn: "1h" }
  );
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users`, {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(userListParams, [5]);
    assert.equal(body.data[0].organizationId, 5);
    assert.equal(body.data[0].enabled, true);
  });
});

test("organization signup rolls back if creating its first administrator fails", async () => {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push("begin"); },
    async commit() { calls.push("commit"); },
    async rollback() { calls.push("rollback"); },
    release() { calls.push("release"); },
    async execute(sql) {
      if (sql.includes("INSERT INTO organizations")) return [{ insertId: 5 }];
      if (sql.includes("INSERT INTO users")) {
        throw Object.assign(new Error("duplicate email"), { code: "ER_DUP_ENTRY" });
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  const app = createApp({
    config: { ...config, allowRegistration: true },
    db: { getConnection: async () => connection }
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register-organization`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organization: { name: "Test Organization" },
        admin: {
          name: "Test Admin",
          email: "admin@example.com",
          password: "a-secure-local-test-password"
        }
      })
    });
    assert.equal(response.status, 409);
    assert.ok(calls.includes("rollback"));
    assert.ok(!calls.includes("commit"));
    assert.ok(calls.includes("release"));
  });
});

test("the shared login route supports every account role", async () => {
  const password = "a-secure-local-test-password";
  const passwordHash = await bcrypt.hash(password, 4);
  const db = {
    execute: async (_sql, [email]) => {
      const role = email.split("@")[0].toUpperCase();
      return [[{
        id: 1,
        name: role,
        email,
        password: passwordHash,
        role,
        organizationId: role === "SUPER_ADMIN" ? null : 5,
        enabled: 1
      }]];
    }
  };
  const app = createApp({ config, db });
  await withServer(app, async (baseUrl) => {
    for (const role of ["SUPER_ADMIN", "ORG_ADMIN", "BUILDING_MANAGER", "ANALYST"]) {
      const email = `${role.toLowerCase()}@example.com`;
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.user.role, role);
    }
  });
});
