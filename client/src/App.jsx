import { useState, useEffect } from "react";
import TextInputPanel from "./components/TextInputPanel";
import ResultsPanel from "./components/ResultsPanel";
import HistorySidebar from "./components/HistorySidebar";
import StatusBanner from "./components/StatusBanner";
import "./index.css";

const API_BASE = "http://localhost:4000/api";

export default function App() {
  const [text, setText]       = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport]   = useState(null);
  const [error, setError]     = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/scan`);
      const data = await res.json();
      setHistory(data.reports || []);
    } catch {
      // history is optional
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleScan = async () => {
    if (!text.trim()) { setError("Please enter some text before scanning."); return; }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res  = await fetch(`${API_BASE}/scan`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Server returned an error.");
      setReport(data.report);
      fetchHistory();
    } catch (err) {
      setError(
        err.message.toLowerCase().includes("fetch")
          ? "Cannot reach the server. Make sure your Node backend is running on port 4000."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySelect = (r) => {
    setReport(r);
    setError(null);
    setText(r.originalText || "");
    setHistoryOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClear = () => { setText(""); setReport(null); setError(null); };

  return (
    <div className="app-root">
      <div className="bg-blob blob-1" />
      <div className="bg-blob blob-2" />
      <div className="bg-blob blob-3" />

      <header className="topbar">
        <div className="topbar-inner">
          <div className="logo">
            <span className="logo-mark">P/</span>
            <span className="logo-text">PlagiaCheck</span>
          </div>
          <button className="history-btn" onClick={() => { setHistoryOpen(true); fetchHistory(); }}>
            History
            {history.length > 0 && <span className="badge">{history.length}</span>}
          </button>
        </div>
      </header>

      <main className="main-layout">
        <div className="hero">
          <span className="eyebrow">Academic integrity · Real-time analysis</span>
          <h1 className="hero-title">Detect Plagiarism<br /><em>with Precision</em></h1>
          <p className="hero-sub">
            Paste any text and we'll compare it against live web sources,
            returning a detailed similarity report in seconds.
          </p>
        </div>

        {error && <StatusBanner message={error} onDismiss={() => setError(null)} />}

        <TextInputPanel
          text={text}
          onTextChange={setText}
          onScan={handleScan}
          onClear={handleClear}
          loading={loading}
        />

        {report && <ResultsPanel report={report} />}
      </main>

      <HistorySidebar
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        loading={historyLoading}
        onSelect={handleHistorySelect}
      />
      {historyOpen && <div className="backdrop" onClick={() => setHistoryOpen(false)} />}
    </div>
  );
}