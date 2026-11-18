async function createInitialAdmin(connection, { name, email, passwordHash }) {
  const [lockRows] = await connection.query(
    "SELECT GET_LOCK('greenpulse_initial_admin_bootstrap', 10) AS acquired"
  );
  if (Number(lockRows[0]?.acquired) !== 1) {
    throw new Error("Could not acquire the initial administrator setup lock");
  }

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT COUNT(*) AS count FROM users");
    if (Number(rows[0]?.count) !== 0) {
      throw new Error("Bootstrap is only allowed when the users table is empty");
    }

    const [result] = await connection.execute(
      `INSERT INTO users (name, email, password, role, organization_id, enabled)
       VALUES (?, ?, ?, 'SUPER_ADMIN', NULL, TRUE)`,
      [name, email, passwordHash]
    );
    await connection.commit();
    return Number(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.query("SELECT RELEASE_LOCK('greenpulse_initial_admin_bootstrap')");
  }
}

module.exports = { createInitialAdmin };
