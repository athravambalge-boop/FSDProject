const express = require("express");
const db = require("../config/db");

const router = express.Router();


router.get("/:mess_id", async (req, res) => {
  try {
    const includeUnavailable = req.query.include_unavailable === "1";
    const query = includeUnavailable
      ? "SELECT * FROM menu_items WHERE mess_id=$1 ORDER BY category"
      : "SELECT * FROM menu_items WHERE mess_id=$1 AND is_available=1 ORDER BY category";

    const result = await db.query(query, [req.params.mess_id]);
    const rows = result.rows;
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

/* -------------------------
   ADD MENU ITEM (OWNER)
--------------------------*/
router.post("/:mess_id", async (req, res) => {
  try {
    const { item_name, item_price, category } = req.body;
    await db.query(
      "INSERT INTO menu_items (mess_id, item_name, item_price, category) VALUES ($1,$2,$3,$4)",
      [req.params.mess_id, item_name, item_price, category]
    );
    res.json({ message: "Item added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

/* -------------------------
   DELETE MENU ITEM (OWNER)
--------------------------*/
router.delete("/item/:item_id", async (req, res) => {
  try {
    await db.query(
      "DELETE FROM menu_items WHERE item_id=$1",
      [req.params.item_id]
    );
    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

/* -------------------------
   TOGGLE AVAILABILITY (OWNER)
--------------------------*/
router.put("/item/:item_id", async (req, res) => {
  try {
    const { is_available } = req.body;
    await db.query(
      "UPDATE menu_items SET is_available=$1 WHERE item_id=$2",
      [is_available, req.params.item_id]
    );
    res.json({ message: "Item updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;