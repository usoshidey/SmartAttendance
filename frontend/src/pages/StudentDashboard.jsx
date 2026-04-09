import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    api.studentStatus()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f",
      fontFamily: "'IBM Plex Mono', monospace", color: "#e2e2f0"
    }}>
      {/* Header */}
      <div style={{
        padding: "18px 32px", background: "#0f0f17",
        borderBottom: "1px solid #1e1e2e", display: "flex",
        justifyContent: "space-between", alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#6366f1", fontSize: 20 }}>◈</span>
          <span style={{ color: "#6366f1", fontWeight: 700, letterSpacing: 2, fontSize: 14 }}>
            SMART ATTENDANCE
          </span>
          <span style={{
            background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
            color: "#6366f1", fontSize: 10, padding: "2px 8px", borderRadius: 4, letterSpacing: 1
          }}>STUDENT</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#4a4a6a", fontSize: 12 }}>👤 {user?.name}</span>
          <button onClick={logout} style={{
            padding: "6px 16px", background: "transparent",
            border: "1px solid #2a2a3a", borderRadius: 6,
            color: "#6a6a8a", fontFamily: "inherit", fontSize: 11,
            cursor: "pointer", letterSpacing: 1
          }}>SIGN OUT</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        {loading && (
          <div style={{ textAlign: "center", color: "#4a4a6a", paddingTop: 80 }}>
            Loading your records...
          </div>
        )}

        {error && (
          <div style={{
            padding: 20, background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8,
            color: "#ef4444", fontSize: 13
          }}>{error}</div>
        )}

        {data && (
          <>
            {/* Student info card */}
            <div style={{
              background: "#0f0f17", border: "1px solid #1e1e2e",
              borderRadius: 12, padding: 24, marginBottom: 28
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#4a4a6a", fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>
                    STUDENT PROFILE
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{data.student_name}</div>
                  <div style={{ color: "#6a6a8a", fontSize: 13, marginTop: 4 }}>
                    Roll No: {data.roll_no}
                  </div>
                </div>
                <div style={{
                  textAlign: "center", padding: "14px 24px",
                  background: data.is_registered_anywhere
                    ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  border: `1px solid ${data.is_registered_anywhere ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                  borderRadius: 10
                }}>
                  <div style={{ fontSize: 22 }}>
                    {data.is_registered_anywhere ? "✅" : "⏳"}
                  </div>
                  <div style={{
                    fontSize: 11, letterSpacing: 1, marginTop: 6,
                    color: data.is_registered_anywhere ? "#22c55e" : "#ef4444"
                  }}>
                    {data.is_registered_anywhere ? "REGISTERED" : "NOT REGISTERED"}
                  </div>
                </div>
              </div>
            </div>

            {/* Not registered message */}
            {!data.is_registered_anywhere && (
              <div style={{
                padding: 24, background: "#0f0f17", border: "1px solid #1e1e2e",
                borderRadius: 12, textAlign: "center", color: "#4a4a6a"
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎓</div>
                <div style={{ fontSize: 14, marginBottom: 8, color: "#6a6a8a" }}>
                  You haven't been registered yet
                </div>
                <div style={{ fontSize: 12 }}>
                  Your teacher needs to upload a registration video and assign your name 
                  and roll number <strong style={{ color: "#e2e2f0" }}>{data.roll_no}</strong> to a cluster.
                </div>
              </div>
            )}

            {/* Subject cards */}
            {data.registrations.length > 0 && (
              <>
                <div style={{ color: "#4a4a6a", fontSize: 11, letterSpacing: 1, marginBottom: 16 }}>
                  REGISTERED SUBJECTS — {data.registrations.length} found
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {data.registrations.map((reg, i) => (
                    <div key={i} style={{
                      background: "#0f0f17", border: "1px solid #1e1e2e",
                      borderRadius: 12, padding: 22
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{reg.subject_name}</div>
                          <div style={{ color: "#4a4a6a", fontSize: 11, marginTop: 3 }}>
                            {reg.subject_code} · Registered {reg.registered_at
                              ? new Date(reg.registered_at).toLocaleDateString() : "—"}
                          </div>
                        </div>
                        {reg.attendance_pct !== null && (
                          <div style={{
                            textAlign: "center", minWidth: 70,
                            color: reg.attendance_pct >= 75 ? "#22c55e"
                              : reg.attendance_pct >= 50 ? "#f59e0b" : "#ef4444"
                          }}>
                            <div style={{ fontSize: 22, fontWeight: 700 }}>
                              {reg.attendance_pct}%
                            </div>
                            <div style={{ fontSize: 10, letterSpacing: 1, marginTop: 2 }}>
                              ATTENDANCE
                            </div>
                          </div>
                        )}
                      </div>

                      {reg.total_sessions > 0 ? (
                        <div style={{ marginTop: 16 }}>
                          {/* Progress bar */}
                          <div style={{
                            height: 6, background: "#1e1e2e", borderRadius: 3, overflow: "hidden"
                          }}>
                            <div style={{
                              height: "100%", borderRadius: 3,
                              width: `${reg.attendance_pct}%`,
                              background: reg.attendance_pct >= 75 ? "#22c55e"
                                : reg.attendance_pct >= 50 ? "#f59e0b" : "#ef4444",
                              transition: "width 0.5s ease"
                            }} />
                          </div>
                          <div style={{
                            display: "flex", justifyContent: "space-between",
                            marginTop: 10, fontSize: 11, color: "#4a4a6a"
                          }}>
                            <span>✅ Present: <strong style={{ color: "#22c55e" }}>{reg.present}</strong></span>
                            <span>Total sessions: {reg.total_sessions}</span>
                            <span>❌ Absent: <strong style={{ color: "#ef4444" }}>{reg.absent}</strong></span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 12, color: "#4a4a6a", fontSize: 12 }}>
                          No attendance sessions recorded yet for this subject.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
