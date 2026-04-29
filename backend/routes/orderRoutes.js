const express = require("express");
const db = require("../config/db");

const router = express.Router();

function validatePhone(phone) {
  return /^[0-9]{10}$/.test(phone);
}

function validateName(name) {
  return name && name.trim().length >= 2 && name.length <= 100;
}

const CASHBACK_PERCENT = 5;

function toMoney(value) {
  return Number(parseFloat(value).toFixed(2));
}

function generatePaymentReference(orderId) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MM-${orderId}-${suffix}`;
}

router.post("/place", async (req, res) => {
  let connection;
  try {
    const {
      mess_id,
      customer_name,
      customer_phone,
      customer_email,
      items,
      special_instructions,
      use_wallet,
      payment_method
    } = req.body;

    if (!mess_id || !customer_name || !customer_phone || !items || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields: mess_id, customer_name, customer_phone, items" });
    }

    if (!validatePhone(customer_phone)) {
      return res.status(400).json({ error: "Invalid phone number. Please enter a 10-digit number." });
    }

    if (!validateName(customer_name)) {
      return res.status(400).json({ error: "Name must be between 2-100 characters." });
    }

    if (items.some(item => !item.item_id || !item.quantity || item.quantity < 1)) {
      return res.status(400).json({ error: "Invalid items. Each item must have quantity >= 1" });
    }

    const selectedPaymentMethod = payment_method === 'online' ? 'online' : 'cash';

    const requestedItemIds = [...new Set(items.map(item => parseInt(item.item_id, 10)))].filter(Boolean);
    if (requestedItemIds.length === 0) {
      return res.status(400).json({ error: "Invalid items selected" });
    }

    const placeholders = requestedItemIds.map(() => "?").join(",");
    const [menuItems] = await db.query(
      `SELECT item_id, item_name, item_price, is_available
       FROM menu_items
       WHERE mess_id = ? AND item_id IN (${placeholders})`,
      [mess_id, ...requestedItemIds]
    );

    if (menuItems.length !== requestedItemIds.length) {
      return res.status(400).json({ error: "One or more selected items are invalid" });
    }

    const menuById = new Map(menuItems.map(menuItem => [menuItem.item_id, menuItem]));
    const unavailableItems = [];
    const normalizedItems = [];

    for (const item of items) {
      const menuItem = menuById.get(parseInt(item.item_id, 10));
      if (!menuItem) {
        return res.status(400).json({ error: "One or more selected items are invalid" });
      }

      if (!menuItem.is_available) {
        unavailableItems.push(menuItem.item_name);
        continue;
      }

      normalizedItems.push({
        item_id: menuItem.item_id,
        name: menuItem.item_name,
        price: Number(menuItem.item_price),
        quantity: parseInt(item.quantity, 10)
      });
    }

    if (unavailableItems.length > 0) {
      return res.status(400).json({
        error: `These items are currently unavailable: ${unavailableItems.join(", ")}`
      });
    }

    // Calculate total using trusted DB prices
    const total_amount = normalizedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (total_amount <= 0) {
      return res.status(400).json({ error: "Order total must be greater than 0" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Ensure customer exists for wallet operations
    await connection.query(
      `INSERT INTO customers (phone, name, email)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email)`,
      [customer_phone, customer_name.trim(), customer_email || null]
    );

    const [customerRows] = await connection.query(
      `SELECT wallet_balance FROM customers WHERE phone = ? FOR UPDATE`,
      [customer_phone]
    );

    const walletBalance = toMoney(customerRows[0]?.wallet_balance || 0);
    const walletUsed = use_wallet ? Math.min(walletBalance, total_amount) : 0;
    const payableAmount = toMoney(total_amount - walletUsed);
    const cashbackEarned = toMoney(payableAmount * (CASHBACK_PERCENT / 100));
    const initialPaymentStatus = selectedPaymentMethod === 'cash' ? 'pending' : 'pending';

     const initialProofStatus = selectedPaymentMethod === 'online' ? 'not_uploaded' : 'not_uploaded';

     // Insert order
    const [result] = await connection.query(
      `INSERT INTO orders (
          mess_id, customer_name, customer_phone, customer_email, items,
         total_amount, wallet_used, cashback_earned, status, payment_method, payment_status, payment_proof_status, special_instructions
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        mess_id,
        customer_name.trim(),
        customer_phone,
        customer_email || null,
        JSON.stringify(normalizedItems),
        payableAmount,
        walletUsed,
        cashbackEarned,
        selectedPaymentMethod,
        initialPaymentStatus,
        initialProofStatus,
        special_instructions || null
      ]
    );

    let paymentReference = null;
    if (selectedPaymentMethod === 'online') {
      paymentReference = generatePaymentReference(result.insertId);
      await connection.query(
        `UPDATE orders
         SET payment_reference = ?, payment_order_id = ?, payment_provider = 'manual_qr'
         WHERE order_id = ?`,
        [paymentReference, paymentReference, result.insertId]
      );
    }

    if (walletUsed > 0) {
      await connection.query(
        `INSERT INTO wallet_transactions (customer_phone, type, amount, reference_order_id, note)
         VALUES (?, 'debit', ?, ?, ?)`,
        [customer_phone, walletUsed, result.insertId, 'Wallet used for order payment']
      );
    }

    if (cashbackEarned > 0) {
      await connection.query(
        `INSERT INTO wallet_transactions (customer_phone, type, amount, reference_order_id, note)
         VALUES (?, 'credit', ?, ?, ?)`,
        [customer_phone, cashbackEarned, result.insertId, `${CASHBACK_PERCENT}% cashback credited`]
      );
    }

    const updatedWalletBalance = toMoney(walletBalance - walletUsed + cashbackEarned);

    // Update customer profile with order/wallet details
    await connection.query(
      `UPDATE customers
       SET total_orders = total_orders + 1,
           total_spent = total_spent + ?,
           wallet_balance = ?
       WHERE phone = ?`,
      [payableAmount, updatedWalletBalance, customer_phone]
    );

    await connection.commit();

    res.json({
      message: "Order placed successfully",
      order_id: result.insertId,
      total_amount: payableAmount,
      payment_reference: paymentReference,
      wallet_used: walletUsed,
      cashback_earned: cashbackEarned,
      wallet_balance: updatedWalletBalance,
      status: "pending",
      payment_method: selectedPaymentMethod,
      payment_status: initialPaymentStatus
    });

  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Order placement error:", err);
    res.status(500).json({ error: "Failed to place order. Please try again." });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/* ========================
   GET ORDER STATUS BY ORDER ID
======================== */
router.get("/status/:order_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT order_id, customer_name, customer_phone, mess_id, total_amount, status, payment_method, payment_status, payment_reference, payment_proof_status, payment_proof_image, items, created_at, updated_at 
       FROM orders WHERE order_id = ?`,
      [req.params.order_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching order status:", err);
    res.status(500).json({ error: "Failed to fetch order status" });
  }
});

/* ========================
   GET CUSTOMER ORDER HISTORY
======================== */
router.get("/customer/:phone", async (req, res) => {
  try {
    const phone = req.params.phone;

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const [rows] = await db.query(
      `SELECT order_id, mess_id, customer_name, total_amount, wallet_used, cashback_earned, status, payment_method, payment_status, payment_reference, payment_proof_status, payment_proof_image, items, created_at, updated_at 
       FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 20`,
      [phone]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching customer history:", err);
    res.status(500).json({ error: "Failed to fetch order history" });
  }
});

/* ========================
   GET CUSTOMER PROFILE (WALLET + STATS)
======================== */
router.get("/customer/:phone/profile", async (req, res) => {
  try {
    const phone = req.params.phone;

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const [rows] = await db.query(
      `SELECT phone, name, email, total_orders, total_spent, wallet_balance, created_at, updated_at
       FROM customers
       WHERE phone = ?`,
      [phone]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching customer profile:", err);
    res.status(500).json({ error: "Failed to fetch customer profile" });
  }
});

/* ========================
   GET WALLET TRANSACTIONS
======================== */
router.get("/customer/:phone/wallet/transactions", async (req, res) => {
  try {
    const phone = req.params.phone;

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const [rows] = await db.query(
      `SELECT transaction_id, customer_phone, type, amount, reference_order_id, note, created_at
       FROM wallet_transactions
       WHERE customer_phone = ?
       ORDER BY created_at DESC
       LIMIT 30`,
      [phone]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching wallet transactions:", err);
    res.status(500).json({ error: "Failed to fetch wallet transactions" });
  }
});

/* ========================
   GRANT WALLET CASHBACK
======================== */
router.post("/customer/:phone/wallet/cashback", async (req, res) => {
  let connection;
  try {
    const phone = req.params.phone;
    const amount = toMoney(req.body.amount);
    const note = (req.body.note || "Manual cashback credit").trim().slice(0, 200);

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Cashback amount must be greater than 0" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [customerRows] = await connection.query(
      `SELECT phone, wallet_balance FROM customers WHERE phone = ? FOR UPDATE`,
      [phone]
    );

    if (customerRows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const currentBalance = toMoney(customerRows[0].wallet_balance || 0);
    const updatedBalance = toMoney(currentBalance + amount);

    await connection.query(
      `UPDATE customers SET wallet_balance = ? WHERE phone = ?`,
      [updatedBalance, phone]
    );

    await connection.query(
      `INSERT INTO wallet_transactions (customer_phone, type, amount, note)
       VALUES (?, 'credit', ?, ?)`,
      [phone, amount, note]
    );

    await connection.commit();

    res.json({
      message: "Cashback credited successfully",
      customer_phone: phone,
      amount,
      wallet_balance: updatedBalance
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error granting cashback:", err);
    res.status(500).json({ error: "Failed to credit cashback" });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/* ========================
   GET ORDER STATS FOR DASHBOARD
======================== */
router.get("/:mess_id/stats/overview", async (req, res) => {
  try {
    const [stats] = await db.query(
      `SELECT 
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as total_revenue,
        COUNT(*) as total_orders
       FROM orders WHERE mess_id = ? AND DATE(created_at) = DATE(NOW())`,
      [req.params.mess_id]
    );

    res.json(stats[0] || {});
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

/* ========================
   GET ALL ORDERS FOR OWNER (WITH FILTERS)
======================== */
router.get("/:mess_id", async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    let query = `SELECT order_id, customer_name, customer_phone, total_amount, status, payment_method, payment_status, items, created_at 
                 FROM orders WHERE mess_id = ?`;
    const params = [req.params.mess_id];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* ========================
   DELETE ALL ORDERS FOR OWNER
======================== */
router.delete("/:mess_id/all", async (req, res) => {
  try {
    const messId = parseInt(req.params.mess_id, 10);
    const ownerContact = String(req.body?.owner_contact || "").trim();

    if (!Number.isInteger(messId) || messId <= 0) {
      return res.status(400).json({ error: "Invalid mess_id" });
    }

    if (!ownerContact) {
      return res.status(400).json({ error: "Owner verification is required" });
    }

    const [ownerRows] = await db.query(
      `SELECT 1
       FROM users
       WHERE role = 'owner'
         AND mess_id = ?
         AND (username = ? OR phone = ? OR email = ?)
       LIMIT 1`,
      [messId, ownerContact, ownerContact, ownerContact]
    );

    if (ownerRows.length === 0) {
      return res.status(403).json({ error: "Unauthorized to delete orders for this mess" });
    }

    const [result] = await db.query(
      `DELETE FROM orders WHERE mess_id = ?`,
      [messId]
    );

    res.json({
      message: "All orders deleted successfully",
      mess_id: messId,
      deleted_count: result.affectedRows || 0
    });
  } catch (err) {
    console.error("Error deleting all orders:", err);
    res.status(500).json({ error: "Failed to delete all orders" });
  }
});

/* ========================
   UPDATE ORDER STATUS (OWNER ONLY)
======================== */
router.put("/:order_id/status", async (req, res) => {
  try {
    const { status, mess_id } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Verify mess ownership before updating
    const [order] = await db.query(`SELECT mess_id FROM orders WHERE order_id = ?`, [req.params.order_id]);
    if (order.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order[0].mess_id !== parseInt(mess_id)) {
      return res.status(403).json({ error: "You can only update your own mess's orders" });
    }

    // Update status
    const [result] = await db.query(
      `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
      [status, req.params.order_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      message: `Order status updated to ${status}`,
      order_id: req.params.order_id,
      status: status,
      updated_at: new Date().toISOString()
    });

  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

