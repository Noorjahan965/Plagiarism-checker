function getVerdictStyle(verdict) {
  const map = {
    original:            { label: "Original",            cls: "verdict-green"  },
    low_similarity:      { label: "Low Similarity",      cls: "verdict-yellow" },
    moderate_similarity: { label: "Moderate Similarity", cls: "verdict-orange" },
    plagiarized:         { label: "Plagiarized",         cls: "verdict-red"    },
  };
  return map[verdict] || map.original;
}

function ScoreRing({ score, verdict }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colorMap = {
    original: "#22c55e", low_similarity: "#eab308",
    moderate_similarity: "#f97316", plagiarized: "#ef4444",
  };
  const color = colorMap[verdict] || "#22c55e";

  return (
    <div className="score-ring-wrap">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="10" />
        <circle cx="65" cy="65" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "65px 65px",
                   transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)",
                   filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="score-ring-label">
        <span className="score-number">{score}%</span>
        <span className="score-sub">similarity</span>
      </div>
    </div>
  );
}

function SourceRow({ source, index }) {
  const rawScore = source.similarityScore ?? source.score ?? 0;
  const pct = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
  const barColor = pct > 60 ? "#ef4444" : pct > 30 ? "#f97316" : pct > 10 ? "#eab308" : "#22c55e";
  const domain = (() => {
    try { return new URL(source.url).hostname.replace("www.", ""); }
    catch { return source.url || "Unknown source"; }
  })();

  return (
    <div className="source-row" style={{ animationDelay: `${index * 60}ms` }}>
      <span className="source-rank">{index + 1}</span>
      <div className="source-info">
        <span className="source-domain">{domain}</span>
        {source.url && (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-url">
            {source.url}
          </a>
        )}
      </div>
      <div className="source-score-wrap">
        <span className="source-pct" style={{ color: barColor }}>{pct}%</span>
        <div className="source-bar-track">
          <div className="source-bar-fill"
            style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 8px ${barColor}66` }} />
        </div>
      </div>
      {source.url && (
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-link-icon">↗</a>
      )}
    </div>
  );
}

export default function ResultsPanel({ report }) {
  const vs = getVerdictStyle(report.verdict);
  const sources = [
    ...(report.sourceMatches || []),
    ...(report.rawPythonResponse?.results || []).filter(
      (r) => !(report.sourceMatches || []).some((m) => m.url === r.url)
    ),
  ];

  return (
    <section className="results-card">
      <div className="results-top">
        <ScoreRing score={report.plagiarismScore} verdict={report.verdict} />
        <div className="results-summary">
          <span className={`verdict-badge ${vs.cls}`}>{vs.label}</span>
          <div className="stats-grid">
            {[
              { label: "Words",     value: report.wordCount },
              { label: "Sources",   value: sources.length },
              { label: "Scan time", value: `${report.scanDurationMs ?? "—"}ms` },
              { label: "Saved",     value: new Date(report.createdAt).toLocaleTimeString() },
            ].map(({ label, value }) => (
              <div key={label} className="stat-item">
                <span className="stat-label">{label}</span>
                <span className="stat-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="sources-section">
        <h3 className="sources-title">
          Sources Checked <span className="sources-count">{sources.length}</span>
        </h3>
        {sources.length === 0 ? (
          <p className="no-sources">No matching sources were found.</p>
        ) : (
          <div className="sources-list">
            {sources.map((src, i) => <SourceRow key={src.url || i} source={src} index={i} />)}
          </div>
        )}
      </div>

      <div className="divider" />
      <div className="text-preview-section">
        <h3 className="sources-title">Scanned Text Preview</h3>
        <p className="text-preview">{report.textPreview || report.originalText?.slice(0, 200)}…</p>
      </div>
    </section>
  );
}