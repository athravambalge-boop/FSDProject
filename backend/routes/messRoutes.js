const express = require("express");
const db = require("../config/db");

const router = express.Router();

/* -------------------------
   GET ALL MESSES
--------------------------*/

router.get("/", async (req, res) => {

try{

const [rows] = await db.query("SELECT * FROM mess");

res.json(rows);

}catch(err){

console.error(err);
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