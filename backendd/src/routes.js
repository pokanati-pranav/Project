const bcrypt = require("bcryptjs");
const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const { createToken, requireAuth, requireRole } = require("./auth");
const { HttpError } = require("./errors");

const roles = ["SUPER_ADMIN", "ORG_ADMIN", "BUILDING_MANAGER", "ANALYST"];
const createReadingRoles = ["SUPER_ADMIN", "ORG_ADMIN", "BUILDING_MANAGER"];
const insightRoles = ["SUPER_ADMIN", "ORG_ADMIN", "BUILDING_MANAGER", "ANALYST"];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function success(res, message, data) {
  return res.json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

function positiveId(value, label = "id") {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new HttpError(400, `${label} must be a positive integer`);
  }
  return parsed;
}

function dateParam(value, fallback, label) {
  const date = value || fallback;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
      || Number.isNaN(parsed.getTime())
      || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, `${label} must be a valid YYYY-MM-DD date`);
  }
  return date;
}

function orgScope(user, column) {
  if (user.role === "SUPER_ADMIN") return { sql: "", params: [] };
  return { sql: ` AND ${column} = ?`, params: [user.organizationId] };
}

function profile(user) {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId === null ? 0 : Number(user.organizationId)
  };
}

function tokenData(user, config) {
  return { token: createToken(user, config), user: profile(user) };
}

async function findBuilding(db, user, id) {
  const scope = orgScope(user, "organization_id");
  const [rows] = await db.execute(
    `SELECT id, organization_id AS organizationId, building_name AS name,
            building_type AS type, location, area_in_sqft AS areaSqft,
            number_of_floors AS floors
     FROM buildings WHERE id = ?${scope.sql} LIMIT 1`,
    [id, ...scope.params]
  );
  if (!rows[0]) throw new HttpError(404, "Building not found");
  return rows[0];
}

async function listReadings(db, user, buildingId, from, to) {
  const scope = orgScope(user, "b.organization_id");
  const buildingClause = buildingId === null ? "" : " AND r.building_id = ?";
  const params = buildingId === null
    ? [from, to, ...scope.params]
    : [from, to, buildingId, ...scope.params];
  const [rows] = await db.execute(
    `SELECT r.id, r.building_id AS buildingId, b.building_name AS buildingName,
            r.reading_date AS readingDate,
            r.energy_consumed_kwh AS energyConsumedKwh, r.source
     FROM energy_readings r
     JOIN buildings b ON b.id = r.building_id
     WHERE r.reading_date BETWEEN ? AND ?${buildingClause}${scope.sql}
     ORDER BY r.reading_date, r.id`,
    params
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), buildingId: Number(row.buildingId) }));
}

async function createReading(db, user, buildingId, readingDate, energy, source) {
  const building = await findBuilding(db, user, buildingId);
  const value = Number(energy);
  if (!Number.isFinite(value) || value < 0 || !/^\d+(\.\d{1,3})?$/.test(String(energy))) {
    throw new HttpError(400, "Energy must be non-negative with at most 3 decimals");
  }
  const [result] = await db.execute(
    `INSERT INTO energy_readings
      (building_id, reading_date, energy_consumed_kwh, recorded_by, source)
     VALUES (?, ?, ?, ?, ?)`,
    [buildingId, readingDate, value, user.id, source || "MANUAL"]
  );
  return {
    id: Number(result.insertId),
    buildingId: Number(building.id),
    buildingName: building.name,
    readingDate,
    energyConsumedKwh: value,
    source: source || "MANUAL"
  };
}

async function emissions(db, rows) {
  let total = 0;
  const missing = new Set();
  const details = [];

  for (const row of rows) {
    const region = row.country && row.country.trim() ? row.country : "GLOBAL";
    let [factors] = await db.execute(
      `SELECT region, emission_factor AS factor, unit, source
       FROM emission_factors
       WHERE region = ? AND effective_from <= ?
         AND (effective_to IS NULL OR effective_to >= ?)
       ORDER BY effective_from DESC LIMIT 1`,
      [region, row.readingDate, row.readingDate]
    );
    if (!factors.length && region !== "GLOBAL") {
      [factors] = await db.execute(
        `SELECT region, emission_factor AS factor, unit, source
         FROM emission_factors
         WHERE region = 'GLOBAL' AND effective_from <= ?
           AND (effective_to IS NULL OR effective_to >= ?)
         ORDER BY effective_from DESC LIMIT 1`,
        [row.readingDate, row.readingDate]
      );
    }

    if (!factors.length) {
      missing.add(region);
      continue;
    }

    const factor = factors[0];
    const kg = Number(row.energyConsumedKwh) * Number(factor.factor);
    total += kg;
    details.push({
      readingDate: row.readingDate,
      building: row.buildingName,
      energyKwh: Number(row.energyConsumedKwh),
      emissionFactor: Number(factor.factor),
      factorRegion: factor.region,
      factorSource: factor.source,
      estimatedKgCo2e: kg
    });
  }

  return {
    totalKgCo2e: total,
    factorConfigured: missing.size === 0 && rows.length > 0,
    missingFactorRegions: [...missing].sort(),
    calculation: "Recorded kWh × effective emission factor (kg CO2e/kWh); estimated, not directly measured",
    readings: details
  };
}

