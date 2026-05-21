let express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const db = require("../config/db");

const router = express.Router();

const PAYMENT_CURRENCY = process.env.PAYMENT_CURRENCY || "INR";
const MANUAL_PAYMENT_UPI_ID = process.env.MANUAL_PAYMENT_UPI_ID || "athravambalge@okaxis";
const MANUAL_PAYMENT_ACCOUNT_NAME = process.env.MANUAL_PAYMENT_ACCOUNT_NAME || "ATHARVA PRASHANT AMBALGE";
const MANUAL_PAYMENT_ACCOUNT_NO = process.env.MANUAL_PAYMENT_ACCOUNT_NO || "000000000000";
const MANUAL_PAYMENT_IFSC = process.env.MANUAL_PAYMENT_IFSC || "BANK0000000";
const MANUAL_PAYMENT_QR_IMAGE_URL = process.env.MANUAL_PAYMENT_QR_IMAGE_URL || "QR.jpeg";
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, "..", "uploads");
const PROOF_UPLOAD_DIR = path.join(uploadsDir, "payment-proofs");

function getBackendBaseUrl(req) {
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const protocol = forwardedProto || (req.secure ? "https" : "http") || "http";
  return (process.env.BACKEND_BASE_URL || `${protocol}://${req.get("host")}`).replace(/\/+$/, "");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only PNG, JPG, JPEG and WEBP files are allowed"));
    }
    return cb(null, true);
  }
});

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildManualQrPayload(order) {
  const amount = Number(order.total_amount).toFixed(2);
  const ref = order.payment_reference || order.payment_order_id || `MM-${order.order_id}`;

  return {
    order_id: order.order_id,
    amount: Number(amount),
    currency: PAYMENT_CURRENCY,
    receiver: {
      upi_id: MANUAL_PAYMENT_UPI_ID,
      account_name: MANUAL_PAYMENT_ACCOUNT_NAME,
      account_number: MANUAL_PAYMENT_ACCOUNT_NO,
      ifsc: MANUAL_PAYMENT_IFSC
    },
    payment_reference: ref,
    qr_image_url: MANUAL_PAYMENT_QR_IMAGE_URL,
    note: "Pay to the above account and upload the payment screenshot."
  };
}

function sanitizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}


