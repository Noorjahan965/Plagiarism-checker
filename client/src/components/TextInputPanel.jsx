import { useRef, useState } from "react";

export default function TextInputPanel({ text, onTextChange, onScan, onClear, loading }) {
  const [dragging, setDragging]   = useState(false);
  const [fileName, setFileName]   = useState(null);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef();

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;

  // ── File reader ────────────────────────────────────────────────────────────
  const readFile = (file) => {
    setFileError(null);

    // Allowed types
    const allowed = [
      "text/plain",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const isAllowed = allowed.includes(file.type) || file.name.endsWith(".txt");

    if (!isAllowed) {
      setFileError("Only .txt files are fully supported in the browser. For .pdf/.docx, copy-paste the text instead.");
      return;
    }

    // PDF and DOCX cannot be read as plain text in the browser without a library.
    // We read .txt files directly; for others we show a helpful message.
    if (file.type !== "text/plain" && !file.name.endsWith(".txt")) {
      setFileError(
        `"${file.name}" is a ${file.name.split(".").pop().toUpperCase()} file. ` +
        "Browsers can't extract text from this format directly — please open the file, select all (Ctrl+A), copy, and paste it here."
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      onTextChange(e.target.result);
      setFileName(file.name);
    };
    reader.onerror = () => setFileError("Could not read the file. Please try again.");
    reader.readAsText(file);
  };

  // ── Drag and drop ──────────────────────────────────────────────────────────
  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true);  };
  const handleDragLeave = ()  => setDragging(false);
  const handleDrop      = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) readFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleClearFile = () => {
    setFileName(null);
    setFileError(null);
    onClear();
  };

  return (
    <section className="input-card">
      {/* ── Card header ──────────────────────────────────────────────── */}
      <div className="input-card-header">
        <span className="input-card-title">Your Text</span>
        <div className="input-meta">
          <span>{wordCount} words</span>
          <span className="dot">·</span>
          <span>{text.length} chars</span>
        </div>
      </div>

      {/* ── File name badge (shown after successful upload) ───────────── */}
      {fileName && (
        <div className="file-badge">
          <span className="file-badge-icon">📄</span>
          <span className="file-badge-name">{fileName}</span>
          <button className="file-badge-remove" onClick={handleClearFile} title="Remove file">
            ✕
          </button>
        </div>
      )}

      {/* ── File error ────────────────────────────────────────────────── */}
      {fileError && (
        <div className="file-error">
          ⚠ {fileError}
          <button className="file-error-dismiss" onClick={() => setFileError(null)}>✕</button>
        </div>
      )}

      {/* ── Drop zone wrapper around the textarea ─────────────────────── */}
      <div
        className={`drop-zone ${dragging ? "drop-zone-active" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragging && (
          <div className="drop-overlay">
            <span className="drop-overlay-icon">📂</span>
            <span>Drop your .txt file here</span>
          </div>
        )}

        <textarea
          className="main-textarea"
          placeholder="Paste your text here, or drag & drop a .txt file onto this area…"
          value={text}
          onChange={(e) => { onTextChange(e.target.value); setFileName(null); }}
          disabled={loading}
          rows={12}
        />
      </div>

      {/* ── Progress bar (loading) ────────────────────────────────────── */}
      {loading && (
        <div className="progress-track">
          <div className="progress-bar" />
        </div>
      )}

      {/* ── Action row ───────────────────────────────────────────────── */}
      <div className="input-actions">

        {/* Hidden file input — triggered by the Upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,.doc,.docx"
          style={{ display: "none" }}
          onChange={handleFileInput}
        />

        {/* Upload button */}
        <button
          className="btn-upload"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          title="Upload a .txt file"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload File
        </button>

        {/* Clear button */}
        {(text || fileName) && !loading && (
          <button className="btn-ghost" onClick={handleClearFile}>Clear</button>
        )}

        {/* Scan button */}
        <button
          className="btn-primary"
          onClick={onScan}
          disabled={loading || !text.trim()}
        >
          {loading ? (
            <><span className="spinner" /> Analyzing…</>
          ) : (
            <>Check for Plagiarism</>
          )}
        </button>
      </div>
    </section>
  );
}