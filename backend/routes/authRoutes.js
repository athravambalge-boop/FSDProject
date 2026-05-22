const crypto = require("crypto");
const express = require("express");
const db = require("../config/db");

const router = express.Router();

const OTP_EXPIRY_MINUTES = 10;

function validateUsername(username) {
  return /^[a-zA-Z0-9_]{3,30}$/.test(String(username || "").trim());
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 100;
}

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

async function findExistingUser(connection, contactType, identifier) {
  const column = contactType === "phone" ? "phone" : "email";
  const result = await connection.query(
    `SELECT user_id, role FROM users WHERE ${column} = $1 LIMIT 1`,
    [identifier]
  );
  const rows = result.rows;
  return rows[0] || null;
}

async function getUserByContact(connection, contactType, identifier) {
  const column = contactType === "phone" ? "phone" : "email";
  const result = await connection.query(
    `SELECT user_id, username, role, phone, email FROM users WHERE ${column} = $1 LIMIT 1`,
    [identifier]
  );
  const rows = result.rows;
  return rows[0] || null;
}

async function getUserByUsername(connection, username) {
  const result = await connection.query(
    `SELECT user_id, username, role, phone, email
     FROM users
     WHERE username = $1
     LIMIT 1`,
    [String(username || "").trim()]
  );
  const rows = result.rows;
  return rows[0] || null;
}

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await db.query(
      "SELECT * FROM users WHERE username = $1 AND password = $2",
      [username, password]
    );
    const rows = result.rows;

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
    console.error("Login error:", err.message, err.code);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});


