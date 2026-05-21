const express = require("express");
const db = require("../config/db");

const router = express.Router();

router.get("/", async (req, res) => {

try{

const { search, location } = req.query;
let query = "SELECT * FROM mess WHERE 1=1";
const params = [];
let paramIndex = 1;

if (search) {
  query += ` AND (name ILIKE $${paramIndex} OR location ILIKE $${paramIndex+1})`;
  const searchTerm = `%${search}%`;
  params.push(searchTerm, searchTerm);
  paramIndex += 2;
}

if (location) {
  query += ` AND location ILIKE $${paramIndex}`;
  params.push(`%${location}%`);
  paramIndex += 1;
}

query += " ORDER BY name ASC";

const result = await db.query(query, params);
const rows = result.rows;

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

const result = await db.query(
"SELECT * FROM mess WHERE mess_id=$1",
[req.params.id]
);
const rows = result.rows;

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

const result = await db.query(
`SELECT m.* FROM mess m
JOIN favorites f ON m.mess_id = f.mess_id
WHERE f.customer_phone = $1
ORDER BY f.added_at DESC`,
[phone]
);
const favorites = result.rows;

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
VALUES ($1, $2)
ON CONFLICT (customer_phone, mess_id) DO UPDATE SET added_at = CURRENT_TIMESTAMP`,
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
`DELETE FROM favorites WHERE customer_phone = $1 AND mess_id = $2`,
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

const {name, location, veg_type, contact_number} = req.body;

await db.query(
`UPDATE mess 
SET name=$1, location=$2, veg_type=$3, contact_number=$4 
WHERE mess_id=$5`,
[name, location, veg_type, contact_number, req.params.id]
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

const result = await db.query(
`SELECT breakfast,lunch,dinner
FROM menu
WHERE mess_id=$1
ORDER BY menu_date DESC
LIMIT 1`,
[req.params.id]
);
const rows = result.rows;

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
VALUES($1,CURRENT_DATE,$2,$3,$4)
ON CONFLICT (mess_id, menu_date) DO UPDATE SET
breakfast=$2,
lunch=$3,
dinner=$4`,

[
req.params.id,
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

const {name,location,veg_type,contact_number} = req.body;

await db.query(
"INSERT INTO mess(name,location,veg_type,contact_number) VALUES(?,?,?,?)",
[name,location,veg_type || "Veg",contact_number || "N/A"]
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