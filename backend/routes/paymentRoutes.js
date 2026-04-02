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
const PAYMENT_PROVIDER = (process.env.PAYMENT_PROVIDER || "phonepe").toLowerCase();
const APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:5500";
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:5000";

const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || "";
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY || "";
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";
const PHONEPE_ENV = (process.env.PHONEPE_ENV || "sandbox").toLowerCase();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

function toPaise(amount) {
  return Math.round(Number(amount) * 100);
}

function toRupees(amountInPaise) {
  return Number((Number(amountInPaise || 0) / 100).toFixed(2));
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

function hasPhonePeConfig() {
  return Boolean(PHONEPE_MERCHANT_ID && PHONEPE_SALT_KEY && PHONEPE_SALT_INDEX);
}

function hasRazorpayConfig() {
  return Boolean(Razorpay && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

function getPhonePeBaseUrl() {
  return PHONEPE_ENV === "production"
    ? "https://api.phonepe.com/apis/hermes"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";
}

function sanitizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function createPhonePeHeaders(payloadBase64, apiPath) {
  const checksumSource = `${payloadBase64}${apiPath}${PHONEPE_SALT_KEY}`;
  const checksum = crypto.createHash("sha256").update(checksumSource).digest("hex");

  return {
    "Content-Type": "application/json",
    "X-VERIFY": `${checksum}###${PHONEPE_SALT_INDEX}`,
    "X-MERCHANT-ID": PHONEPE_MERCHANT_ID
  };
}

function createPhonePeStatusHeaders(apiPath) {
  const checksumSource = `${apiPath}${PHONEPE_SALT_KEY}`;
  const checksum = crypto.createHash("sha256").update(checksumSource).digest("hex");

  return {
    accept: "application/json",
    "X-VERIFY": `${checksum}###${PHONEPE_SALT_INDEX}`,
    "X-MERCHANT-ID": PHONEPE_MERCHANT_ID
  };
}

function mapPhonePeStateToStatus(state, code) {
  const normalizedState = String(state || "").toUpperCase();
  const normalizedCode = String(code || "").toUpperCase();

  if (["COMPLETED", "SUCCESS", "PAYMENT_SUCCESS"].includes(normalizedState) || normalizedCode === "PAYMENT_SUCCESS") {
    return "paid";
  }

  if (["FAILED", "PAYMENT_ERROR", "DECLINED", "EXPIRED"].includes(normalizedState) || normalizedCode === "PAYMENT_ERROR") {
    return "failed";
  }

  return "pending";
}

async function fetchPhonePeStatus(merchantTransactionId) {
  const apiPath = `/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;
  const statusResponse = await axios.get(`${getPhonePeBaseUrl()}${apiPath}`, {
    headers: createPhonePeStatusHeaders(apiPath),
    timeout: 15000
  });

  const gatewayPayload = statusResponse.data || {};
  const data = gatewayPayload.data || {};
  const paymentStatus = mapPhonePeStateToStatus(data.state, gatewayPayload.code);

  return {
    paymentStatus,
    paymentId: data.transactionId || data.providerReferenceId || null,
    gatewayPayload,
    amount: toRupees(data.amount || 0)
  };
}

async function createPhonePeOrder(order) {
  if (!hasPhonePeConfig()) {
    return {
      error: {
        status: 500,
        body: {
          error: "PhonePe is not configured",
          details: "Set PHONEPE_MERCHANT_ID, PHONEPE_SALT_KEY and PHONEPE_SALT_INDEX"
        }
      }
    };
  }

  const merchantTransactionId = `MM_${order.order_id}_${Date.now()}`;
  const redirectUrl = `${APP_BASE_URL}/payment-status.html?order_id=${order.order_id}&txnid=${encodeURIComponent(merchantTransactionId)}`;
  const callbackUrl = `${BACKEND_BASE_URL}/api/payments/webhook/phonepe`;

  const phonePePayload = {
    merchantId: PHONEPE_MERCHANT_ID,
    merchantTransactionId,
    merchantUserId: `USER_${sanitizePhone(order.customer_phone) || order.order_id}`,
    amount: toPaise(order.total_amount),
    redirectUrl,
    redirectMode: "REDIRECT",
    callbackUrl,
    mobileNumber: sanitizePhone(order.customer_phone),
    paymentInstrument: {
      type: "PAY_PAGE"
    }
  };

  const apiPath = "/pg/v1/pay";
  const payloadBase64 = Buffer.from(JSON.stringify(phonePePayload), "utf8").toString("base64");

  const phonePeResponse = await axios.post(
    `${getPhonePeBaseUrl()}${apiPath}`,
    { request: payloadBase64 },
    {
      headers: createPhonePeHeaders(payloadBase64, apiPath),
      timeout: 15000
    }
  );

  const responsePayload = phonePeResponse.data || {};
  const responseData = responsePayload.data || {};
  const paymentPageUrl =
    responseData.instrumentResponse?.redirectInfo?.url ||
    responseData.redirectUrl ||
    null;

  if (!paymentPageUrl) {
    throw new Error("PhonePe did not return a redirect URL");
  }

  return {
    provider: "phonepe",
    paymentOrderId: merchantTransactionId,
    redirectUrl: paymentPageUrl,
    gatewayPayload: {
      request: phonePePayload,
      response: responsePayload
    }
  };
}

async function createRazorpayOrder(order) {
  if (!hasRazorpayConfig()) {
    return {
      error: {
        status: 500,
        body: {
          error: "Razorpay is not configured",
          details: "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET"
        }
      }
    };
  }

  const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
  });

  const gatewayOrder = await razorpay.orders.create({
    amount: toPaise(order.total_amount),
    currency: PAYMENT_CURRENCY,
    receipt: `order_${order.order_id}`,
    notes: {
      app_order_id: String(order.order_id)
    }
  });

  return {
    provider: "razorpay",
    paymentOrderId: gatewayOrder.id,
    keyId: RAZORPAY_KEY_ID,
    gatewayPayload: {
      id: gatewayOrder.id,
      amount: gatewayOrder.amount,
      currency: gatewayOrder.currency
    }
  };
}

router.post("/create-order", async (req, res) => {
  try {
    const orderId = parseInt(req.body.order_id, 10);
    if (!orderId) {
      return res.status(400).json({ error: "order_id is required" });
    }

    const [orderRows] = await db.query(
      `SELECT order_id, total_amount, payment_status, customer_phone
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

    let gatewayOrder = null;

    if (PAYMENT_PROVIDER === "phonepe") {
      gatewayOrder = await createPhonePeOrder(order);
    } else if (PAYMENT_PROVIDER === "razorpay") {
      gatewayOrder = await createRazorpayOrder(order);
    } else {
      return res.status(400).json({ error: `Unsupported PAYMENT_PROVIDER: ${PAYMENT_PROVIDER}` });
    }

    if (gatewayOrder?.error) {
      return res.status(gatewayOrder.error.status).json(gatewayOrder.error.body);
    }

    await db.query(
      `UPDATE orders
       SET payment_method = 'online',
           payment_status = 'pending',
           payment_provider = ?,
           payment_order_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?`,
      [gatewayOrder.provider, gatewayOrder.paymentOrderId, orderId]
    );

    await db.query(
      `INSERT INTO payment_events (order_id, payment_order_id, event_type, status, amount, gateway_payload)
       VALUES (?, ?, 'created', 'pending', ?, ?)`,
      [orderId, gatewayOrder.paymentOrderId, order.total_amount, JSON.stringify(gatewayOrder.gatewayPayload || {})]
    );

    return res.json({
      message: "Payment order created",
      order_id: orderId,
      amount: Number(order.total_amount),
      currency: PAYMENT_CURRENCY,
      provider: gatewayOrder.provider,
      payment_order_id: gatewayOrder.paymentOrderId,
      key_id: gatewayOrder.keyId || null,
      redirect_url: gatewayOrder.redirectUrl || null,
      is_mock: false
    });
  } catch (err) {
    const gatewayError = err?.response?.data || null;
    const statusCode = err?.response?.status || 500;
    const details =
      gatewayError?.message ||
      gatewayError?.code ||
      gatewayError?.error ||
      gatewayError?.errorMessage ||
      err?.message ||
      "Unknown gateway error";

    console.error("Error creating payment order:", gatewayError || err.message || err);
    return res.status(statusCode).json({
      error: "Failed to create payment order",
      details,
      gateway_error: gatewayError
    });
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
      gateway_payload
    } = req.body;

    const orderId = parseInt(order_id, 10);
    if (!orderId) {
      return res.status(400).json({ error: "order_id is required" });
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

    const effectivePaymentOrderId = payment_order_id || order.payment_order_id;

    if (!effectivePaymentOrderId) {
      await connection.rollback();
      return res.status(400).json({ error: "payment_order_id is required" });
    }

    if (order.payment_order_id && order.payment_order_id !== effectivePaymentOrderId) {
      await connection.rollback();
      return res.status(400).json({ error: "payment_order_id does not match order" });
    }

    let verificationStatus = "failed";
    let resolvedPaymentId = payment_id || null;
    let resolvedSignature = payment_signature || null;
    let resolvedPayload = gateway_payload || null;

    if (order.payment_provider === "razorpay") {
      if (!payment_id || !payment_signature) {
        await connection.rollback();
        return res.status(400).json({ error: "payment_id and payment_signature are required" });
      }

      const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(`${effectivePaymentOrderId}|${payment_id}`)
        .digest("hex");

      const isVerified = expectedSignature === payment_signature;
      verificationStatus = isVerified ? "paid" : "failed";
    } else if (order.payment_provider === "phonepe") {
      if (!hasPhonePeConfig()) {
        await connection.rollback();
        return res.status(500).json({ error: "PhonePe is not configured" });
      }

      const phonePeStatus = await fetchPhonePeStatus(effectivePaymentOrderId);
      verificationStatus = phonePeStatus.paymentStatus;
      resolvedPaymentId = phonePeStatus.paymentId;
      resolvedSignature = null;
      resolvedPayload = phonePeStatus.gatewayPayload;
    } else {
      await connection.rollback();
      return res.status(400).json({ error: "Unsupported payment provider for verification" });
    }

    if (verificationStatus === "paid") {
      await connection.query(
        `UPDATE orders
         SET payment_status = 'paid',
             payment_id = ?,
             payment_signature = ?,
             paid_at = NOW(),
             status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [resolvedPaymentId, resolvedSignature, orderId]
      );
    } else if (verificationStatus === "failed") {
      await connection.query(
        `UPDATE orders
         SET payment_status = 'failed',
             payment_id = ?,
             payment_signature = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [resolvedPaymentId, resolvedSignature, orderId]
      );
    }

    await connection.query(
      `INSERT INTO payment_events (order_id, payment_order_id, payment_id, event_type, status, amount, gateway_payload)
       VALUES (?, ?, ?, 'verification', ?, ?, ?)`,
      [
        orderId,
        effectivePaymentOrderId,
        resolvedPaymentId,
        verificationStatus,
        Number(order.total_amount),
        JSON.stringify(resolvedPayload || req.body || {})
      ]
    );

    await connection.commit();

    return res.json({
      message: verificationStatus === "paid" ? "Payment verified" : "Payment is pending/failed",
      order_id: orderId,
      payment_status: verificationStatus
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error verifying payment:", err?.response?.data || err.message || err);
    return res.status(500).json({ error: "Failed to verify payment" });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post("/webhook/phonepe", async (req, res) => {
  try {
    const rawPayload = req.body || {};
    let payload = rawPayload;

    if (rawPayload.response) {
      try {
        const decoded = Buffer.from(String(rawPayload.response), "base64").toString("utf8");
        payload = JSON.parse(decoded);
      } catch (err) {
        payload = rawPayload;
      }
    }

    const data = payload.data || payload;
    const merchantTransactionId =
      data.merchantTransactionId ||
      data.transactionId ||
      rawPayload.merchantTransactionId ||
      null;

    if (!merchantTransactionId) {
      return res.status(200).json({ message: "Webhook ignored: missing merchantTransactionId" });
    }

    const [orderRows] = await db.query(
      `SELECT order_id, total_amount FROM orders WHERE payment_order_id = ? LIMIT 1`,
      [merchantTransactionId]
    );

    if (orderRows.length === 0) {
      return res.status(200).json({ message: "Webhook ignored: order mapping not found" });
    }

    const order = orderRows[0];
    const status = mapPhonePeStateToStatus(data.state, payload.code || data.code);
    const paymentId = data.transactionId || data.providerReferenceId || null;

    if (status === "paid") {
      await db.query(
        `UPDATE orders
         SET payment_status = 'paid',
             payment_id = ?,
             paid_at = NOW(),
             status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [paymentId, order.order_id]
      );
    } else if (status === "failed") {
      await db.query(
        `UPDATE orders
         SET payment_status = 'failed',
             payment_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [paymentId, order.order_id]
      );
    }

    await db.query(
      `INSERT INTO payment_events (order_id, payment_order_id, payment_id, event_type, status, amount, gateway_payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        order.order_id,
        merchantTransactionId,
        paymentId,
        "phonepe.webhook",
        status,
        Number(order.total_amount),
        JSON.stringify(payload)
      ]
    );

    return res.json({ message: "PhonePe webhook processed" });
  } catch (err) {
    console.error("Error processing PhonePe webhook:", err);
    return res.status(500).json({ error: "PhonePe webhook processing failed" });
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

    return res.json({ message: "Razorpay webhook processed" });
  } catch (err) {
    console.error("Error processing Razorpay webhook:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
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

    return res.json({
      order_payment: paymentRows[0],
      events
    });
  } catch (err) {
    console.error("Error fetching payment details:", err);
    return res.status(500).json({ error: "Failed to fetch payment details" });
  }
});

module.exports = router;
