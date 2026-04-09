import api from "../api";

export default function AttendanceTable({ session, jobId }) {
  if (!session) return null;

  const records      = session.records || [];
  const presentCount = records.filter(r => r.status === "present").length;
  const absentCount  = records.filter(r => r.status === "absent").length;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total",   value: records.length, color: "#6366f1" },
          { label: "Present", value: presentCount,   color: "#10b981" },
          { label: "Absent",  value: absentCount,    color: "#ef4444" },
          { label: "Rate",    value: records.length ? `${Math.round(presentCount / records.length * 100)}%` : "—", color: "#f59e0b" }
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: "16px 20px", background: "#0d0d18", border: `1px solid ${s.color}22`, borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#4a4a7a", letterSpacing: 2, marginTop: 4 }}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Download buttons */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBottom: 16 }}>
        {/* Today's sheet */}
        <a href={api.downloadReport(jobId)} download style={downloadBtn("#6366f1")}>
          ⬇ Today's Sheet
        </a>
        {/* Consolidated sheet */}
        <a href={api.downloadConsolidated(session.subject_id)} download style={downloadBtn("#10b981")}>
          ⬇ Consolidated Report
        </a>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #1e1e3a", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 120px 120px", padding: "12px 20px", background: "#0a0a0f", borderBottom: "1px solid #1e1e3a" }}>
          {["Roll No.", "Name", "Status", "Similarity"].map(h => (
            <div key={h} style={{ color: "#4a4a7a", fontSize: 10, letterSpacing: 2 }}>{h.toUpperCase()}</div>
          ))}
        </div>

        {records.map((r, i) => {
          const isPresent = r.status === "present";
          return (
            <div key={r.student_id} style={{
              display: "grid", gridTemplateColumns: "1fr 2fr 120px 120px",
              padding: "14px 20px",
              borderBottom: i < records.length - 1 ? "1px solid #0f0f1e" : "none",
              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
              transition: "background 0.15s"
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"}
            >
              <div style={{ color: "#6888aa", fontSize: 12, fontFamily: "monospace" }}>{r.roll_no}</div>
              <div style={{ color: "#c8c8e8", fontSize: 13 }}>{r.name}</div>
              <div>
                <span style={{
                  padding: "3px 10px", borderRadius: 4, fontSize: 10, letterSpacing: 1, fontWeight: 600,
                  background: isPresent ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                  color: isPresent ? "#6ee7b7" : "#fca5a5",
                  border: `1px solid ${isPresent ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`
                }}>
                  {r.status.toUpperCase()}
                </span>
              </div>
              <div style={{ color: r.similarity ? "#f59e0b" : "#2a2a4a", fontSize: 12, fontFamily: "monospace" }}>
                {r.similarity ? `${(r.similarity * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Consolidated explanation */}
      <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, fontSize: 11, color: "#4a4a6a", lineHeight: 1.7 }}>
        <strong style={{ color: "#6ee7b7" }}>Consolidated Report</strong> contains all attendance sessions taken till date for this subject —
        one column per session date, total/present/absent/% summary per student, and face photos.
      </div>
    </div>
  );
}

const downloadBtn = (color) => ({
  padding: "10px 18px", borderRadius: 8, textDecoration: "none",
  background: `${color}12`, border: `1px solid ${color}30`,
  color, fontSize: 12, letterSpacing: 1, whiteSpace: "nowrap"
});
