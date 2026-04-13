require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const scanRoutes = require("./routes/scanRoutes");

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/plagiarism_checker";

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow your React dev server (and any other origins you list) to call this API.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., curl, Postman) in development
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin '${origin}' is not allowed.`));
      }
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/scan", scanRoutes);

// Health-check (useful for Docker / load-balancer probes)
app.get("/health", (_req, res) =>
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() })
);

// 404 catch-all
app.use((_req, res) =>
  res.status(404).json({ success: false, message: "Route not found." })
);

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[Global Error]", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error.",
  });
});

// ─── MongoDB → then start server ─────────────────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(`✅  MongoDB connected: ${MONGO_URI}`);
    app.listen(PORT, () => {
      console.log(`🚀  Node/Express server listening on http://localhost:${PORT}`);
      console.log(`🐍  Python service expected at: ${process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:5000"}`);
    });
  })
  .catch((err) => {
    console.error("❌  MongoDB connection failed:", err.message);
    process.exit(1);
  });