const axios = require("axios");
const Report = require("../models/Report");

const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:5000";

// POST /api/scan
const createScan = async (req, res) => {
  const { text } = req.body;

  // ── 1. Validate input ────────────────────────────────────────────────────────
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "Request body must contain a non-empty 'text' field.",
    });
  }

  const trimmedText = text.trim();
  const startTime = Date.now();

  // ── 2. Call the Python microservice ─────────────────────────────────────────
  let pythonData;
  try {
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/check`, // adjust path if your Flask route differs
      { text: trimmedText },
      {
        timeout: 120_000, // 120 s – plagiarism checks can be slow
        headers: { "Content-Type": "application/json" },
      },
    );
    pythonData = response.data;
  } catch (axiosError) {
    // Distinguish "service down" from other Axios errors
    if (axiosError.code === "ECONNREFUSED" || axiosError.code === "ETIMEDOUT") {
      return res.status(503).json({
        success: false,
        message:
          "The plagiarism analysis service is currently offline. Please try again later.",
        detail: axiosError.message,
      });
    }

    // The Python service responded with a 4xx / 5xx
    if (axiosError.response) {
      return res.status(502).json({
        success: false,
        message: "The analysis service returned an error.",
        detail: axiosError.response.data,
      });
    }

    // Any other Axios / network error
    return res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while contacting the analysis service.",
      detail: axiosError.message,
    });
  }

  // ── 3. Parse Python response & derive verdict ────────────────────────────────
  const plagiarismScore =
    typeof pythonData.plagiarism_score === "number"
      ? pythonData.plagiarism_score
      : 0;

  const verdict = Report.deriveVerdict(plagiarismScore);

  const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;
  const scanDurationMs = Date.now() - startTime;

  // Normalize optional source matches array from Python (if provided)
  // Python returns either 'results' or 'matches' — handle both
  const rawSources = Array.isArray(pythonData.results)
    ? pythonData.results
    : Array.isArray(pythonData.matches)
      ? pythonData.matches
      : [];

  const sourceMatches = rawSources.map((m) => ({
    url: m.url ?? null,
    title: m.title ?? null,
    similarityScore: m.score ?? m.similarity_score ?? 0,
    matchedText: m.matched_text ?? null,
  }));
  // ── 4. Persist to MongoDB ────────────────────────────────────────────────────
  let savedReport;
  try {
    savedReport = await Report.create({
      originalText: trimmedText,
      plagiarismScore,
      verdict,
      wordCount,
      sourceMatches,
      rawPythonResponse: pythonData,
      scanDurationMs,
    });
  } catch (dbError) {
    return res.status(500).json({
      success: false,
      message: "Failed to save the report to the database.",
      detail: dbError.message,
    });
  }

  // ── 5. Return the saved report ───────────────────────────────────────────────
  return res.status(201).json({
    success: true,
    message: "Scan completed and report saved.",
    report: savedReport,
  });
};

// GET /api/scan  –  fetch all historical reports (newest first)
const getAllReports = async (_req, res) => {
  try {
    const reports = await Report.find()
      .select("-rawPythonResponse") // keep payload lean
      .sort({ createdAt: -1 })
      .limit(100);

    return res
      .status(200)
      .json({ success: true, count: reports.length, reports });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/scan/:id  –  fetch a single report by ID
const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found." });
    }
    return res.status(200).json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createScan, getAllReports, getReportById };
