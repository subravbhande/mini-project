const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");

const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/authRoutes");
const batchRoutes = require("./src/routes/batchRoutes");
const decisionRoutes = require("./src/routes/decisionRoutes");
const priceRoutes = require("./src/routes/priceRoutes");
const feedbackRoutes = require("./src/routes/feedbackRoutes");
const assistantRoutes = require("./src/routes/assistantRoutes");
const mlClient = require("./src/services/mlClient");

const { initDailyPriceSyncJob } = require("./src/jobs/dailyPriceSyncJob");

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database connection
connectDB();

// Initialize automated daily price sync job
initDailyPriceSyncJob();

// 1. Security HTTP Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// 2. Controlled CORS policy
const configuredOrigin = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim())
  : [];
const allowedOrigins = [
  ...configuredOrigin,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, backend scripts)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".onrender.com")
      ) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation: origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 3. Body parsers with payload limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 4. Rate Limiting Protection
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { success: false, error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const mlLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  message: { success: false, error: "Rate limit exceeded for ML prediction requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, error: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global rate limiter
app.use("/api", apiLimiter);

// 5. Mount API Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/price", mlLimiter, priceRoutes);
app.use("/api/decision", mlLimiter, decisionRoutes);
app.use("/api/feedback", mlLimiter, feedbackRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/batches", batchRoutes);

app.use("/api/batch", batchRoutes);

// 6. Deep System Health Check (Database + ML Service + Backend)
app.get("/api/health", async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const mlStatus = await mlClient.getHealth();

  res.json({
    status: "ok",
    service: "AgriSense Backend",
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      host: mongoose.connection.host || null,
    },
    ml_service: mlStatus,
  });
});

// 7. 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// 8. Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Backend Error]", err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`AgriSense backend running securely on http://localhost:${PORT}`);
  console.log(`ML microservice upstream: ${process.env.ML_SERVICE_URL || "http://localhost:8000"}`);
});
