const test = require("node:test");
const assert = require("node:assert/strict");
const { loadConfig } = require("../src/config");

const validSecret = "a-test-secret-that-is-long-enough-to-work";

test("configuration requires a 32-byte JWT secret without logging it", () => {
  assert.throws(() => loadConfig({}), /JWT_SECRET must be at least 32 bytes/);
  assert.throws(() => loadConfig({ JWT_SECRET: "short-secret" }), /JWT_SECRET must be at least 32 bytes/);
});

test("public organization signup is enabled only by an explicit true setting", () => {
  assert.equal(loadConfig({ JWT_SECRET: validSecret }).allowRegistration, false);
  assert.equal(loadConfig({ JWT_SECRET: validSecret, ALLOW_REGISTRATION: "false" }).allowRegistration, false);
  assert.equal(loadConfig({ JWT_SECRET: validSecret, ALLOW_REGISTRATION: "true" }).allowRegistration, true);
});
