const express = require("express");
const db = require("../config/db");

const router = express.Router();

/* LOGIN ROUTE */

router.post("/login", async (req, res) => {

try {

const { username, password } = req.body;

const [rows] = await db.query(
"SELECT * FROM users WHERE username=? AND password=?",
[username, password]
);

if(rows.length === 0){
return res.status(401).json({
error:"Invalid username or password"
});
}

const user = rows[0];

res.json({
message:"Login successful",
role:user.role,
mess_id:user.mess_id
});

} catch(err){

console.error(err);
res.status(500).json({error:"Server error"});

}

});

module.exports = router;