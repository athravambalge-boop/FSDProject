const crypto = require("crypto");
const express = require("express");
const db = require("../config/db");

const router = express.Router();

const OTP_EXPIRY_MINUTES = 10;

function validatePhone(phone) {
  return /^[0-9]{10}$/.test(phone);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateName(name) {
  return typeof name === "string" && name.trim().length >= 2 && name.trim().length <= 100;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function buildContactPayload(contactType, value) {
  if (contactType === "phone") {
    const phone = normalizePhone(value);
    return { phone, email: null, identifier: phone };
  }

  const email = normalizeEmail(value);
  return { phone: null, email, identifier: email };
}

function generateVisitorUsername(contactType, identifier) {
  const safeIdentifier = String(identifier)
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 40);

  return `visitor_${contactType}_${safeIdentifier}_${Date.now().toString().slice(-6)}`;
}

async function findExistingUser(connection, contactType, identifier) {
  const column = contactType === "phone" ? "phone" : "email";
  const [rows] = await connection.query(
    `SELECT id, role FROM users WHERE ${column} = ? LIMIT 1`,
    [identifier]
  );

  return rows[0] || null;
}

/* LOGIN ROUTE */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM users WHERE username = ? AND password = ?",
      [username, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: "Invalid username or password"
      });
    }

    const user = rows[0];

    res.json({
      message: "Login successful",
      role: user.role,
      mess_id: user.mess_id,
      username: user.username,
      phone: user.phone || null,
      email: user.email || null,
      contact: user.phone || user.email || user.username
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* REQUEST SIGNUP OTP */
router.post("/request-signup-otp", async (req, res) => {
  try {
    const { fullName, contactType, contactValue } = req.body;

    if (!validateName(fullName)) {
      return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
    }

    if (!["phone", "email"].includes(contactType)) {
      return res.status(400).json({ error: "Contact type must be either phone or email." });
    }

    const { identifier } = buildContactPayload(contactType, contactValue);

    if (contactType === "phone" && !validatePhone(identifier)) {
      return res.status(400).json({ error: "Please enter a valid 10-digit phone number." });
    }

    if (contactType === "email" && !validateEmail(identifier)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const existingUser = await findExistingUser(db, contactType, identifier);
    if (existingUser) {
      return res.status(409).json({
        error: `An account already exists for this ${contactType}. Please use the same device or login with your existing account.`
      });
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));

    await db.query(
      `UPDATE visitor_otps
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE identifier = ? AND contact_type = ? AND consumed_at IS NULL`,
      [identifier, contactType]
    );

    await db.query(
      `INSERT INTO visitor_otps (full_name, identifier, contact_type, otp_code, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [fullName.trim(), identifier, contactType, otpCode, OTP_EXPIRY_MINUTES]
    );

    console.log(`[DEV OTP] ${contactType.toUpperCase()} signup OTP for ${identifier}: ${otpCode}`);

    res.json({
      message: `OTP generated for your ${contactType}.`,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
      devOtp: process.env.NODE_ENV === "production" ? undefined : otpCode
    });
  } catch (err) {
    console.error("OTP request error:", err);
    res.status(500).json({
      error: "Failed to generate OTP. Please try again.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  }
});

/* VERIFY SIGNUP OTP */
router.post("/verify-signup-otp", async (req, res) => {
  let connection;
  try {
    const { fullName, contactType, contactValue, otp } = req.body;

    if (!validateName(fullName)) {
      return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
    }

    if (!["phone", "email"].includes(contactType)) {
      return res.status(400).json({ error: "Contact type must be either phone or email." });
    }

    const normalizedOtp = String(otp || "").trim();
    if (!/^[0-9]{6}$/.test(normalizedOtp)) {
      return res.status(400).json({ error: "OTP must be a 6-digit number." });
    }

    const { phone, email, identifier } = buildContactPayload(contactType, contactValue);

    if (contactType === "phone" && !validatePhone(identifier)) {
      return res.status(400).json({ error: "Please enter a valid 10-digit phone number." });
    }

    if (contactType === "email" && !validateEmail(identifier)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const existingUser = await findExistingUser(connection, contactType, identifier);
    if (existingUser) {
      await connection.rollback();
      return res.status(409).json({
        error: `An account already exists for this ${contactType}.`
      });
    }

    const [otpRows] = await connection.query(
      `SELECT otp_id
       FROM visitor_otps
       WHERE identifier = ?
         AND contact_type = ?
         AND otp_code = ?
         AND consumed_at IS NULL
         AND expires_at >= NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [identifier, contactType, normalizedOtp]
    );

    if (otpRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    const username = generateVisitorUsername(contactType, identifier);
    const generatedPassword = crypto.randomBytes(12).toString("hex");

    const [insertResult] = await connection.query(
      `INSERT INTO users (username, password, phone, email, role)
       VALUES (?, ?, ?, ?, 'visitor')`,
      [username, generatedPassword, phone, email]
    );

    if (phone) {
      await connection.query(
        `INSERT INTO customers (phone, name, email)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email)`,
        [phone, fullName.trim(), email]
      );
    }

    await connection.query(
      `UPDATE visitor_otps
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE otp_id = ?`,
      [otpRows[0].otp_id]
    );

    await connection.commit();

    res.json({
      message: "Account created successfully.",
      account: {
        user_id: insertResult.insertId,
        role: "visitor",
        name: fullName.trim(),
        phone,
        email,
        contact: phone || email,
        username
      }
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error("OTP verification error:", err);
    res.status(500).json({
      error: "Failed to verify OTP. Please try again.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
