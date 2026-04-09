import { useState, useEffect } from "react";
import api from "../api";

export default function Dashboard({ onNavigate }) {
  const [stats, setStats]                 = useState(null);
  const [recentJobs, setRecentJobs]       = useState([]);
  const [subjects, setSubjects]           = useState([]);
  const [showSubjects, setShowSubjects]   = useState(false);
  const [activeSubject, setActiveSubject] = useState(null);
  const [subjectGraph, setSubjectGraph]   = useState(null);
  const [loadingGraph, setLoadingGraph]   = useState(false);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
    api.listJobs(null, 5).then(setRecentJobs).catch(() => {});
    api.getSubjects().then(setSubjects).catch(() => {});
  }, []);

  const handleSubjectClick = async (sub) => {
    if (activeSubject?.id === sub.id) {
      setActiveSubject(null); setSubjectGraph(null); return;
    }
    setActiveSubject(sub); setLoadingGraph(true); setSubjectGraph(null);
    try {
      const history = await api.getAttendanceHistory(sub.id, 10);
      setSubjectGraph(history);
    } catch { setSubjectGraph([]); }
    finally { setLoadingGraph(false); }
  };

  const graphStats = subjectGraph ? (() => {
    if (!subjectGraph.length) return null;
    const rows = subjectGraph.map(s => {
      const total   = s.records?.length   || 0;
      const present = s.records?.filter(r => r.status === "present").length || 0;
      return { date: s.date, pct: total > 0 ? Math.round(present / total * 100) : 0, present, total };
    }).reverse();
    const avg = Math.round(rows.reduce((a, r) => a + r.pct, 0) / rows.length);
    return { rows, avg };
  })() : null;

  return (
    <div style={{ color: "#e2e2f0" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ fontSize: 10, letterSpacing: 8, color: "#3a3a5a", marginBottom: 10, textTransform: "uppercase" }}>Overview</div>
        <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, color: "#f0f0ff", letterSpacing: -1 }}>Dashboard</h1>
        <div style={{ marginTop: 8, color: "#3a3a5a", fontSize: 12, letterSpacing: 1 }}>
          AI-POWERED ATTENDANCE TRACKING SYSTEM
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "SUBJECTS",     value: stats?.total_subjects,    color: "#6366f1", icon: "◈", clickable: true },
          { label: "STUDENTS",     value: stats?.total_students,    color: "#06b6d4", icon: "◫" },
          { label: "SESSIONS",     value: stats?.total_sessions,    color: "#10b981", icon: "◉" },
          { label: "LAST SESSION", value: stats?.last_session_date || "—", color: "#f59e0b", icon: "◌", small: true },
        ].map(c => (
          <div key={c.label}
            onClick={c.clickable ? () => setShowSubjects(v => !v) : undefined}
            style={{
              padding: "26px 22px", borderRadius: 14, position: "relative", overflow: "hidden",
              background: `linear-gradient(135deg, #0f0f1c 60%, ${c.color}10)`,
              border: `1px solid ${showSubjects && c.clickable ? c.color + "55" : c.color + "18"}`,
              cursor: c.clickable ? "pointer" : "default",
              boxShadow: c.clickable && showSubjects ? `0 0 24px ${c.color}18` : "none",
              transition: "all 0.2s"
            }}>
            <div style={{ position: "absolute", right: 14, top: 14, fontSize: 44, opacity: 0.07, color: c.color }}>{c.icon}</div>
            <div style={{ fontSize: c.small ? 20 : 34, fontWeight: 800, color: c.color, letterSpacing: -1 }}>
              {stats ? c.value : "—"}
            </div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#3a3a5a", marginTop: 8 }}>{c.label}</div>
            {c.clickable && (
              <div style={{ fontSize: 9, color: c.color, opacity: 0.7, marginTop: 6, letterSpacing: 1 }}>
                {showSubjects ? "▲ HIDE" : "▼ VIEW ALL"}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Subjects Panel ── */}
      {showSubjects && (
        <div style={{
          marginBottom: 24, borderRadius: 14,
          background: "#0c0c18", border: "1px solid #1a1a30",
          overflow: "hidden"
        }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid #1a1a30", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#6366f1", fontSize: 14 }}>◈</span>
            <span style={{ fontSize: 11, letterSpacing: 3, color: "#6366f1" }}>ALL SUBJECTS</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#3a3a5a" }}>Click a subject to see attendance</span>
          </div>
          <div style={{ padding: "16px 22px", display: "flex", flexWrap: "wrap", gap: 10 }}>
            {subjects.length === 0 ? (
              <div style={{ color: "#3a3a5a", fontSize: 13 }}>No subjects created yet.</div>
            ) : subjects.map(s => {
              const active = activeSubject?.id === s.id;
              return (
                <button key={s.id} onClick={() => handleSubjectClick(s)} style={{
                  padding: "11px 18px", borderRadius: 9, cursor: "pointer", transition: "all 0.18s",
                  background: active ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(99,102,241,0.6)" : "#1e1e35"}`,
                  boxShadow: active ? "0 0 16px rgba(99,102,241,0.15)" : "none"
                }}>
                  <div style={{ color: active ? "#a5b4fc" : "#c0c0d8", fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ color: active ? "#6366f1" : "#3a3a5a", fontSize: 10, marginTop: 3, letterSpacing: 1 }}>{s.code}</div>
                </button>
              );
            })}
          </div>

          {/* Subject attendance graph */}
          {activeSubject && (
            <div style={{ margin: "0 22px 22px", padding: 20, background: "#080812", border: "1px solid #1a1a30", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ color: "#a5b4fc", fontSize: 14, fontWeight: 700 }}>{activeSubject.name}</div>
                  <div style={{ color: "#3a3a5a", fontSize: 10, marginTop: 3, letterSpacing: 1 }}>{activeSubject.code} · ATTENDANCE HISTORY</div>
                </div>
                {graphStats && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: graphStats.avg >= 75 ? "#10b981" : graphStats.avg >= 50 ? "#f59e0b" : "#ef4444" }}>
                      {graphStats.avg}%
                    </div>
                    <div style={{ fontSize: 9, color: "#3a3a5a", letterSpacing: 1 }}>AVERAGE</div>
                  </div>
                )}
              </div>

              {loadingGraph && <div style={{ color: "#3a3a5a", fontSize: 12, padding: "20px 0" }}>Loading...</div>}

              {graphStats && graphStats.rows.length === 0 && (
                <div style={{ color: "#3a3a5a", fontSize: 12 }}>No attendance sessions recorded yet.</div>
              )}

              {graphStats && graphStats.rows.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {graphStats.rows.map((r, i) => (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ color: "#8888a8", fontSize: 11 }}>{new Date(r.date).toLocaleDateString()}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: r.pct >= 75 ? "#10b981" : r.pct >= 50 ? "#f59e0b" : "#ef4444" }}>
                          {r.pct}% <span style={{ color: "#3a3a5a", fontSize: 10, fontWeight: 400 }}>({r.present}/{r.total})</span>
                        </span>
                      </div>
                      <div style={{ height: 7, background: "#141426", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 4, width: `${r.pct}%`,
                          background: r.pct >= 75 ? "linear-gradient(90deg,#059669,#10b981)" : r.pct >= 50 ? "linear-gradient(90deg,#d97706,#f59e0b)" : "linear-gradient(90deg,#dc2626,#ef4444)",
                          transition: "width 0.6s ease"
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: "#3a3a5a", marginBottom: 14 }}>QUICK ACTIONS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { id: "register",   icon: "◈", label: "Register New Students", desc: "Upload a class video — AI detects and clusters faces automatically", color: "#6366f1" },
            { id: "attendance", icon: "◉", label: "Mark Attendance",        desc: "Upload today's class video and get instant attendance report",   color: "#06b6d4" },
          ].map(a => (
            <button key={a.id} onClick={() => onNavigate(a.id)} style={{
              padding: "26px 28px", borderRadius: 14, cursor: "pointer", textAlign: "left",
              background: `linear-gradient(135deg, #0f0f1c 60%, ${a.color}08)`,
              border: `1px solid ${a.color}18`, transition: "all 0.2s"
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${a.color}45`; e.currentTarget.style.boxShadow = `0 0 28px ${a.color}14`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${a.color}18`; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ fontSize: 26, color: a.color, marginBottom: 14, opacity: 0.9 }}>{a.icon}</div>
              <div style={{ fontSize: 15, color: "#f0f0ff", marginBottom: 7, fontWeight: 700, letterSpacing: -0.3 }}>{a.label}</div>
              <div style={{ fontSize: 11, color: "#3a3a5a", lineHeight: 1.7 }}>{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent Jobs ── */}
      {recentJobs.length > 0 && (
        <div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#3a3a5a", marginBottom: 14 }}>RECENT JOBS</div>
          <div style={{ background: "#0c0c18", border: "1px solid #1a1a30", borderRadius: 14, overflow: "hidden" }}>
            {recentJobs.map((job, i) => {
              const sc = { done: "#10b981", failed: "#ef4444", processing: "#06b6d4", pending: "#6366f1" };
              const c  = sc[job.status] || "#4a4a7a";
              return (
                <div key={job.id} style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "15px 22px",
                  borderBottom: i < recentJobs.length - 1 ? "1px solid #0e0e1e" : "none",
                  transition: "background 0.15s"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#0f0f1e"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#c0c0d8", fontSize: 12, fontWeight: 600 }}>{job.type.charAt(0).toUpperCase() + job.type.slice(1)} Job</div>
                    <div style={{ color: "#2a2a4a", fontSize: 10, marginTop: 2, fontFamily: "monospace" }}>{job.id.slice(0, 18)}…</div>
                  </div>
                  <div style={{ padding: "3px 12px", borderRadius: 20, fontSize: 9, background: `${c}15`, color: c, border: `1px solid ${c}30`, letterSpacing: 1.5 }}>
                    {job.status.toUpperCase()}
                  </div>
                  <div style={{ color: "#2a2a4a", fontSize: 10 }}>{new Date(job.created_at).toLocaleDateString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
