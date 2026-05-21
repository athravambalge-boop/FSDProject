require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;
const frontendDir = path.join(__dirname, "..", "frontend");
const uploadsDir = process.env.UPLOADS_DIR
   ? path.resolve(process.env.UPLOADS_DIR)
   : path.join(__dirname, "uploads");

app.set("trust proxy", 1);

function buildAllowedOrigins() {
   const defaults = [
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://athravambalge-boop.github.io"
   ];

   const extra = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

   return [...new Set([...defaults, ...extra])];
}

const allowedOrigins = buildAllowedOrigins();

function mapLegacyPhonePeEnvNames() {
   const envPath = path.join(__dirname, ".env");
   if (!fs.existsSync(envPath)) return;

   const envText = fs.readFileSync(envPath, "utf8");
   const findValue = (key) => {
      const regex = new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, "mi");
      const match = envText.match(regex);
      return match ? match[1].trim() : "";
   };

   if (!process.env["Client Id"]) {
      process.env["Client Id"] = findValue("PHONEPE_MERCHANT_ID");
   }

   if (!process.env["Client Secret"]) {
      process.env["Client Secret"] = findValue("PHONEPE_SALT_KEY");
   }

   if (!process.env["Key Index"]) {
      const legacyIndex = findValue("PHONEPE_SALT_INDEX");
      if (legacyIndex) process.env["Key Index"] = legacyIndex;
   }
}

mapLegacyPhonePeEnvNames();

app.use(
   cors({
      origin(origin, callback) {
         if (!origin) return callback(null, true);
         if (allowedOrigins.includes(origin)) return callback(null, true);
         return callback(new Error("Not allowed by CORS"));
      }
   })
);

app.use(express.json());
app.use("/uploads", express.static(uploadsDir));
app.use(express.static(frontendDir));

const authRoutes = require("./routes/authRoutes");
const messRoutes = require("./routes/messRoutes");
const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/mess", messRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/", (req, res) => {
   res.sendFile(path.join(frontendDir, "landing.html"));
});

/* -------------------------
   START SERVER
--------------------------*/
async function startServer() {
   const proofDir = path.join(uploadsDir, "payment-proofs");

   if (!fs.existsSync(proofDir)) {
      fs.mkdirSync(proofDir, { recursive: true });
   }

   app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
   });
}

startServer().catch((err) => {
   console.error(err);
   process.exit(1);
});
