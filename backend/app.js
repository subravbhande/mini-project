require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const priceRoutes = require("./src/routes/priceRoutes");

const app  = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/price", priceRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "AgriSense Backend", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`AgriSense backend running on http://localhost:${PORT}`);
});
