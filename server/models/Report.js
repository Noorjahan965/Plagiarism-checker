const mongoose = require("mongoose");

const SourceMatchSchema = new mongoose.Schema(
  {
    url: { type: String, default: null },
    title: { type: String, default: null },
    similarityScore: { type: Number, default: 0 },
    matchedText: { type: String, default: null },
  },
  { _id: false }
);

const ReportSchema = new mongoose.Schema(
  {
    originalText: {
      type: String,
      required: [true, "Original text is required"],
      trim: true,
    },
    plagiarismScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    verdict: {
      type: String,
      enum: ["original", "low_similarity", "moderate_similarity", "plagiarized"],
      required: true,
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    sourceMatches: {
      type: [SourceMatchSchema],
      default: [],
    },
    rawPythonResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    scanDurationMs: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: short preview of the scanned text
ReportSchema.virtual("textPreview").get(function () {
  return this.originalText.length > 120
    ? `${this.originalText.substring(0, 120)}…`
    : this.originalText;
});

// Static helper: derive a human-readable verdict from a numeric score
ReportSchema.statics.deriveVerdict = function (score) {
  if (score < 10) return "original";
  if (score < 30) return "low_similarity";
  if (score < 60) return "moderate_similarity";
  return "plagiarized";
};

module.exports = mongoose.model("Report", ReportSchema);