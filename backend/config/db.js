require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
   connectionString: process.env.DATABASE_URL,
   ssl: {
      rejectUnauthorized: false
   }
});

pool.connect()
   .then(() => console.log("PostgreSQL Connected"))
   .catch(err => console.log("DB Connection Error:", err));

module.exports = {
   query: (text, params) => pool.query(text, params)
};