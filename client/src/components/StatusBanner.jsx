export default function StatusBanner({ message, onDismiss }) {
  return (
    <div className="status-banner" role="alert">
      <span className="status-message">⚠ {message}</span>
      <button className="status-dismiss" onClick={onDismiss}>✕</button>
    </div>
  );
}