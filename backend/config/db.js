const mysql = require("mysql2");

function buildPoolConfig() {
  const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.JAWSDB_URL;

  if (databaseUrl) {
    const parsedUrl = new URL(databaseUrl);

    return {
      host: parsedUrl.hostname,
      user: decodeURIComponent(parsedUrl.username),
      password: decodeURIComponent(parsedUrl.password),
      database: parsedUrl.pathname.replace(/^\//, ""),
      port: Number(parsedUrl.port || 3306),
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
      queueLimit: 0
    };
  }

  const hasExplicitDbConfig = process.env.DB_HOST || process.env.DB_USER || process.env.DB_PASSWORD || process.env.DB_NAME;

  if (!hasExplicitDbConfig && process.env.RENDER) {
    throw new Error(
      "Missing database configuration on Render. Set DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, and DB_PORT."
    );
  }

  return {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "messmate_db",
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0
  };
}

const pool = mysql.createPool(buildPoolConfig());

module.exports = pool.promise();