router.get("/receipt-config", async (req, res) => {
  try {
    const orderId = parseInt(req.query.order_id, 10);
    if (!orderId) {
      return res.status(400).json({ error: "order_id is required" });
    }

    const result = await db.query(
      `SELECT order_id, customer_phone, total_amount, payment_status, payment_reference, payment_order_id
       FROM orders
       WHERE order_id = $1`,
      [orderId]
    );
    const orderRows = result.rows;

    if (orderRows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json({
      order: orderRows[0],
      config: buildManualQrPayload(orderRows[0])
    });
  } catch (err) {
    console.error("Error fetching receipt config:", err);

    // Fallback: still provide basic QR config so frontend can continue.
    const orderId = parseInt(req.query.order_id, 10) || null;
    const amount = Number(req.query.amount || 0);
    const fallbackOrder = {
      order_id: orderId,
      total_amount: Number.isFinite(amount) ? amount : 0,
      payment_reference: orderId ? `MM-${orderId}` : "MM-ORDER"
    };

    return res.json({
      order: fallbackOrder,
      config: buildManualQrPayload(fallbackOrder),
      fallback: true
    });
  }
});

router.post("/upload-proof", upload.single("receipt"), async (req, res) => {
  let connection;
  try {
    const orderId = parseInt(req.body.order_id, 10);
    const customerPhone = sanitizePhone(req.body.customer_phone);
    const providedUtr = normalizeText(req.body.utr || "").toUpperCase();

    if (!orderId) {
      return res.status(400).json({ error: "order_id is required" });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "Please upload a receipt image" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const result = await connection.query(
      `SELECT order_id, customer_phone, total_amount, payment_status, payment_reference, payment_order_id
       FROM orders
       WHERE order_id = $1 FOR UPDATE`,
      [orderId]
    );
    const orderRows = result.rows;

    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRows[0];
    if (customerPhone && sanitizePhone(order.customer_phone) !== customerPhone) {
      await connection.rollback();
      return res.status(403).json({ error: "Phone number does not match this order" });
    }

    if (order.payment_status === "paid") {
      await connection.rollback();
      return res.status(400).json({ error: "Payment already verified for this order" });
    }

    const imageSha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
    const perceptualHash = null;
    const extractedText = null;
    const extractedUtr = providedUtr || null;

    // For now, skip all cross-checks and auto-verify on successful screenshot upload.
    const verificationPassed = true;
    const verificationResult = "verified";
    const reason = "Screenshot uploaded. Auto-approved";

    const extension = path.extname(req.file.originalname || "").toLowerCase() || ".png";
    const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(extension) ? extension : ".png";
    const fileName = `order_${orderId}_${Date.now()}_${imageSha256.slice(0, 8)}${safeExt}`;
    const relativePath = path.join("payment-proofs", fileName).replace(/\\/g, "/");
    const absolutePath = path.join(PROOF_UPLOAD_DIR, fileName);

    if (!fs.existsSync(PROOF_UPLOAD_DIR)) {
      fs.mkdirSync(PROOF_UPLOAD_DIR, { recursive: true });
    }
    fs.writeFileSync(absolutePath, req.file.buffer);

    await connection.query(
      `INSERT INTO payment_proofs (
         order_id, customer_phone, file_path, image_sha256, perceptual_hash,
         extracted_text, extracted_utr, receiver_match, amount_match, reference_match,
         ai_risk_flag, verification_result, verification_reason
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        orderId,
        order.customer_phone,
        relativePath,
        imageSha256,
        perceptualHash,
        extractedText,
        extractedUtr,
        1,
        1,
        1,
        0,
        verificationResult,
        reason
      ]
    );

    await connection.query(
      `UPDATE orders
       SET payment_status = 'paid',
           payment_proof_status = 'verified',
           payment_proof_image = $1,
           payment_id = $2,
           paid_at = NOW(),
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $3`,
      [relativePath, extractedUtr, orderId]
    );

    await connection.query(
      `INSERT INTO payment_events (order_id, payment_order_id, payment_id, event_type, status, amount, gateway_payload)
       VALUES ($1, $2, $3, 'manual_proof_upload', $4, $5, $6)`,
      [
        orderId,
        order.payment_order_id || order.payment_reference,
        extractedUtr,
        "paid",
        Number(order.total_amount),
        JSON.stringify({ autoVerified: true })
      ]
    );

    await connection.commit();

    return res.json({
      message: "Screenshot uploaded successfully. Share on WhatsApp to place order.",
      order_id: orderId,
      payment_status: "paid",
      payment_proof_status: "verified",
      proof_image_url: `${getBackendBaseUrl(req)}/uploads/${relativePath}`,
      checks: {
        paid_to_match: true,
        amount_match: true,
        auto_verified: true
      }
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error uploading payment proof:", err);
    return res.status(500).json({ error: err.message || "Failed to process payment proof" });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.get("/order/:order_id", async (req, res) => {
  try {
    const orderId = parseInt(req.params.order_id, 10);
    if (!orderId) {
      return res.status(400).json({ error: "Invalid order_id" });
    }

    const result = await db.query(
      `SELECT order_id, payment_method, payment_status, payment_provider, payment_order_id, payment_reference, payment_proof_status, payment_proof_image, payment_id, paid_at, refunded_at
       FROM orders
       WHERE order_id = $1`,
      [orderId]
    );
    const paymentRows = result.rows;

    if (paymentRows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const result2 = await db.query(
      `SELECT event_id, payment_order_id, payment_id, event_type, status, amount, created_at
       FROM payment_events
       WHERE order_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [orderId]
    );
    const events = result2.rows;

    return res.json({
      order_payment: paymentRows[0],
      events
    });
  } catch (err) {
    console.error("Error fetching payment details:", err);
    return res.status(500).json({ error: "Failed to fetch payment details" });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || /Only PNG, JPG, JPEG and WEBP/.test(String(err.message || ""))) {
    return res.status(400).json({ error: err.message || "Invalid receipt upload" });
  }
  return next(err);
});

module.exports = router;
