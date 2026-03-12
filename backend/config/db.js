const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Atharva@13",
  database: "messmate_db"
});

module.exports = pool.promise();