/* ========================
   CANCEL ORDER
======================== */
router.put("/:order_id/cancel", async (req, res) => {
  try {
    const { customer_phone } = req.body;

    if (!validatePhone(customer_phone)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const [order] = await db.query(`SELECT status FROM orders WHERE order_id = ? AND customer_phone = ?`, 
      [req.params.order_id, customer_phone]);

    if (order.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order[0].status === 'completed' || order[0].status === 'cancelled') {
      return res.status(400).json({ error: `Cannot cancel order with status: ${order[0].status}` });
    }

    await db.query(`UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`, 
      [req.params.order_id]);

    res.json({
      message: "Order cancelled successfully",
      order_id: req.params.order_id
    });

  } catch (err) {
    console.error("Error cancelling order:", err);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

/* ========================
   CONFIRM ORDER AFTER PAYMENT SHARE
======================== */
router.post("/confirm-after-share/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;
    const { customer_phone } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    if (!validatePhone(customer_phone)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const [orders] = await db.query(
      `SELECT order_id, status FROM orders WHERE order_id = ? AND customer_phone = ?`,
      [order_id, customer_phone]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orders[0];

    // Idempotent behavior: if already confirmed, treat as success.
    if (order.status === "confirmed") {
      return res.json({
        message: "Order already confirmed",
        order_id: order_id,
        status: "confirmed"
      });
    }

    // Block only terminal/invalid states.
    if (order.status !== "pending") {
      return res.status(400).json({ error: `Order cannot be confirmed with status: ${order.status}` });
    }

    await db.query(
      `UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
      [order_id]
    );

    res.json({
      message: "Order confirmed after payment share",
      order_id: order_id,
      status: "confirmed"
    });

  } catch (err) {
    console.error("Error confirming order after share:", err);
    res.status(500).json({ error: "Failed to confirm order" });
  }
});

module.exports = router;