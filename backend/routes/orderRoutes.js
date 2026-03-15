const express = require("express");
const db = require("../config/db");

const router = express.Router();

/* -------------------------
   PLACE ORDER (SIMULATED PAYMENT)
--------------------------*/
router.post("/place", async (req, res) => {
  try {
    const { mess_id, customer_name, customer_phone, items } = req.body;

    if (!mess_id || !customer_name || !customer_phone || !items || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // calculate total
    const total_amount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // generate order id
    const cashfree_order_id = `MESS${Date.now()}`;

    // save order
    await db.query(
      `INSERT INTO orders (mess_id, customer_name, customer_phone, items, total_amount, payment_status, cashfree_order_id)
       VALUES (?, ?, ?, ?, ?, 'paid', ?)`,
      [mess_id, customer_name, customer_phone, JSON.stringify(items), total_amount, cashfree_order_id]
    );

    res.json({
      message: "Order placed successfully",
      order_id: cashfree_order_id,
      total_amount: total_amount
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to place order" });
  }
});

/* -------------------------
   GET ORDERS (OWNER)
--------------------------*/
router.get("/:mess_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM orders WHERE mess_id=? ORDER BY created_at DESC`,
      [req.params.mess_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

module.exports = router;