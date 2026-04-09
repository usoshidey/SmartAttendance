export default function JobStatus({ job }) {
  if (!job) return null;

  const statusColors = {
    pending: "#6366f1",
    processing: "#06b6d4",
    done: "#10b981",
    failed: "#ef4444"
  };
  const statusIcons = {
    pending: "◌",
    processing: "◎",
    done: "◉",
    failed: "✕"
  };

  const color = statusColors[job.status] || "#4a4a7a";

  return (
    <div style={{
      background: "#0d0d18", border: `1px solid ${color}33`,
      borderRadius: 12, padding: "20px 24px"
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{
          color,
          fontSize: 18,
          animation: job.status === "processing" ? "spin 2s linear infinite" : "none"
        }}>
          {statusIcons[job.status]}
        </span>
        <span style={{ color, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
          {job.status}
        </span>
        <span style={{ marginLeft: "auto", color: "#4a4a7a", fontSize: 11 }}>
          {job.id.slice(0, 8)}…
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{
        height: 4, background: "#1e1e3a", borderRadius: 2, marginBottom: 12, overflow: "hidden"
      }}>
        <div style={{
          height: "100%", width: `${job.progress}%`,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          borderRadius: 2, transition: "width 0.5s ease",
          boxShadow: job.status === "processing" ? `0 0 8px ${color}` : "none"
        }} />
      </div>

      {/* Message */}
      <div style={{ color: "#8888aa", fontSize: 12, lineHeight: 1.6 }}>
        {job.progress_message}
      </div>

      {/* Error */}
      {job.error_message && (
        <div style={{
          marginTop: 12, padding: "10px 14px",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 8, color: "#fca5a5", fontSize: 11, fontFamily: "monospace"
        }}>
          {job.error_message}
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