function sumBy(rows, key, label) {
  const values = new Map();
  for (const row of rows) {
    const name = row[key];
    values.set(name, (values.get(name) || 0) + Number(row.energyConsumedKwh));
  }
  return [...values.entries()]
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([name, kwh]) => ({ [label]: name, kwh }));
}

async function callMl(config, path, body) {
  let response;
  try {
    response = await fetch(`${config.mlServiceUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new HttpError(503, "ML service is unavailable or timed out");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new HttpError(400, `ML service rejected input: ${result?.detail || response.statusText}`);
  }
  if (!result || typeof result !== "object") {
    throw new HttpError(503, "ML service returned an empty response");
  }
  return result;
}

function createApiRouter(db, config) {
  const router = express.Router();

  router.post("/auth/login", asyncRoute(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password;
    if (!email || typeof password !== "string") {
      throw new HttpError(400, "Email and password are required");
    }
    const [rows] = await db.execute(
      `SELECT id, name, email, password, role,
              organization_id AS organizationId, enabled
       FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    const user = rows[0];
    if (!user || !user.enabled || !await bcrypt.compare(password, user.password)) {
      throw new HttpError(401, "Invalid email or password");
    }
    return success(res, "Signed in", tokenData(user, config));
  }));

  router.post("/auth/register-organization", asyncRoute(async (req, res) => {
    if (!config.allowRegistration) {
      throw new HttpError(403, "Registration is disabled");
    }

    const organization = req.body?.organization || {};
    const admin = req.body?.admin || {};
    const organizationName = String(organization.name || "").trim();
    const name = String(admin.name || "").trim();
    const email = String(admin.email || "").trim().toLowerCase();
    const password = admin.password;
    if (!organizationName || organizationName.length > 180) {
      throw new HttpError(400, "A valid organization name is required");
    }
    if (!name || name.length > 160) throw new HttpError(400, "A valid administrator name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "A valid email is required");
    if (typeof password !== "string" || password.length < 12) {
      throw new HttpError(400, "Password must be at least 12 characters");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const connection = await db.getConnection();
    let user;
    try {
      await connection.beginTransaction();
      const [organizationResult] = await connection.execute(
        `INSERT INTO organizations
          (organization_name, organization_type, address, country, state)
         VALUES (?, ?, ?, ?, ?)`,
        [
          organizationName,
          organization.type || null,
          organization.address || null,
          organization.country || null,
          organization.state || null
        ]
      );
      const organizationId = Number(organizationResult.insertId);
      const [userResult] = await connection.execute(
        `INSERT INTO users (name, email, password, role, organization_id)
         VALUES (?, ?, ?, 'ORG_ADMIN', ?)`,
        [name, email, passwordHash, organizationId]
      );
      user = { id: Number(userResult.insertId), name, email, role: "ORG_ADMIN", organizationId };
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return success(res, "Account created", tokenData(user, config));
  }));

  router.use(requireAuth(db, config));

  router.get("/auth/me", asyncRoute(async (req, res) => {
    return success(res, "Current user", profile(req.user));
  }));

  router.post("/auth/refresh", asyncRoute(async (req, res) => {
    return success(res, "Token refreshed", tokenData(req.user, config));
  }));

  router.post("/auth/register", requireRole("SUPER_ADMIN", "ORG_ADMIN"), asyncRoute(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password;
    const role = String(req.body?.role || "");
    if (!name || name.length > 160) throw new HttpError(400, "A valid name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "A valid email is required");
    if (typeof password !== "string" || password.length < 12) {
      throw new HttpError(400, "Password must be at least 12 characters");
    }
    if (!["ORG_ADMIN", "BUILDING_MANAGER", "ANALYST"].includes(role)) {
      throw new HttpError(400, "Role must be ORG_ADMIN, BUILDING_MANAGER, or ANALYST");
    }

    let organizationId = req.user.organizationId;
    if (req.user.role === "SUPER_ADMIN") {
      organizationId = positiveId(req.body?.organizationId, "organizationId");
    } else if (!organizationId) {
      throw new HttpError(403, "An organization administrator must belong to an organization");
    }

    const [orgs] = await db.execute("SELECT id FROM organizations WHERE id = ? LIMIT 1", [organizationId]);
    if (!orgs.length) throw new HttpError(404, "Organization not found");
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      `INSERT INTO users (name, email, password, role, organization_id)
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, passwordHash, role, organizationId]
    );
    return success(res, "User created", {
      id: Number(result.insertId),
      name,
      email,
      role,
      organizationId
    });
  }));

  router.get("/users", requireRole("SUPER_ADMIN", "ORG_ADMIN"), asyncRoute(async (req, res) => {
    const scope = orgScope(req.user, "u.organization_id");
    const [rows] = await db.execute(
      `SELECT u.id, u.name, u.email, u.role,
              u.organization_id AS organizationId, o.organization_name AS organizationName,
              u.enabled
       FROM users u LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE 1=1${scope.sql}
       ORDER BY u.name, u.email`,
      scope.params
    );
    return success(res, "Users", rows.map((row) => ({
      ...row,
      id: Number(row.id),
      organizationId: row.organizationId === null ? 0 : Number(row.organizationId),
      enabled: Boolean(row.enabled)
    })));
  }));

  router.get("/organizations", asyncRoute(async (req, res) => {
    const scope = orgScope(req.user, "id");
    const [rows] = await db.execute(
      `SELECT id, organization_name AS name, organization_type AS type,
              address, country, state
       FROM organizations WHERE 1=1${scope.sql} ORDER BY organization_name`,
      scope.params
    );
    return success(res, "Organizations", rows.map((row) => ({ ...row, id: Number(row.id) })));
  }));

  router.post("/organizations", requireRole("SUPER_ADMIN"), asyncRoute(async (req, res) => {
    const { name, type, address, country, state } = req.body || {};
    if (typeof name !== "string" || !name.trim()) throw new HttpError(400, "Organization name is required");
    const [result] = await db.execute(
      `INSERT INTO organizations
        (organization_name, organization_type, address, country, state)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), type || null, address || null, country || null, state || null]
    );
    return success(res, "Organization created", {
      id: Number(result.insertId),
      name: name.trim(),
      type: type || "",
      address: address || "",
      country: country || "",
      state: state || ""
    });
  }));

  router.get("/organizations/:id", asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id);
    const scope = orgScope(req.user, "id");
    const [rows] = await db.execute(
      `SELECT id, organization_name AS name, organization_type AS type,
              address, country, state
       FROM organizations WHERE id = ?${scope.sql} LIMIT 1`,
      [id, ...scope.params]
    );
    if (!rows[0]) throw new HttpError(404, "Organization not found");
    return success(res, "Organization", { ...rows[0], id: Number(rows[0].id) });
  }));

  router.get(["/buildings", "/organizations/:organizationId/buildings"], asyncRoute(async (req, res) => {
    const scope = orgScope(req.user, "b.organization_id");
    const organizationClause = req.params.organizationId ? " AND b.organization_id = ?" : "";
    const params = req.params.organizationId
      ? [positiveId(req.params.organizationId, "organizationId"), ...scope.params]
      : scope.params;
    const [rows] = await db.execute(
      `SELECT b.id, b.organization_id AS organizationId, b.building_name AS name,
              b.building_type AS type, b.location, b.area_in_sqft AS areaSqft,
              b.number_of_floors AS floors
       FROM buildings b WHERE 1=1${organizationClause}${scope.sql}
       ORDER BY b.building_name`,
      params
    );
    return success(res, "Buildings", rows.map((row) => ({
      ...row,
      id: Number(row.id),
      organizationId: Number(row.organizationId),
      areaSqft: Number(row.areaSqft || 0),
      floors: Number(row.floors || 0),
      type: row.type || "",
      location: row.location || ""
    })));
  }));

  router.post("/buildings", requireRole("SUPER_ADMIN", "ORG_ADMIN"), asyncRoute(async (req, res) => {
    const organizationId = positiveId(req.body?.organizationId, "organizationId");
    const name = String(req.body?.name || "").trim();
    if (!name) throw new HttpError(400, "Building name is required");
    const scope = orgScope(req.user, "id");
    const [orgs] = await db.execute(
      `SELECT id FROM organizations WHERE id = ?${scope.sql} LIMIT 1`,
      [organizationId, ...scope.params]
    );
    if (!orgs.length) throw new HttpError(404, "Organization not found");
    const [result] = await db.execute(
      `INSERT INTO buildings
        (organization_id, building_name, building_type, location, area_in_sqft, number_of_floors)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        organizationId,
        name,
        req.body.type || null,
        req.body.location || null,
        req.body.areaSqft ?? null,
        req.body.floors ?? null
      ]
    );
    return success(res, "Building created", {
      id: Number(result.insertId),
      organizationId,
      name,
      type: req.body.type || "",
      location: req.body.location || "",
      areaSqft: Number(req.body.areaSqft || 0),
      floors: Number(req.body.floors || 0)
    });
  }));

  router.get("/buildings/:id", asyncRoute(async (req, res) => {
    const building = await findBuilding(db, req.user, positiveId(req.params.id));
    return success(res, "Building", {
      ...building,
      id: Number(building.id),
      organizationId: Number(building.organizationId),
      areaSqft: Number(building.areaSqft || 0),
      floors: Number(building.floors || 0),
      type: building.type || "",
      location: building.location || ""
    });
  }));

  router.get("/carbon/emission-factors", asyncRoute(async (_req, res) => {
    const [rows] = await db.execute(
      `SELECT id, region, emission_factor AS factor, unit,
              effective_from AS effectiveFrom, effective_to AS effectiveTo, source
       FROM emission_factors ORDER BY effective_from DESC`
    );
    return success(res, "Emission factors", rows.map((row) => ({
      ...row,
      id: Number(row.id),
      factor: Number(row.factor)
    })));
  }));

  const factorFromBody = (body) => {
    const region = String(body?.region || "").trim();
    const unit = String(body?.unit || "").trim();
    const source = String(body?.source || "").trim();
    const factor = Number(body?.factor);
    const effectiveFrom = dateParam(body?.effectiveFrom, "", "effectiveFrom");
    const effectiveTo = body?.effectiveTo ? dateParam(body.effectiveTo, "", "effectiveTo") : null;
    if (!region || !unit || !source || !Number.isFinite(factor) || factor < 0) {
      throw new HttpError(400, "Region, non-negative factor, unit, effectiveFrom, and source are required");
    }
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new HttpError(400, "effectiveTo must be on or after effectiveFrom");
    }
    return { region, factor, unit, effectiveFrom, effectiveTo, source };
  };

  router.post("/carbon/emission-factors", requireRole("SUPER_ADMIN", "ORG_ADMIN"), asyncRoute(async (req, res) => {
    const factor = factorFromBody(req.body);
    const [result] = await db.execute(
      `INSERT INTO emission_factors
        (region, emission_factor, unit, effective_from, effective_to, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [factor.region, factor.factor, factor.unit, factor.effectiveFrom, factor.effectiveTo, factor.source]
    );
    return success(res, "Emission factor created", { id: Number(result.insertId), ...factor });
  }));

  router.put("/carbon/emission-factors/:id", requireRole("SUPER_ADMIN", "ORG_ADMIN"), asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id);
    const factor = factorFromBody(req.body);
    const [result] = await db.execute(
      `UPDATE emission_factors
       SET region = ?, emission_factor = ?, unit = ?, effective_from = ?, effective_to = ?, source = ?
       WHERE id = ?`,
      [factor.region, factor.factor, factor.unit, factor.effectiveFrom, factor.effectiveTo, factor.source, id]
    );
    if (!result.affectedRows) throw new HttpError(404, "Emission factor not found");
    return success(res, "Emission factor updated", { id, ...factor });
  }));

  router.post("/energy-readings", requireRole(...createReadingRoles), asyncRoute(async (req, res) => {
    const buildingId = positiveId(req.body?.buildingId, "buildingId");
    const readingDate = dateParam(req.body?.readingDate, "", "readingDate");
    const reading = await createReading(
      db,
      req.user,
      buildingId,
      readingDate,
      req.body?.energyConsumedKwh,
      "MANUAL"
    );
    return success(res, "Reading created", reading);
  }));

  router.get("/energy-readings", asyncRoute(async (req, res) => {
    const from = dateParam(req.query.from, "2000-01-01", "from");
    const to = dateParam(req.query.to, "2099-12-31", "to");
    if (from > to) throw new HttpError(400, "from must be on or before to");
    const buildingId = req.query.buildingId ? positiveId(req.query.buildingId, "buildingId") : null;
    if (buildingId !== null) await findBuilding(db, req.user, buildingId);
    const rows = await listReadings(db, req.user, buildingId, from, to);
    return success(res, "Energy readings", rows);
  }));

  router.get("/buildings/:id/energy-readings", asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id);
    await findBuilding(db, req.user, id);
    const rows = await listReadings(db, req.user, id, "2000-01-01", "2099-12-31");
    return success(res, "Building readings", rows);
  }));

  router.post("/energy-readings/upload", requireRole(...createReadingRoles), upload.single("file"), asyncRoute(async (req, res) => {
    const buildingId = positiveId(req.body?.buildingId, "buildingId");
    if (!req.file) throw new HttpError(400, "A CSV file is required");
    await findBuilding(db, req.user, buildingId);

    let records;
    try {
      records = parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
      });
    } catch (error) {
      throw new HttpError(400, `Invalid CSV: ${error.message}`);
    }

    let successfulRows = 0;
    const errors = [];
    for (let index = 0; index < records.length; index += 1) {
      const row = records[index];
      try {
        if (!row.reading_date || !row.energy_consumed_kwh) {
          throw new HttpError(400, "CSV must include reading_date and energy_consumed_kwh");
        }
        await createReading(db, req.user, buildingId, dateParam(row.reading_date, "", "reading_date"), row.energy_consumed_kwh, "CSV");
        successfulRows += 1;
      } catch (error) {
        errors.push(`row ${index + 2}: ${error.message}`);
      }
    }
    return success(res, "CSV processed", {
      successfulRows,
      failedRows: errors.length,
      errors
    });
  }));

  router.get("/analytics/dashboard", asyncRoute(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const start = new Date(`${today}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 29);
    const from = start.toISOString().slice(0, 10);
    const rows = await listReadings(db, req.user, null, from, today);
    const trend = sumBy(rows, "readingDate", "date");
    const scope = orgScope(req.user, "b.organization_id");
    const [buildings] = await db.execute(
      `SELECT COUNT(*) AS count FROM buildings b WHERE 1=1${scope.sql}`,
      scope.params
    );
    const [alerts] = await db.execute(
      `SELECT COUNT(*) AS count FROM anomaly_alerts a
       JOIN buildings b ON b.id = a.building_id
       WHERE a.status = 'OPEN'${scope.sql}`,
      scope.params
    );
    const [recommendations] = await db.execute(
      `SELECT COUNT(*) AS count FROM recommendations r
       JOIN buildings b ON b.id = r.building_id
       WHERE r.status = 'OPEN'${scope.sql}`,
      scope.params
    );
    const [withCountries] = await db.execute(
      `SELECT r.reading_date AS readingDate, r.energy_consumed_kwh AS energyConsumedKwh,
              b.building_name AS buildingName, o.country
       FROM energy_readings r JOIN buildings b ON b.id = r.building_id
       JOIN organizations o ON o.id = b.organization_id
       WHERE r.reading_date BETWEEN ? AND ?${scope.sql}`,
      [from, today, ...scope.params]
    );
    const carbon = await emissions(db, withCountries);
    return success(res, "Dashboard analytics", {
      totalEnergyKwh: rows.reduce((sum, row) => sum + Number(row.energyConsumedKwh), 0),
      totalEmissionsKg: carbon.totalKgCo2e,
      emissionFactorConfigured: carbon.factorConfigured,
      buildingCount: Number(buildings[0].count),
      readingDays: trend.length,
      trend,
      activeAlerts: Number(alerts[0].count),
      recommendationCount: Number(recommendations[0].count)
    });
  }));

  router.get("/analytics/consumption-trends", asyncRoute(async (req, res) => {
    const from = dateParam(req.query.from, "2000-01-01", "from");
    const to = dateParam(req.query.to, "2099-12-31", "to");
    if (from > to) throw new HttpError(400, "from must be on or before to");
    const buildingId = req.query.buildingId ? positiveId(req.query.buildingId, "buildingId") : null;
    if (buildingId !== null) await findBuilding(db, req.user, buildingId);
    return success(res, "Consumption trend", sumBy(await listReadings(db, req.user, buildingId, from, to), "readingDate", "date"));
  }));

  router.get("/analytics/building-comparison", asyncRoute(async (req, res) => {
    const from = dateParam(req.query.from, "2000-01-01", "from");
    const to = dateParam(req.query.to, "2099-12-31", "to");
    if (from > to) throw new HttpError(400, "from must be on or before to");
    return success(res, "Building comparison", sumBy(await listReadings(db, req.user, null, from, to), "buildingName", "building"));
  }));

  router.get("/analytics/monthly-summary", asyncRoute(async (req, res) => {
    const to = new Date().toISOString().slice(0, 10);
    const start = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);
    start.setUTCMonth(start.getUTCMonth() - 12);
    return success(res, "Monthly summary", sumBy(
      await listReadings(db, req.user, null, start.toISOString().slice(0, 10), to),
      "readingDate",
      "date"
    ));
  }));

  router.get("/analytics/energy-distribution", asyncRoute(async (req, res) => {
    const to = new Date().toISOString().slice(0, 10);
    const start = new Date(`${to}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 30);
    return success(res, "Energy distribution", sumBy(
      await listReadings(db, req.user, null, start.toISOString().slice(0, 10), to),
      "buildingName",
      "building"
    ));
  }));

  async function carbonForRange(user, from, to) {
    const scope = orgScope(user, "b.organization_id");
    const [rows] = await db.execute(
      `SELECT r.reading_date AS readingDate, r.energy_consumed_kwh AS energyConsumedKwh,
              b.building_name AS buildingName, o.country
       FROM energy_readings r JOIN buildings b ON b.id = r.building_id
       JOIN organizations o ON o.id = b.organization_id
       WHERE r.reading_date BETWEEN ? AND ?${scope.sql}
       ORDER BY r.reading_date`,
      [from, to, ...scope.params]
    );
    return emissions(db, rows);
  }

  router.get("/carbon/emissions", asyncRoute(async (req, res) => {
    const from = dateParam(req.query.from, "2000-01-01", "from");
    const to = dateParam(req.query.to, "2099-12-31", "to");
    if (from > to) throw new HttpError(400, "from must be on or before to");
    return success(res, "Estimated carbon emissions", await carbonForRange(req.user, from, to));
  }));

  router.get("/carbon/monthly-summary", asyncRoute(async (req, res) => {
    const to = new Date().toISOString().slice(0, 10);
    const start = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);
    start.setUTCMonth(start.getUTCMonth() - 12);
    return success(res, "Estimated carbon emissions", await carbonForRange(req.user, start.toISOString().slice(0, 10), to));
  }));

  router.get("/carbon/building-comparison", asyncRoute(async (req, res) => {
    const from = dateParam(req.query.from, "2000-01-01", "from");
    const to = dateParam(req.query.to, "2099-12-31", "to");
    if (from > to) throw new HttpError(400, "from must be on or before to");
    return success(res, "Estimated carbon emissions", await carbonForRange(req.user, from, to));
  }));

  router.get("/recommendations", asyncRoute(async (req, res) => {
    const scope = orgScope(req.user, "b.organization_id");
    const [rows] = await db.execute(
      `SELECT r.id, r.building_id AS buildingId, b.building_name AS buildingName,
              r.title, r.description, r.recommendation_type AS type, r.priority,
              r.estimated_saving_kwh AS estimatedSavingKwh, r.status
       FROM recommendations r JOIN buildings b ON b.id = r.building_id
       WHERE 1=1${scope.sql} ORDER BY r.created_at DESC`,
      scope.params
    );
    return success(res, "Recommendations", rows.map((row) => ({
      ...row,
      id: Number(row.id),
      buildingId: Number(row.buildingId),
      estimatedSavingKwh: Number(row.estimatedSavingKwh || 0)
    })));
  }));

  router.post("/recommendations/generate/:buildingId", requireRole(...createReadingRoles), asyncRoute(async (req, res) => {
    const buildingId = positiveId(req.params.buildingId, "buildingId");
    const building = await findBuilding(db, req.user, buildingId);
    const rows = await listReadings(db, req.user, buildingId, "2000-01-01", "2099-12-31");
    if (rows.length < 14) {
      return success(res, "Recommendation rule evaluation complete", {
        created: 0,
        message: "At least 14 readings are required for a month-over-month pattern check"
      });
    }
    const sorted = rows.sort((a, b) => a.readingDate.localeCompare(b.readingDate));
    const mean = (items) => items.reduce((sum, row) => sum + Number(row.energyConsumedKwh), 0) / items.length;
    const prior = mean(sorted.slice(-14, -7));
    const recent = mean(sorted.slice(-7));
    const change = prior === 0 ? 0 : (recent - prior) / prior;
    let created = 0;
    if (change > 0.15) {
      const title = "Consumption increased over the prior week";
      const [existing] = await db.execute(
        `SELECT id FROM recommendations
         WHERE building_id = ? AND title = ? AND status = 'OPEN' LIMIT 1`,
        [buildingId, title]
      );
      if (!existing.length) {
        const priority = change > 0.30 ? "HIGH" : "MEDIUM";
        const estimatedSavingKwh = Number((recent * 0.05).toFixed(3));
        const description = `The latest 7 observed reading average is ${(change * 100).toFixed(1)}% above the previous 7 observations. Review schedules and equipment. Potential saving estimate assumes a 5% reduction of the latest daily average; savings are not guaranteed.`;
        await db.execute(
          `INSERT INTO recommendations
            (building_id, title, description, recommendation_type, priority, estimated_saving_kwh)
           VALUES (?, ?, ?, 'CONSUMPTION_TREND', ?, ?)`,
          [buildingId, title, description, priority, estimatedSavingKwh]
        );
        created = 1;
      }
    }
    return success(res, "Recommendation rule evaluation complete", {
      created,
      message: created === 0 ? "No new recommendation rules matched" : "Recommendation generated from recorded readings",
      recentAverageKwh: Number(recent.toFixed(3)),
      previousAverageKwh: Number(prior.toFixed(3)),
      buildingId: Number(building.id)
    });
  }));

  router.put("/recommendations/:id/status", requireRole(...createReadingRoles), asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id);
    const status = String(req.body?.status || "");
    if (!["OPEN", "IN_PROGRESS", "COMPLETED", "DISMISSED"].includes(status)) {
      throw new HttpError(400, "Unsupported recommendation status");
    }
    const scope = orgScope(req.user, "b.organization_id");
    const [result] = await db.execute(
      `UPDATE recommendations r JOIN buildings b ON b.id = r.building_id
       SET r.status = ? WHERE r.id = ?${scope.sql}`,
      [status, id, ...scope.params]
    );
    if (!result.affectedRows) throw new HttpError(404, "Recommendation not found");
    return success(res, "Recommendation status updated", { id, status });
  }));

  router.post("/predictions/generate/:buildingId", requireRole(...insightRoles), asyncRoute(async (req, res) => {
    const buildingId = positiveId(req.params.buildingId, "buildingId");
    await findBuilding(db, req.user, buildingId);
    const rows = await listReadings(db, req.user, buildingId, "2000-01-01", "2099-12-31");
    if (rows.length < 28) throw new HttpError(400, "At least 28 daily readings are required for predictions");
    const result = await callMl(config, "/predict", {
      readings: rows.map((row) => ({
        reading_date: row.readingDate,
        energy_consumed_kwh: row.energyConsumedKwh
      })),
      horizon_days: 7,
      model_name: "random_forest"
    });
    const version = result.model_version || "1.0.0";
    const modelName = result.model_name || "random_forest";
    for (const item of result.predictions || []) {
      const predictionDate = dateParam(item.prediction_date, "", "prediction_date");
      const predictedKwh = Number(item.predicted_kwh);
      if (!Number.isFinite(predictedKwh)) throw new HttpError(503, "ML service returned an invalid prediction");
      await db.execute(
        `INSERT INTO energy_predictions
          (building_id, prediction_date, predicted_kwh, model_name, model_version)
         VALUES (?, ?, ?, ?, ?)`,
        [buildingId, predictionDate, predictedKwh, modelName, String(version)]
      );
    }
    return success(res, "Predictions generated and stored", result);
  }));

  async function predictionRows(user, buildingId) {
    await findBuilding(db, user, buildingId);
    const [rows] = await db.execute(
      `SELECT p.id, p.building_id AS buildingId, p.prediction_date AS predictionDate,
              p.predicted_kwh AS predictedKwh, p.model_name AS modelName,
              p.model_version AS modelVersion
       FROM energy_predictions p
       JOIN buildings b ON b.id = p.building_id
       WHERE p.building_id = ?${orgScope(user, "b.organization_id").sql}
       ORDER BY p.prediction_date`,
      [buildingId, ...orgScope(user, "b.organization_id").params]
    );
    return rows.map((row) => ({
      ...row,
      id: Number(row.id),
      buildingId: Number(row.buildingId),
      predictedKwh: Number(row.predictedKwh)
    }));
  }

  router.get("/predictions/:buildingId", asyncRoute(async (req, res) => {
    const rows = await predictionRows(req.user, positiveId(req.params.buildingId, "buildingId"));
    return success(res, "Stored predictions", rows);
  }));

  router.get("/predictions/:buildingId/summary", asyncRoute(async (req, res) => {
    const rows = await predictionRows(req.user, positiveId(req.params.buildingId, "buildingId"));
    return success(res, "Prediction summary", {
      count: rows.length,
      predictions: rows.map(({ predictionDate, predictedKwh }) => ({ predictionDate, predictedKwh }))
    });
  }));

  router.post("/anomalies/detect/:buildingId", requireRole(...createReadingRoles), asyncRoute(async (req, res) => {
    const buildingId = positiveId(req.params.buildingId, "buildingId");
    await findBuilding(db, req.user, buildingId);
    const rows = await listReadings(db, req.user, buildingId, "2000-01-01", "2099-12-31");
    if (rows.length < 10) throw new HttpError(400, "At least 10 readings are required for anomaly detection");
    const result = await callMl(config, "/detect-anomalies", {
      readings: rows.map((row) => ({
        reading_date: row.readingDate,
        energy_consumed_kwh: row.energyConsumedKwh
      }))
    });
    let storedAlerts = 0;
    for (const anomaly of result.anomalies || []) {
      const [readings] = await db.execute(
        `SELECT id FROM energy_readings
         WHERE building_id = ? AND reading_date = ? LIMIT 1`,
        [buildingId, dateParam(anomaly.reading_date, "", "reading_date")]
      );
      if (!readings.length) continue;
      const readingId = Number(readings[0].id);
      const [existing] = await db.execute("SELECT id FROM anomaly_alerts WHERE reading_id = ? LIMIT 1", [readingId]);
      if (existing.length) continue;
      await db.execute(
        `INSERT INTO anomaly_alerts
          (building_id, reading_id, anomaly_score, severity, description)
         VALUES (?, ?, ?, ?, ?)`,
        [
          buildingId,
          readingId,
          Number(anomaly.anomaly_score),
          String(anomaly.severity || "LOW"),
          String(anomaly.explanation || "Anomaly detected")
        ]
      );
      storedAlerts += 1;
    }
    return success(res, "Anomaly detection complete", { storedAlerts, modelResponse: result });
  }));

  router.get("/anomalies", asyncRoute(async (req, res) => {
    const scope = orgScope(req.user, "b.organization_id");
    const [rows] = await db.execute(
      `SELECT a.id, a.building_id AS buildingId, b.building_name AS buildingName,
              r.reading_date AS readingDate, a.anomaly_score AS anomalyScore,
              a.severity, a.description, a.status
       FROM anomaly_alerts a
       JOIN buildings b ON b.id = a.building_id
       JOIN energy_readings r ON r.id = a.reading_id
       WHERE 1=1${scope.sql} ORDER BY a.detected_at DESC`,
      scope.params
    );
    return success(res, "Anomaly alerts", rows.map((row) => ({
      ...row,
      id: Number(row.id),
      buildingId: Number(row.buildingId),
      anomalyScore: Number(row.anomalyScore)
    })));
  }));

  router.get("/anomalies/:id", asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id);
    const scope = orgScope(req.user, "b.organization_id");
    const [rows] = await db.execute(
      `SELECT a.id, a.building_id AS buildingId, r.reading_date AS readingDate,
              a.anomaly_score AS anomalyScore, a.severity, a.description, a.status
       FROM anomaly_alerts a
       JOIN buildings b ON b.id = a.building_id
       JOIN energy_readings r ON r.id = a.reading_id
       WHERE a.id = ?${scope.sql} LIMIT 1`,
      [id, ...scope.params]
    );
    if (!rows[0]) throw new HttpError(404, "Anomaly not found");
    return success(res, "Anomaly alert", {
      ...rows[0],
      id: Number(rows[0].id),
      buildingId: Number(rows[0].buildingId),
      anomalyScore: Number(rows[0].anomalyScore)
    });
  }));

  router.put("/anomalies/:id/status", requireRole(...createReadingRoles), asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id);
    const status = String(req.body?.status || "");
    if (!["OPEN", "RESOLVED", "DISMISSED"].includes(status)) {
      throw new HttpError(400, "Status must be OPEN, RESOLVED, or DISMISSED");
    }
    const scope = orgScope(req.user, "b.organization_id");
    const [result] = await db.execute(
      `UPDATE anomaly_alerts a JOIN buildings b ON b.id = a.building_id
       SET a.status = ?, a.resolved_at = ?
       WHERE a.id = ?${scope.sql}`,
      [status, status === "OPEN" ? null : new Date(), id, ...scope.params]
    );
    if (!result.affectedRows) throw new HttpError(404, "Anomaly not found");
    return success(res, "Anomaly status updated", { id, status });
  }));

  router.get("/model-info", (_req, res) => success(res, "ML service information", {
    message: "Model information is exposed by the ML service at /model-info"
  }));

  router.use((error, _req, _res, next) => next(error));

  return router;
}

module.exports = { createApiRouter };
