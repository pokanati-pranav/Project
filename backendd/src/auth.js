const jwt = require("jsonwebtoken");
const { HttpError } = require("./errors");

function createToken(user, config) {
  return jwt.sign(
    { role: user.role, org: user.organizationId || null },
    config.jwtSecret,
    {
      subject: user.email,
      expiresIn: Math.floor(config.jwtExpirationMs / 1000)
    }
  );
}

function requireAuth(db, config) {
  return async (req, _res, next) => {
    try {
      const authorization = req.get("authorization") || "";
      if (!authorization.startsWith("Bearer ")) {
        throw new HttpError(401, "Authentication required");
      }

      const payload = jwt.verify(authorization.slice(7), config.jwtSecret);
      const [rows] = await db.execute(
        `SELECT id, name, email, role, organization_id AS organizationId, enabled
         FROM users WHERE email = ? LIMIT 1`,
        [payload.sub]
      );
      const user = rows[0];
      if (!user || !user.enabled) {
        throw new HttpError(401, "Authentication required");
      }

      req.user = {
        ...user,
        id: Number(user.id),
        organizationId: user.organizationId === null ? null : Number(user.organizationId)
      };
      next();
    } catch (error) {
      if (error instanceof HttpError) return next(error);
      if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
        return next(new HttpError(401, "Authentication required"));
      }
      next(error);
    }
  };
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, "Authentication required"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Access denied"));
    next();
  };
}

module.exports = { createToken, requireAuth, requireRole };
