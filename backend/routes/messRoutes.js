const express = require("express");
const db = require("../config/db");

const router = express.Router();

/* -------------------------
   GET ALL MESSES (WITH SEARCH & FILTER)
--------------------------*/

router.get("/", async (req, res) => {

try{

const { search, minPrice, maxPrice, minRating, location } = req.query;
let query = "SELECT * FROM mess WHERE 1=1";
const params = [];

// Search by name or location
if (search) {
  query += " AND (name LIKE ? OR location LIKE ?)";
  const searchTerm = `%${search}%`;
  params.push(searchTerm, searchTerm);
}

// Filter by location
if (location) {
  query += " AND location LIKE ?";
  params.push(`%${location}%`);
}

// Filter by price range
if (minPrice) {
  query += " AND monthly_price >= ?";
  params.push(parseFloat(minPrice));
}

if (maxPrice) {
  query += " AND monthly_price <= ?";
  params.push(parseFloat(maxPrice));
}

// Filter by minimum rating
if (minRating) {
  query += " AND rating >= ?";
  params.push(parseFloat(minRating));
}

query += " ORDER BY rating DESC";

const [rows] = await db.query(query, params);

res.json(rows);

}catch(err){

console.error("Error fetching messes:", err);
res.status(500).json({error:"Database error"});

}

});


/* -------------------------
   GET SINGLE MESS
--------------------------*/

router.get("/:id", async (req, res) => {

try{

const [rows] = await db.query(
"SELECT * FROM mess WHERE mess_id=?",
[req.params.id]
);

if(rows.length === 0){
return res.status(404).json({error:"Mess not found"});
}

res.json(rows[0]);

}catch(err){

console.error(err);
res.status(500).json({error:"Database error"});

}

});

/* -------------------------
   GET CUSTOMER FAVORITES
--------------------------*/

router.get("/favorites/:phone", async (req, res) => {

try{

const { phone } = req.params;

const [favorites] = await db.query(
`SELECT m.* FROM mess m
JOIN favorites f ON m.mess_id = f.mess_id
WHERE f.customer_phone = ?
ORDER BY f.added_at DESC`,
[phone]
);

res.json(favorites);

}catch(err){

console.error("Error fetching favorites:", err);
res.status(500).json({error:"Database error"});

}

});

/* -------------------------
   ADD FAVORITE
--------------------------*/

router.post("/favorite/add", async (req, res) => {

try{

const { customer_phone, mess_id } = req.body;

if (!customer_phone || !mess_id) {
  return res.status(400).json({error: "Missing required fields"});
}

await db.query(
`INSERT INTO favorites (customer_phone, mess_id) 
VALUES (?, ?)
ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP`,
[customer_phone, mess_id]
);

res.json({message: "Added to favorites"});

}catch(err){

console.error("Error adding favorite:", err);
res.status(500).json({error:"Database error"});

}

});

/* -------------------------
   REMOVE FAVORITE
--------------------------*/

router.delete("/favorite/remove/:phone/:messId", async (req, res) => {

try{

const { phone, messId } = req.params;

await db.query(
`DELETE FROM favorites WHERE customer_phone = ? AND mess_id = ?`,
[phone, messId]
);

res.json({message: "Removed from favorites"});

}catch(err){

console.error("Error removing favorite:", err);
res.status(500).json({error:"Database error"});

}

});


/* -------------------------
   EDIT MESS (ADMIN)
--------------------------*/

router.put("/:id", async (req, res) => {

try{

const {name, location, monthly_price, veg_type, contact_number, rating} = req.body;

await db.query(
`UPDATE mess 
SET name=?, location=?, monthly_price=?, veg_type=?, contact_number=?, rating=? 
WHERE mess_id=?`,
[name, location, monthly_price, veg_type, contact_number, rating, req.params.id]
);

res.json({message:"Mess updated successfully"});

}catch(err){

console.error(err);
res.status(500).json({error:"Database error"});

}

});


/* -------------------------
   GET TODAY MENU
--------------------------*/

router.get("/:id/menu", async (req, res) => {

try{

const [rows] = await db.query(
`SELECT breakfast,lunch,dinner
FROM menu
WHERE mess_id=?
ORDER BY menu_date DESC
LIMIT 1`,
[req.params.id]
);

if(rows.length === 0){
return res.json({});
}

res.json(rows[0]);

}catch(err){

console.error(err);
res.status(500).json({error:"Database error"});

}

});


/* -------------------------
   UPDATE MENU (OWNER)
--------------------------*/

router.post("/:id/menu", async (req, res) => {

try{

const {breakfast,lunch,dinner} = req.body;

await db.query(

`INSERT INTO menu(mess_id,menu_date,breakfast,lunch,dinner)
VALUES(?,CURDATE(),?,?,?)
ON DUPLICATE KEY UPDATE
breakfast=?,
lunch=?,
dinner=?`,

[
req.params.id,
breakfast,
lunch,
dinner,
breakfast,
lunch,
dinner
]

);

res.json({message:"Menu updated successfully"});

}catch(err){

console.error(err);
res.status(500).json({error:"Database error"});

}

});


/* -------------------------
   ADD NEW MESS (ADMIN)
--------------------------*/

router.post("/", async (req,res)=>{

try{

const {name,location,price,veg_type,contact_number} = req.body;

await db.query(
"INSERT INTO mess(name,location,monthly_price,veg_type,contact_number,rating) VALUES(?,?,?,?,?,?)",
[name,location,price,veg_type || "Veg",contact_number || "N/A",4.0]
);

res.json({message:"Mess added successfully"});

}catch(err){

console.error(err);
res.status(500).json({error:"Database error"});

}

});


/* -------------------------
   DELETE MESS (ADMIN)
--------------------------*/

router.delete("/:id", async (req,res)=>{

try{

await db.query(
"DELETE FROM mess WHERE mess_id=?",
[req.params.id]
);

res.json({message:"Mess deleted successfully"});

}catch(err){

console.error(err);
res.status(500).json({error:"Database error"});

}

});

module.exports = router;