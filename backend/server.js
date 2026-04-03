require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

function buildAllowedOrigins() {
   const defaults = [
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://athravambalge-boop.github.io"
   ];

   const extra = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

   return [...new Set([...defaults, ...extra])];
}

const allowedOrigins = buildAllowedOrigins();

function mapLegacyPhonePeEnvNames() {
   const envPath = path.join(__dirname, ".env");
   if (!fs.existsSync(envPath)) return;

   const envText = fs.readFileSync(envPath, "utf8");
   const findValue = (key) => {
      const regex = new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, "mi");
      const match = envText.match(regex);
      return match ? match[1].trim() : "";
   };

   if (!process.env["Client Id"]) {
      process.env["Client Id"] = findValue("PHONEPE_MERCHANT_ID");
   }

   if (!process.env["Client Secret"]) {
      process.env["Client Secret"] = findValue("PHONEPE_SALT_KEY");
   }

   if (!process.env["Key Index"]) {
      const legacyIndex = findValue("PHONEPE_SALT_INDEX");
      if (legacyIndex) process.env["Key Index"] = legacyIndex;
   }
}

mapLegacyPhonePeEnvNames();

/* -------------------------
   MIDDLEWARE
--------------------------*/
app.use(
   cors({
      origin(origin, callback) {
         // Allow same-origin or non-browser clients that do not send Origin.
         if (!origin) return callback(null, true);
         if (allowedOrigins.includes(origin)) return callback(null, true);
         return callback(new Error("Not allowed by CORS"));
      }
   })
);

app.use(express.json());

/* -------------------------
   ROUTES
--------------------------*/
const authRoutes = require("./routes/authRoutes");
const messRoutes = require("./routes/messRoutes");
const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/mess", messRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/", (req, res) => {
  res.send("Backend running successfully");
});

async function ensureWalletSchema() {
   async function addColumnIfMissing(tableName, columnName, definition) {
      const [rows] = await db.query(
         `SELECT 1
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?
          LIMIT 1`,
         [tableName, columnName]
      );

      if (rows.length === 0) {
         await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
      }
   }

   // Add wallet columns if missing
   await addColumnIfMissing("customers", "wallet_balance", "DECIMAL(10,2) DEFAULT 0");
   await addColumnIfMissing("orders", "wallet_used", "DECIMAL(10,2) DEFAULT 0");
   await addColumnIfMissing("orders", "cashback_earned", "DECIMAL(10,2) DEFAULT 0");

   // Wallet transaction ledger for credits/debits
   await db.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
         transaction_id INT AUTO_INCREMENT PRIMARY KEY,
         customer_phone VARCHAR(20) NOT NULL,
         type ENUM('credit', 'debit') NOT NULL,
         amount DECIMAL(10,2) NOT NULL,
         reference_order_id INT NULL,
         note VARCHAR(255),
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         INDEX idx_wallet_customer_phone (customer_phone),
         INDEX idx_wallet_created_at (created_at)
      )
   `);
}

async function ensurePaymentSchema() {
   async function addColumnIfMissing(tableName, columnName, definition) {
      const [rows] = await db.query(
         `SELECT 1
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?
          LIMIT 1`,
         [tableName, columnName]
      );

      if (rows.length === 0) {
         await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
      }
   }

   async function addIndexIfMissing(tableName, indexName, indexColumnsSql) {
      const [rows] = await db.query(
         `SELECT 1
          FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND INDEX_NAME = ?
          LIMIT 1`,
         [tableName, indexName]
      );

      if (rows.length === 0) {
         await db.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} (${indexColumnsSql})`);
      }
   }

   await addColumnIfMissing("orders", "payment_method", "ENUM('cash', 'online') DEFAULT 'online'");
   await addColumnIfMissing("orders", "payment_status", "ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending'");
   await addColumnIfMissing("orders", "payment_provider", "VARCHAR(50) DEFAULT NULL");
   await addColumnIfMissing("orders", "payment_order_id", "VARCHAR(100) DEFAULT NULL");
   await addColumnIfMissing("orders", "payment_id", "VARCHAR(100) DEFAULT NULL");
   await addColumnIfMissing("orders", "payment_signature", "VARCHAR(255) DEFAULT NULL");
   await addColumnIfMissing("orders", "paid_at", "DATETIME NULL");
   await addColumnIfMissing("orders", "refunded_at", "DATETIME NULL");

   // Ensure enum includes Pine Labs option for older schemas
   await db.query(
      "ALTER TABLE orders MODIFY COLUMN payment_method ENUM('cash', 'online') DEFAULT 'online'"
   );
   await addIndexIfMissing("orders", "idx_payment_status", "payment_status");
   await addIndexIfMissing("orders", "idx_payment_order_id", "payment_order_id");

   await db.query(`
      CREATE TABLE IF NOT EXISTS payment_events (
         event_id INT AUTO_INCREMENT PRIMARY KEY,
         order_id INT NOT NULL,
         payment_order_id VARCHAR(100) NULL,
         payment_id VARCHAR(100) NULL,
         event_type VARCHAR(50) NOT NULL,
         status VARCHAR(50) NOT NULL,
         amount DECIMAL(10,2) NOT NULL,
         gateway_payload JSON NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         INDEX idx_payment_events_order_id (order_id),
         INDEX idx_payment_events_payment_id (payment_id),
         CONSTRAINT fk_payment_events_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )
   `);
}

async function ensureAuthSchema() {
   async function addColumnIfMissing(tableName, columnName, definition) {
      const [rows] = await db.query(
         `SELECT 1
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?
          LIMIT 1`,
         [tableName, columnName]
      );

      if (rows.length === 0) {
         await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
      }
   }

   async function addIndexIfMissing(tableName, indexName, indexSql) {
      const [rows] = await db.query(
         `SELECT 1
          FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND INDEX_NAME = ?
          LIMIT 1`,
         [tableName, indexName]
      );

      if (rows.length === 0) {
         await db.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} (${indexSql})`);
      }
   }

   await addColumnIfMissing("users", "phone", "VARCHAR(20) NULL");
   await addColumnIfMissing("users", "email", "VARCHAR(150) NULL");
   await addIndexIfMissing("users", "idx_users_phone", "phone");
   await addIndexIfMissing("users", "idx_users_email", "email");

   await db.query(`
      CREATE TABLE IF NOT EXISTS visitor_otps (
         otp_id INT AUTO_INCREMENT PRIMARY KEY,
         full_name VARCHAR(100) NOT NULL,
         identifier VARCHAR(150) NOT NULL,
         contact_type ENUM('phone', 'email') NOT NULL,
         otp_code VARCHAR(6) NOT NULL,
         expires_at DATETIME NOT NULL,
         consumed_at DATETIME NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         INDEX idx_visitor_otps_identifier (identifier),
         INDEX idx_visitor_otps_contact_type (contact_type),
         INDEX idx_visitor_otps_expires_at (expires_at)
      )
   `);
}

/* -------------------------
   START SERVER
--------------------------*/
Promise.all([ensureWalletSchema(), ensurePaymentSchema(), ensureAuthSchema()])
   .then(() => {
      app.listen(PORT, () => {
         console.log(`Server running at http://localhost:${PORT}`);
      });
   })
   .catch((err) => {
      console.error("Failed to initialize database schema:", err);
      process.exit(1);
   });
