require("dotenv").config();

const { Pool } = require("pg");

// Validate DATABASE_URL at startup
if (!process.env.DATABASE_URL) {
   console.error("ERROR: DATABASE_URL environment variable is not set!");
   console.error("Please set DATABASE_URL to your PostgreSQL connection string on Render.");
   process.exit(1);
}

console.log("DATABASE_URL is set, attempting connection...");

const pool = new Pool({
   connectionString: process.env.DATABASE_URL,
   ssl: {
      rejectUnauthorized: false
   }
});

pool.on("connect", () => {
   console.log("✓ PostgreSQL Connected successfully");
});

pool.on("error", (err) => {
   console.error("✗ Unexpected DB Error:", err.message);
});

module.exports = {
   query: (text, params) => pool.query(text, params),
   pool
};