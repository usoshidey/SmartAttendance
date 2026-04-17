import { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import StudentDashboard from "./pages/StudentDashboard";
import Dashboard from "./pages/Dashboard";
import RegisterStudents from "./pages/RegisterStudents";
import MarkAttendance from "./pages/MarkAttendance";
import StudentsPage from "./pages/StudentsPage";
import { api } from "./api";
import VerifyEmailPage from "./pages/VerifyEmailPage";

const NAV_ITEMS = [
  { id: "dashboard",  label: "Dashboard",        icon: "⬡" },
  { id: "register",   label: "Register Students", icon: "◈" },
  { id: "attendance", label: "Mark Attendance",   icon: "◉" },
  { id: "students",   label: "Student Registry",  icon: "◫" },
];

function TeacherApp() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState("dashboard");

  // ── Registration global state (survives page nav) ─────────────────────────
  const [regJobId,       setRegJobId]       = useState(null);
  const [regJobStatus,   setRegJobStatus]   = useState(null);
  const [regSubjectName, setRegSubjectName] = useState("");
  const regPollRef = useRef(null);

  // ── Attendance global state (survives page nav) ───────────────────────────
  const [attJobId,       setAttJobId]       = useState(null);
  const [attJobStatus,   setAttJobStatus]   = useState(null);
  const [attSubjectName, setAttSubjectName] = useState("");
  const attPollRef = useRef(null);

  // Poll registration job even when away from register page
  useEffect(() => {
    if (!regJobId || regJobStatus === "done" || regJobStatus === "failed") {
      clearInterval(regPollRef.current); return;
    }
    clearInterval(regPollRef.current);
    regPollRef.current = setInterval(async () => {
      try {
        const j = await api.getJob(regJobId);
        setRegJobStatus(j.status);
        if (j.status === "done" || j.status === "failed") clearInterval(regPollRef.current);
      } catch {}
    }, 3000);
    return () => clearInterval(regPollRef.current);
  }, [regJobId, regJobStatus]);

  // Poll attendance job even when away from attendance page
  useEffect(() => {
    if (!attJobId || attJobStatus === "done" || attJobStatus === "failed") {
      clearInterval(attPollRef.current); return;
    }
    clearInterval(attPollRef.current);
    attPollRef.current = setInterval(async () => {
      try {
        const j = await api.getJob(attJobId);
        setAttJobStatus(j.status);
        if (j.status === "done" || j.status === "failed") clearInterval(attPollRef.current);
      } catch {}
    }, 3000);
    return () => clearInterval(attPollRef.current);
  }, [attJobId, attJobStatus]);

  const isRegistering       = regJobId && regJobStatus === "processing";
  const isMarkingAttendance = attJobId && attJobStatus === "processing";

  const handleNavigate = (id) => {
    if (id === "attendance" && isRegistering)       return; // blocked
    if (id === "register"   && isMarkingAttendance) return; // blocked
    setPage(id);
  };

  // Registration handlers
  const handleRegStart  = (jobId, subjectName) => { setRegJobId(jobId); setRegJobStatus("processing"); setRegSubjectName(subjectName); };
  const handleRegCancel = () => { clearInterval(regPollRef.current); setRegJobId(null); setRegJobStatus(null); setRegSubjectName(""); };
  const handleRegDone   = () => setRegJobStatus("done");

  // Attendance handlers
  const handleAttStart  = (jobId, subjectName) => { setAttJobId(jobId); setAttJobStatus("processing"); setAttSubjectName(subjectName); };
  const handleAttCancel = () => { clearInterval(attPollRef.current); setAttJobId(null); setAttJobStatus(null); setAttSubjectName(""); };
  const handleAttDone   = () => setAttJobStatus("done");

  const renderPage = () => {
    switch (page) {
      case "dashboard":  return <Dashboard onNavigate={handleNavigate} />;
      case "register":
        return <RegisterStudents
          globalJobId={regJobId}
          globalJobStatus={regJobStatus}
          onJobStart={handleRegStart}
          onJobCancel={handleRegCancel}
          onJobDone={handleRegDone}
        />;
      case "attendance":
        return <MarkAttendance
          globalJobId={attJobId}
          globalJobStatus={attJobStatus}
          onJobStart={handleAttStart}
          onJobCancel={handleAttCancel}
          onJobDone={handleAttDone}
        />;
      case "students":   return <StudentsPage />;
      default:           return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (

    

    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f", fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* Sidebar */}
      <nav style={{
        width: 240, minHeight: "100vh", background: "#0d0d18",
        borderRight: "1px solid #1e1e3a", display: "flex",
        flexDirection: "column", padding: "32px 0", position: "fixed",
        top: 0, left: 0, zIndex: 100
      }}>
        <div style={{ padding: "0 28px 40px" }}>
          <div style={{ fontSize: 11, letterSpacing: 6, color: "#4a4a7a", marginBottom: 8 }}>SYSTEM</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#e0e0ff", letterSpacing: 1, lineHeight: 1.2 }}>
            Smart<br/>Attend
          </div>
          <div style={{ marginTop: 8, height: 2, width: 40, background: "linear-gradient(90deg, #6366f1, #06b6d4)" }} />
          <div style={{
            marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 4, padding: "3px 8px", fontSize: 10, color: "#6366f1", letterSpacing: 1
          }}>👨‍🏫 {user?.name}</div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: "0 16px" }}>
          {NAV_ITEMS.map(item => {
            const active   = page === item.id;
            const blocked  = (item.id === "attendance" && isRegistering) ||
                             (item.id === "register"   && isMarkingAttendance);
            return (
              <button key={item.id} onClick={() => handleNavigate(item.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                width: "100%", padding: "12px 16px", marginBottom: 4,
                background: active ? "rgba(99,102,241,0.15)" : "transparent",
                border: active ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                borderRadius: 8, cursor: blocked ? "not-allowed" : "pointer", textAlign: "left",
                color: blocked ? "#2a2a4a" : active ? "#a5b4fc" : "#4a4a7a",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: active ? 600 : 400,
                opacity: blocked ? 0.5 : 1, transition: "all 0.15s"
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
                {blocked && <span style={{ marginLeft: "auto", fontSize: 9, color: "#f59e0b" }}>LOCKED</span>}
              </button>
            );
          })}
        </div>

        {/* Registration running banner */}
        {isRegistering && (
          <div style={{ margin: "0 16px 12px", padding: "10px 12px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8 }}>
            <div style={{ color: "#a5b4fc", fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>⟳ REGISTERING</div>
            <div style={{ color: "#6a6a9a", fontSize: 10 }}>{regSubjectName}</div>
            <button onClick={handleRegCancel} style={{ marginTop: 8, padding: "4px 10px", width: "100%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, color: "#fca5a5", fontSize: 10, cursor: "pointer" }}>Cancel</button>
          </div>
        )}

        {/* Attendance running banner */}
        {isMarkingAttendance && (
          <div style={{ margin: "0 16px 12px", padding: "10px 12px", background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 8 }}>
            <div style={{ color: "#06b6d4", fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>⟳ MARKING ATTENDANCE</div>
            <div style={{ color: "#6a6a9a", fontSize: 10 }}>{attSubjectName}</div>
            <button onClick={handleAttCancel} style={{ marginTop: 8, padding: "4px 10px", width: "100%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, color: "#fca5a5", fontSize: 10, cursor: "pointer" }}>Cancel</button>
          </div>
        )}

        <div style={{ padding: "0 16px" }}>
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 16px", background: "transparent", border: "1px solid #1e1e2e", borderRadius: 8, cursor: "pointer", color: "#4a4a6a", fontFamily: "inherit", fontSize: 12 }}>
            ⇥ Sign Out
          </button>
        </div>
      </nav>

      <main style={{ marginLeft: 240, flex: 1, padding: 32 }}>
        {/* Banner shown on other pages when registration is running */}
        {isRegistering && page !== "register" && (
          <div style={{ marginBottom: 20, padding: "12px 20px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#a5b4fc", fontSize: 13 }}>⟳ Registration running for <strong>{regSubjectName}</strong></span>
            <button onClick={() => setPage("register")} style={{ marginLeft: "auto", padding: "4px 12px", background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 4, color: "#a5b4fc", fontSize: 11, cursor: "pointer" }}>View Progress</button>
            <button onClick={handleRegCancel} style={{ padding: "4px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, color: "#fca5a5", fontSize: 11, cursor: "pointer" }}>Cancel</button>
          </div>
        )}
        {/* Banner shown on other pages when attendance is running */}
        {isMarkingAttendance && page !== "attendance" && (
          <div style={{ marginBottom: 20, padding: "12px 20px", background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#06b6d4", fontSize: 13 }}>⟳ Marking attendance for <strong>{attSubjectName}</strong></span>
            <button onClick={() => setPage("attendance")} style={{ marginLeft: "auto", padding: "4px 12px", background: "rgba(6,182,212,0.2)", border: "1px solid rgba(6,182,212,0.4)", borderRadius: 4, color: "#06b6d4", fontSize: 11, cursor: "pointer" }}>View Progress</button>
            <button onClick={handleAttCancel} style={{ padding: "4px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, color: "#fca5a5", fontSize: 11, cursor: "pointer" }}>Cancel</button>
          </div>
        )}
        {renderPage()}
      </main>
    </div>
  );
}

function AppRouter() {
  const { user } = useAuth();
  if (!user) return <AuthPage />;
  if (user.role === "student") return <StudentDashboard />;
  return <TeacherApp />;
}

export default function App() {
  // Intercept /verify-email route
  const path = window.location.pathname;
  if (path === "/verify-email") {
    return (
      <AuthProvider>
        <VerifyEmailPage />
      </AuthProvider>
    );
  }
  return (
    <AuthProvider><AppRouter /></AuthProvider>
  );
}
