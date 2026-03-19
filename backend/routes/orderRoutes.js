const express = require("express");
const db = require("../config/db");

const router = express.Router();

/* ========================
   VALIDATION HELPERS
======================== */
function validatePhone(phone) {
  return /^[0-9]{10}$/.test(phone);
}

function validateName(name) {
  return name && name.trim().length >= 2 && name.length <= 100;
}

/* ========================
   PLACE ORDER WITH VALIDATION
======================== */
router.post("/place", async (req, res) => {
  try {
    const { mess_id, customer_name, customer_phone, customer_email, items, special_instructions } = req.body;

    // Validate required fields
    if (!mess_id || !customer_name || !customer_phone || !items || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields: mess_id, customer_name, customer_phone, items" });
    }

    // Validate phone number (10 digits)
    if (!validatePhone(customer_phone)) {
      return res.status(400).json({ error: "Invalid phone number. Please enter a 10-digit number." });
    }

    // Validate name
    if (!validateName(customer_name)) {
      return res.status(400).json({ error: "Name must be between 2-100 characters." });
    }

    // Validate items
    if (items.some(item => !item.item_id || !item.quantity || item.quantity < 1)) {
      return res.status(400).json({ error: "Invalid items. Each item must have quantity >= 1" });
    }

    // Calculate total
    const total_amount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (total_amount <= 0) {
      return res.status(400).json({ error: "Order total must be greater than 0" });
    }

    // Insert order
    const [result] = await db.query(
      `INSERT INTO orders (mess_id, customer_name, customer_phone, customer_email, items, total_amount, status, special_instructions)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [mess_id, customer_name.trim(), customer_phone, customer_email || null, JSON.stringify(items), total_amount, special_instructions || null]
    );

    // Update/create customer profile
    await db.query(
      `INSERT INTO customers (phone, name, email) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = ?, email = ?, total_orders = total_orders + 1, total_spent = total_spent + ?`,
      [customer_phone, customer_name.trim(), customer_email || null, customer_name.trim(), customer_email || null, total_amount]
    );

    res.json({
      message: "Order placed successfully",
      order_id: result.insertId,
      total_amount: total_amount,
      status: "pending"
    });

  } catch (err) {
    console.error("Order placement error:", err);
    res.status(500).json({ error: "Failed to place order. Please try again." });
  }
});

/* ========================
   GET ORDER STATUS BY ORDER ID
======================== */
router.get("/status/:order_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT order_id, customer_name, customer_phone, mess_id, total_amount, status, items, created_at, updated_at 
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
      `SELECT order_id, mess_id, customer_name, total_amount, status, created_at, updated_at 
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
   GET ORDER STATS FOR DASHBOARD
======================== */
router.get("/:mess_id/stats/overview", async (req, res) => {
  try {
    const [stats] = await db.query(
      `SELECT 
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        SUM(total_amount) as total_revenue,
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

    let query = `SELECT order_id, customer_name, customer_phone, total_amount, status, items, created_at 
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

module.exports = router;