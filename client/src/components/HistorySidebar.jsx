function verdictColor(verdict) {
  return { original: "#22c55e", low_similarity: "#eab308",
           moderate_similarity: "#f97316", plagiarized: "#ef4444" }[verdict] || "#22c55e";
}
function verdictLabel(verdict) {
  return { original: "Original", low_similarity: "Low",
           moderate_similarity: "Moderate", plagiarized: "Plagiarized" }[verdict] || "—";
}

export default function HistorySidebar({ open, onClose, history, loading, onSelect }) {
  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-header">
        <span className="sidebar-title">Scan History</span>
        <button className="sidebar-close" onClick={onClose}>✕</button>
      </div>

      <div className="sidebar-body">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton skeleton-pill" />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line-short" />
              </div>
            </div>
          ))
        ) : history.length === 0 ? (
          <div className="sidebar-empty">
            <span className="sidebar-empty-icon">◷</span>
            <p>No scans yet. Run your first check!</p>
          </div>
        ) : (
          history.map((r, i) => {
            const color = verdictColor(r.verdict);
            return (
              <button key={r._id} className="history-row" onClick={() => onSelect(r)}
                style={{ animationDelay: `${i * 40}ms` }}>
                <span className="history-score"
                  style={{ color, borderColor: color, background: `${color}18` }}>
                  {r.plagiarismScore}%
                </span>
                <div className="history-info">
                  <span className="history-preview">
                    {r.textPreview || r.originalText?.slice(0, 70) || "—"}
                  </span>
                  <div className="history-meta">
                    <span style={{ color }}>{verdictLabel(r.verdict)}</span>
                    <span className="history-dot">·</span>
                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                    <span className="history-dot">·</span>
                    <span>{r.wordCount} words</span>
                  </div>
                </div>
                <span className="history-arrow">→</span>
              </button>
            );
          })
        )}
      </div>

      {history.length > 0 && !loading && (
        <div className="sidebar-footer">{history.length} scan{history.length !== 1 ? "s" : ""} saved</div>
      )}
    </aside>
  );
}