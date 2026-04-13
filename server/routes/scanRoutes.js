const express = require("express");
const router = express.Router();
const {
  createScan,
  getAllReports,
  getReportById,
} = require("../controllers/scanController");

// POST   /api/scan        → run a new plagiarism check
router.post("/", createScan);

// GET    /api/scan        → retrieve all past reports
router.get("/", getAllReports);

// GET    /api/scan/:id    → retrieve one report by ID
router.get("/:id", getReportById);

module.exports = router;