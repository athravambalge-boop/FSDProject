const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const db = require("../config/db");

let Razorpay = null;
try {
  Razorpay = require("razorpay");
} catch (err) {
  Razorpay = null;
}

const router = express.Router();

const PAYMENT_CURRENCY = process.env.PAYMENT_CURRENCY || "INR";
const PAYMENT_PROVIDER = (process.env.PAYMENT_PROVIDER || "razorpay").toLowerCase();
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "";
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || "";
const CASHFREE_ENV = (process.env.CASHFREE_ENV || "sandbox").toLowerCase();
const APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:5500";

function hasRazorpayConfig() {
  return Boolean(Razorpay && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

function hasCashfreeConfig() {
  return Boolean(CASHFREE_APP_ID && CASHFREE_SECRET_KEY);
}

function getCashfreeBaseUrl() {
  return CASHFREE_ENV === "production"
    ? "https://api.cashfree.com"
    : "https://sandbox.cashfree.com";
}

function toPaise(amount) {
  return Math.round(Number(amount) * 100);
}

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

router.post("/create-order", async (req, res) => {
  try {
    const orderId = parseInt(req.body.order_id, 10);
    if (!orderId) {
      return res.status(400).json({ error: "order_id is required" });
    }

    const [orderRows] = await db.query(
      `SELECT order_id, total_amount, payment_status, payment_method, customer_name, customer_phone, customer_email
       FROM orders
       WHERE order_id = ?`,
      [orderId]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRows[0];
    if (order.payment_status === "paid") {
      return res.status(400).json({ error: "Order already paid" });
    }

    let paymentOrderId = null;
    let provider = "razorpay";
    let keyId = null;
    if (PAYMENT_PROVIDER !== "razorpay") {
      return res.status(400).json({ error: "Only Razorpay online provider is enabled" });
    }

    if (!hasRazorpayConfig()) {
      return res.status(500).json({
        error: "Razorpay is not configured",
        details: "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET"
      });
    }

    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET
    });

    const gatewayOrder = await razorpay.orders.create({
      amount: toPaise(order.total_amount),
      currency: PAYMENT_CURRENCY,
      receipt: `order_${orderId}`,
      notes: {
        app_order_id: String(orderId)
      }
    });

    paymentOrderId = gatewayOrder.id;
    keyId = RAZORPAY_KEY_ID;

    await db.query(
      `UPDATE orders
       SET payment_method = 'online',
           payment_status = 'pending',
           payment_provider = ?,
           payment_order_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?`,
      [provider, paymentOrderId, orderId]
    );

    await db.query(
      `INSERT INTO payment_events (order_id, payment_order_id, event_type, status, amount, gateway_payload)
       VALUES (?, ?, 'created', 'pending', ?, ?)`,
      [orderId, paymentOrderId, order.total_amount, JSON.stringify({ provider })]
    );

    res.json({
      message: "Payment order created",
      order_id: orderId,
      amount: Number(order.total_amount),
      currency: PAYMENT_CURRENCY,
      provider,
      payment_order_id: paymentOrderId,
      key_id: keyId,
      is_mock: false
    });
  } catch (err) {
    console.error("Error creating payment order:", err);
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

router.post("/verify", async (req, res) => {
  let connection;
  try {
    const {
      order_id,
      payment_order_id,
      payment_id,
      payment_signature,
      payment_status,
      gateway_payload
    } = req.body;

    const orderId = parseInt(order_id, 10);
    if (!orderId || !payment_order_id) {
      return res.status(400).json({ error: "order_id and payment_order_id are required" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      `SELECT order_id, total_amount, status, payment_status, payment_provider, payment_order_id
       FROM orders
       WHERE order_id = ? FOR UPDATE`,
      [orderId]
    );

    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRows[0];

    if (order.payment_status === "paid") {
      await connection.commit();
      return res.json({
        message: "Payment already verified",
        order_id: orderId,
        payment_status: "paid"
      });
    }

    if (order.payment_order_id && order.payment_order_id !== payment_order_id) {
      await connection.rollback();
      return res.status(400).json({ error: "payment_order_id does not match order" });
    }

    let isVerified = false;
    let verificationStatus = "failed";

    if (order.payment_provider === "razorpay") {
      if (!payment_id || !payment_signature) {
        await connection.rollback();
        return res.status(400).json({ error: "payment_id and payment_signature are required" });
      }

      const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(`${payment_order_id}|${payment_id}`)
        .digest("hex");

      isVerified = expectedSignature === payment_signature;
      verificationStatus = isVerified ? "paid" : "failed";
    } else {
      await connection.rollback();
      return res.status(400).json({ error: "Unsupported payment provider for verification" });
    }

    if (isVerified) {
      await connection.query(
        `UPDATE orders
         SET payment_status = 'paid',
             payment_id = ?,
             payment_signature = ?,
             paid_at = NOW(),
             status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [payment_id || null, payment_signature || null, orderId]
      );
    } else {
      await connection.query(
        `UPDATE orders
         SET payment_status = 'failed',
             payment_id = ?,
             payment_signature = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [payment_id || null, payment_signature || null, orderId]
      );
    }

    await connection.query(
      `INSERT INTO payment_events (order_id, payment_order_id, payment_id, event_type, status, amount, gateway_payload)
       VALUES (?, ?, ?, 'verification', ?, ?, ?)`,
      [
        orderId,
        payment_order_id,
        payment_id || null,
        verificationStatus,
        Number(order.total_amount),
        JSON.stringify(gateway_payload || req.body || {})
      ]
    );

    await connection.commit();

    res.json({
      message: isVerified ? "Payment verified" : "Payment verification failed",
      order_id: orderId,
      payment_status: verificationStatus
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error verifying payment:", err);
    res.status(500).json({ error: "Failed to verify payment" });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post("/webhook/razorpay", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      return res.status(400).json({ error: "Webhook secret is not configured" });
    }

    const signature = req.headers["x-razorpay-signature"];
    const payloadBuffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}), "utf8");

    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(payloadBuffer)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const payload = Buffer.isBuffer(req.body)
      ? JSON.parse(payloadBuffer.toString("utf8"))
      : req.body;
    const eventType = payload.event;
    const entity = payload.payload?.payment?.entity || payload.payload?.refund?.entity;

    const notes = parseMaybeJson(entity?.notes) || entity?.notes || {};
    const orderId = parseInt(notes.app_order_id, 10);

    if (!orderId) {
      return res.status(200).json({ message: "Webhook ignored: app_order_id missing" });
    }

    const paymentOrderId = entity?.order_id || null;
    const paymentId = entity?.id || null;
    const amount = Number(entity?.amount || 0) / 100;

    let status = "pending";
    if (eventType === "payment.captured") {
      status = "paid";
      await db.query(
        `UPDATE orders
         SET payment_status = 'paid',
             payment_id = ?,
             paid_at = NOW(),
             status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [paymentId, orderId]
      );
    } else if (eventType === "payment.failed") {
      status = "failed";
      await db.query(
        `UPDATE orders
         SET payment_status = 'failed',
             payment_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [paymentId, orderId]
      );
    } else if (eventType === "refund.processed") {
      status = "refunded";
      await db.query(
        `UPDATE orders
         SET payment_status = 'refunded',
             refunded_at = NOW(),
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [orderId]
      );
    }

    await db.query(
      `INSERT INTO payment_events (order_id, payment_order_id, payment_id, event_type, status, amount, gateway_payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderId, paymentOrderId, paymentId, eventType, status, amount, JSON.stringify(payload)]
    );

    res.json({ message: "Webhook processed" });
  } catch (err) {
    console.error("Error processing Razorpay webhook:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

router.post("/webhook/cashfree", async (req, res) => {
  try {
    const payload = req.body || {};
    const data = payload.data || payload;

    const eventType = payload.type || payload.event || "cashfree.event";
    const orderEntity = data.order || data;
    const paymentEntity = data.payment || data;

    const paymentOrderId = orderEntity.cf_order_id || orderEntity.order_id || null;
    const paymentId = paymentEntity.cf_payment_id || paymentEntity.payment_id || null;
    const orderTags = orderEntity.order_tags || {};
    const appOrderId = parseInt(orderTags.app_order_id, 10);

    if (!paymentOrderId && !appOrderId) {
      return res.status(200).json({ message: "Webhook ignored: missing order identifiers" });
    }

    let orderId = appOrderId;
    if (!orderId && paymentOrderId) {
      const [rows] = await db.query(
        `SELECT order_id FROM orders WHERE payment_order_id = ? LIMIT 1`,
        [paymentOrderId]
      );
      if (rows.length > 0) {
        orderId = rows[0].order_id;
      }
    }

    if (!orderId) {
      return res.status(200).json({ message: "Webhook ignored: app order not mapped" });
    }

    const paymentState = String(paymentEntity.payment_status || payload.payment_status || "").toUpperCase();
    let status = "pending";

    if (paymentState === "SUCCESS" || paymentState === "PAID") {
      status = "paid";
      await db.query(
        `UPDATE orders
         SET payment_status = 'paid',
             payment_id = ?,
             paid_at = NOW(),
             status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [paymentId, orderId]
      );
    } else if (paymentState === "FAILED" || paymentState === "USER_DROPPED") {
      status = "failed";
      await db.query(
        `UPDATE orders
         SET payment_status = 'failed',
             payment_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [paymentId, orderId]
      );
    }

    const amount = Number(paymentEntity.payment_amount || orderEntity.order_amount || 0);

    await db.query(
      `INSERT INTO payment_events (order_id, payment_order_id, payment_id, event_type, status, amount, gateway_payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderId, paymentOrderId, paymentId, eventType, status, amount, JSON.stringify(payload)]
    );

    res.json({ message: "Cashfree webhook processed" });
  } catch (err) {
    console.error("Error processing Cashfree webhook:", err);
    res.status(500).json({ error: "Cashfree webhook processing failed" });
  }
});

router.get("/order/:order_id", async (req, res) => {
  try {
    const orderId = parseInt(req.params.order_id, 10);
    if (!orderId) {
      return res.status(400).json({ error: "Invalid order_id" });
    }

    const [paymentRows] = await db.query(
      `SELECT order_id, payment_method, payment_status, payment_provider, payment_order_id, payment_id, paid_at, refunded_at
       FROM orders
       WHERE order_id = ?`,
      [orderId]
    );

    if (paymentRows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const [events] = await db.query(
      `SELECT event_id, payment_order_id, payment_id, event_type, status, amount, created_at
       FROM payment_events
       WHERE order_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [orderId]
    );

    res.json({
      order_payment: paymentRows[0],
      events
    });
  } catch (err) {
    console.error("Error fetching payment details:", err);
    res.status(500).json({ error: "Failed to fetch payment details" });
  }
});

module.exports = router;