router.post("/register", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Validation
    if (!validateUsername(username)) {
      return res.status(400).json({
        error: "Invalid username. Must be 3-30 characters with letters, numbers, or underscore."
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: "Invalid email address."
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        error: "Password must be between 6 and 100 characters."
      });
    }

    const normalizedEmail = normalizeEmail(email);

    // Check if email already exists
    const existingResult = await db.query(
      `SELECT user_id FROM users WHERE email = $1 LIMIT 1`,
      [normalizedEmail]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: "An account with this email already exists."
      });
    }

    // Check if username already exists
    const usernameResult = await db.query(
      `SELECT user_id FROM users WHERE username = $1 LIMIT 1`,
      [username.trim()]
    );

    if (usernameResult.rows.length > 0) {
      return res.status(409).json({
        error: "Username already taken. Please choose another one."
      });
    }

    // Create new user
    const insertResult = await db.query(
      `INSERT INTO users (username, password, email, role)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, username, email, role`,
      [username.trim(), password, normalizedEmail, role || "visitor"]
    );

    const user = insertResult.rows[0];

    res.status(201).json({
      message: "Account created successfully.",
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(500).json({ error: "Failed to create account.", details: err.message });
  }
});


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
       WHERE identifier = $1 AND contact_type = $2 AND consumed_at IS NULL`,
      [identifier, contactType]
    );

    await db.query(
      `INSERT INTO visitor_otps (full_name, identifier, contact_type, otp_code, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 minute' * $5)`,
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


router.post("/verify-signup-otp", async (req, res) => {
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

    const existingUser = await findExistingUser(db, contactType, identifier);
    if (existingUser) {
      return res.status(409).json({
        error: `An account already exists for this ${contactType}.`
      });
    }

    const result = await db.query(
      `SELECT otp_id
       FROM visitor_otps
       WHERE identifier = $1
         AND contact_type = $2
         AND otp_code = $3
         AND consumed_at IS NULL
         AND expires_at >= NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [identifier, contactType, normalizedOtp]
    );
    const otpRows = result.rows;

    if (otpRows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    res.json({
      message: "OTP verified. You can now set username and password.",
      verified: true
    });
  } catch (err) {
    console.error("OTP verification error:", err);
    res.status(500).json({
      error: "Failed to verify OTP. Please try again.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  }
});


router.post("/complete-signup", async (req, res) => {
  let connection;
  try {
    const {
      fullName,
      contactType,
      contactValue,
      otp,
      username,
      password,
      confirmPassword
    } = req.body;

    if (!validateName(fullName)) {
      return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
    }

    if (!["phone", "email"].includes(contactType)) {
      return res.status(400).json({ error: "Contact type must be either phone or email." });
    }

    const normalizedOtp = String(otp || "").trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({ error: "OTP must be a 6-digit number." });
    }

    const normalizedUsername = String(username || "").trim();
    if (!validateUsername(normalizedUsername)) {
      return res.status(400).json({ error: "Username must be 3-30 characters and can only include letters, numbers, and underscore." });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Password must be between 6 and 100 characters." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Password and confirm password do not match." });
    }

    const { phone, email, identifier } = buildContactPayload(contactType, contactValue);

    if (contactType === "phone" && !validatePhone(identifier)) {
      return res.status(400).json({ error: "Please enter a valid 10-digit phone number." });
    }

    if (contactType === "email" && !validateEmail(identifier)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    connection = await db.pool.connect();
    await connection.query('BEGIN');

    try {
      const result = await connection.query(
        `SELECT 1 FROM users WHERE username = $1 LIMIT 1`,
        [normalizedUsername]
      );
      const usernameRows = result.rows;

      if (usernameRows.length > 0) {
        await connection.query('ROLLBACK');
        connection.release();
        return res.status(409).json({ error: "Username already exists. Please choose another one." });
      }

      const existingUser = await findExistingUser(connection, contactType, identifier);
      if (existingUser) {
        await connection.query('ROLLBACK');
        connection.release();
        return res.status(409).json({ error: `An account already exists for this ${contactType}.` });
      }

      const otpResult = await connection.query(
      `SELECT otp_id
       FROM visitor_otps
       WHERE identifier = $1
         AND contact_type = $2
         AND otp_code = $3
         AND consumed_at IS NULL
         AND expires_at >= NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
        [identifier, contactType, normalizedOtp]
      );
      const otpRows = otpResult.rows;

      if (otpRows.length === 0) {
        await connection.query('ROLLBACK');
        connection.release();
        return res.status(400).json({ error: "Invalid or expired OTP." });
      }

      const insertResult = await connection.query(
        `INSERT INTO users (username, password, phone, email, role)
         VALUES ($1, $2, $3, $4, 'visitor')
         RETURNING user_id`,
        [normalizedUsername, password, phone, email]
      );
      const insertResultRows = insertResult.rows;

      if (phone) {
        await connection.query(
          `INSERT INTO customers (phone, name, email)
           VALUES ($1, $2, $3)
           ON CONFLICT (phone) DO UPDATE SET name = $2, email = $3`,
          [phone, fullName.trim(), email]
        );
      }

      await connection.query(
        `UPDATE visitor_otps
         SET consumed_at = CURRENT_TIMESTAMP
         WHERE otp_id = $1`,
        [otpRows[0].otp_id]
      );

      await connection.query('COMMIT');
    } catch (txErr) {
      await connection.query('ROLLBACK');
      throw txErr;
    } finally {
      connection.release();
    }

    res.json({
      message: "Account created successfully.",
      account: {
        user_id: insertResultRows[0].user_id,
        role: "visitor",
        name: fullName.trim(),
        phone,
        email,
        contact: phone || email,
        username: normalizedUsername
      }
    });
  } catch (err) {
    console.error("Complete signup error:", err);
    res.status(500).json({
      error: "Failed to complete signup. Please try again.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


router.post("/request-password-reset-otp", async (req, res) => {
  try {
    const { contactType, contactValue } = req.body;

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

    const user = await getUserByContact(db, contactType, identifier);
    if (!user) {
      return res.status(404).json({ error: "No account found for this contact." });
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));

    await db.query(
      `UPDATE password_reset_otps
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE identifier = $1 AND contact_type = $2 AND consumed_at IS NULL`,
      [identifier, contactType]
    );

    await db.query(
      `INSERT INTO password_reset_otps (user_id, identifier, contact_type, otp_code, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 minute' * $5)`,
      [user.user_id, identifier, contactType, otpCode, OTP_EXPIRY_MINUTES]
    );

    console.log(`[DEV OTP] ${contactType.toUpperCase()} password reset OTP for ${identifier}: ${otpCode}`);

    res.json({
      message: `Password reset OTP generated for your ${contactType}.`,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
      devOtp: process.env.NODE_ENV === "production" ? undefined : otpCode
    });
  } catch (err) {
    console.error("Password reset OTP request error:", err);
    res.status(500).json({
      error: "Failed to generate password reset OTP. Please try again.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  }
});

/* REQUEST PASSWORD RESET OTP BY USERNAME */
router.post("/request-password-reset-by-username", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();

    if (!validateUsername(username)) {
      return res.status(400).json({ error: "Please enter a valid username." });
    }

    const user = await getUserByUsername(db, username);
    if (!user) {
      return res.status(404).json({ error: "No account found for this username." });
    }

    const normalizedPhone = normalizePhone(user.phone || "");
    const normalizedEmail = normalizeEmail(user.email || "");

    let contactType = "";
    let identifier = "";

    if (validatePhone(normalizedPhone)) {
      contactType = "phone";
      identifier = normalizedPhone;
    } else if (validateEmail(normalizedEmail)) {
      contactType = "email";
      identifier = normalizedEmail;
    } else {
      return res.status(400).json({
        error: "No valid phone number or email is registered for this account."
      });
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));

    await db.query(
      `UPDATE password_reset_otps
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND consumed_at IS NULL`,
      [user.user_id]
    );

    await db.query(
      `INSERT INTO password_reset_otps (user_id, identifier, contact_type, otp_code, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 minute' * $5)`,
      [user.user_id, identifier, contactType, otpCode, OTP_EXPIRY_MINUTES]
    );

    console.log(`[DEV OTP] ${contactType.toUpperCase()} password reset OTP for ${username}: ${otpCode}`);

    res.json({
      message: `OTP sent to registered ${contactType === "phone" ? "phone number" : "email"}.`,
      deliveryMethod: contactType,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
      devOtp: process.env.NODE_ENV === "production" ? undefined : otpCode
    });
  } catch (err) {
    console.error("Password reset by username error:", err);
    res.status(500).json({
      error: "Failed to generate password reset OTP. Please try again.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  }
});

/* VERIFY PASSWORD RESET OTP BY USERNAME */
router.post("/verify-password-reset-by-username", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const normalizedOtp = String(req.body?.otp || "").trim();

    if (!validateUsername(username)) {
      return res.status(400).json({ error: "Please enter a valid username." });
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({ error: "OTP must be a 6-digit number." });
    }

    const user = await getUserByUsername(db, username);
    if (!user) {
      return res.status(404).json({ error: "No account found for this username." });
    }

    const result = await db.query(
      `SELECT reset_otp_id
       FROM password_reset_otps
       WHERE user_id = $1
         AND otp_code = $2
         AND consumed_at IS NULL
         AND expires_at >= NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.user_id, normalizedOtp]
    );
    const otpRows = result.rows;

    if (otpRows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    res.json({
      message: "OTP verified. You can now set a new password.",
      verified: true
    });
  } catch (err) {
    console.error("Verify password reset by username error:", err);
    res.status(500).json({
      error: "Failed to verify OTP. Please try again.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  }
});


router.post("/reset-password-by-username", async (req, res) => {
  let connection;
  try {
    const username = String(req.body?.username || "").trim();
    const normalizedOtp = String(req.body?.otp || "").trim();
    const { newPassword, confirmPassword } = req.body;

    if (!validateUsername(username)) {
      return res.status(400).json({ error: "Please enter a valid username." });
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({ error: "OTP must be a 6-digit number." });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: "Password must be between 6 and 100 characters." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Password and confirm password do not match." });
    }

    connection = await db.pool.connect();
    await connection.query('BEGIN');

    try {
      const user = await getUserByUsername(connection, username);
      if (!user) {
        await connection.query('ROLLBACK');
        connection.release();
        return res.status(404).json({ error: "No account found for this username." });
      }

      const result = await connection.query(
        `SELECT reset_otp_id
         FROM password_reset_otps
         WHERE user_id = $1
           AND otp_code = $2
           AND consumed_at IS NULL
           AND expires_at >= NOW()
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [user.user_id, normalizedOtp]
      );
      const otpRows = result.rows;

      if (otpRows.length === 0) {
        await connection.query('ROLLBACK');
        connection.release();
        return res.status(400).json({ error: "Invalid or expired OTP." });
      }

      await connection.query(
        `UPDATE users
         SET password = $1
         WHERE user_id = $2`,
        [newPassword, user.user_id]
      );

      await connection.query(
        `UPDATE password_reset_otps
         SET consumed_at = CURRENT_TIMESTAMP
         WHERE reset_otp_id = $1`,
        [otpRows[0].reset_otp_id]
      );

      await connection.query('COMMIT');

      res.json({ message: "Password reset successful." });
    } catch (txErr) {
      await connection.query('ROLLBACK');
      throw txErr;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Reset password by username error:", err);
    res.status(500).json({
      error: "Failed to reset password. Please try again.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  }
});


router.post("/verify-password-reset-otp", async (req, res) => {
  try {
    const { contactType, contactValue, otp } = req.body;

    if (!["phone", "email"].includes(contactType)) {
      return res.status(400).json({ error: "Contact type must be either phone or email." });
    }

    const normalizedOtp = String(otp || "").trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({ error: "OTP must be a 6-digit number." });
    }

    const { identifier } = buildContactPayload(contactType, contactValue);

    if (contactType === "phone" && !validatePhone(identifier)) {
      return res.status(400).json({ error: "Please enter a valid 10-digit phone number." });
    }

    if (contactType === "email" && !validateEmail(identifier)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const result = await db.query(
      `SELECT reset_otp_id
       FROM password_reset_otps
       WHERE identifier = $1
         AND contact_type = $2
         AND otp_code = $3
         AND consumed_at IS NULL
         AND expires_at >= NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [identifier, contactType, normalizedOtp]
    );
    const otpRows = result.rows;

    if (otpRows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    res.json({
      message: "OTP verified. You can now set a new password.",
      verified: true
    });
  } catch (err) {
    console.error("Password reset OTP verify error:", err);
    res.status(500).json({
      error: "Failed to verify password reset OTP. Please try again.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  }
});


router.post("/reset-password", async (req, res) => {
  let connection;
  try {
    const { contactType, contactValue, otp, newPassword, confirmPassword } = req.body;

    if (!["phone", "email"].includes(contactType)) {
      return res.status(400).json({ error: "Contact type must be either phone or email." });
    }

    const normalizedOtp = String(otp || "").trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({ error: "OTP must be a 6-digit number." });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: "Password must be between 6 and 100 characters." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Password and confirm password do not match." });
    }

    const { identifier } = buildContactPayload(contactType, contactValue);

    if (contactType === "phone" && !validatePhone(identifier)) {
      return res.status(400).json({ error: "Please enter a valid 10-digit phone number." });
    }

    if (contactType === "email" && !validateEmail(identifier)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    connection = await db.pool.connect();
    await connection.query('BEGIN');

    try {
      const result = await connection.query(
        `SELECT reset_otp_id, user_id
         FROM password_reset_otps
         WHERE identifier = $1
           AND contact_type = $2
           AND otp_code = $3
           AND consumed_at IS NULL
           AND expires_at >= NOW()
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [identifier, contactType, normalizedOtp]
      );
      const otpRows = result.rows;

      if (otpRows.length === 0) {
        await connection.query('ROLLBACK');
        connection.release();
        return res.status(400).json({ error: "Invalid or expired OTP." });
      }

      await connection.query(
        `UPDATE users
         SET password = $1
         WHERE user_id = $2`,
        [newPassword, otpRows[0].user_id]
      );

      await connection.query(
        `UPDATE password_reset_otps
         SET consumed_at = CURRENT_TIMESTAMP
         WHERE reset_otp_id = $1`,
        [otpRows[0].reset_otp_id]
      );

      await connection.query('COMMIT');

      res.json({ message: "Password reset successful." });
    } catch (txErr) {
      await connection.query('ROLLBACK');
      throw txErr;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      error: "Failed to reset password. Please try again.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  }
});

module.exports = router;
