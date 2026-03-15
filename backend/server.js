const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

/* -------------------------
   MIDDLEWARE
--------------------------*/
app.use(cors({
  origin: ["http://localhost:5500", "http://127.0.0.1:5500"]
}));

app.use(express.json());

/* -------------------------
   ROUTES
--------------------------*/
const authRoutes = require("./routes/authRoutes");
const messRoutes = require("./routes/messRoutes");
const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/mess", messRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);

/* -------------------------
   TEST ROUTE
--------------------------*/
app.get("/", (req, res) => {
  res.send("Backend running successfully");
});

/* -------------------------
   START SERVER
--------------------------*/
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});