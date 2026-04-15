import { useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

// ── Modes ─────────────────────────────────────────────────────────────────────
// "role"           → pick Teacher or Student
// "teacher-login"  → email + password → sends magic link
// "student-login"  → roll_no + password → direct JWT login
// "teacher-signup" → name + email + password → sends magic link
// "student-signup" → name + roll_no + password → direct JWT signup
// "email-sent"     → waiting screen shown after teacher login/signup

export default function AuthPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState("role");
  const [form, setForm] = useState({ name: "", email: "", roll_no: "", password: "" });
  const [sentEmail, setSentEmail] = useState(""); // masked email shown on waiting screen
  const [devLink, setDevLink] = useState(""); // dev fallback when SMTP not configured
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const reset = () => { setForm({ name: "", email: "", roll_no: "", password: "" }); setError(""); };

  // ── Submit credentials ────────────────────────────────────────────────────
  const handleCredentials = async () => {
    setError(""); setLoading(true);
    try {
      let res;
      if (mode === "teacher-login") {
        res = await api.loginTeacher(form.email, form.password);
      } else if (mode === "student-login") {
        res = await api.loginStudent(form.roll_no, form.password);
      } else if (mode === "teacher-signup") {
        if (!form.name.trim()) { setError("Name is required"); setLoading(false); return; }
        if (form.password.length < 6) { setError("Password must be at least 6 characters"); setLoading(false); return; }
        res = await api.signupTeacher(form.name, form.email, form.password);
      } else if (mode === "student-signup") {
        if (!form.name.trim()) { setError("Name is required"); setLoading(false); return; }
        if (!form.roll_no.trim()) { setError("Roll number is required"); setLoading(false); return; }
        if (form.password.length < 6) { setError("Password must be at least 6 characters"); setLoading(false); return; }
        res = await api.signupStudent(form.name, form.roll_no, form.password);
      }

      // Students (login/signup) get a JWT directly in the response
      if (res.access_token) {
        login(res);
        return;
      }

      // Teachers: backend sent a magic link email
      setSentEmail(res.message || "Check your inbox.");
      setDevLink(res.dev_link || "");
      setMode("email-sent");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#06060f",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'IBM Plex Mono', monospace"
    }}>
      <div style={{ width: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 36, color: "#6366f1", marginBottom: 10 }}>◈</div>
          <div style={{ color: "#6366f1", fontSize: 16, fontWeight: 800, letterSpacing: 4 }}>
            SMART ATTENDANCE
          </div>
          <div style={{ color: "#2a2a4a", fontSize: 11, marginTop: 6, letterSpacing: 2 }}>
            AI-POWERED CLASSROOM SYSTEM
          </div>
        </div>

        <div style={{ background: "#0d0d1a", border: "1px solid #1a1a30", borderRadius: 16, padding: 36 }}>

          {/* ── Role Selection ── */}
          {mode === "role" && (
            <>
              <div style={{ fontSize: 11, letterSpacing: 3, color: "#3a3a5a", marginBottom: 24, textAlign: "center" }}>
                SELECT YOUR ROLE TO CONTINUE
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { role: "teacher", icon: "👨‍🏫", title: "Teacher", sub: "Manage subjects, register students, mark attendance" },
                  { role: "student", icon: "🎓", title: "Student", sub: "View your registration status and attendance records" },
                ].map(r => (
                  <div key={r.role}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: "#3a3a5a", marginBottom: 8 }}>
                      {r.title.toUpperCase()}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <RoleBtn label="Sign In" color="#6366f1" onClick={() => { reset(); setMode(`${r.role}-login`); }} />
                      <RoleBtn label="Sign Up" color="#10b981" onClick={() => { reset(); setMode(`${r.role}-signup`); }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Teacher Login ── */}
          {mode === "teacher-login" && (
            <>
              <FormHeader icon="👨‍🏫" title="Teacher Sign In" onBack={() => setMode("role")} />
              <Field label="Email" value={form.email} onChange={v => set("email", v)} type="email" placeholder="your@email.com" />
              <Field label="Password" value={form.password} onChange={v => set("password", v)} type="password" placeholder="••••••••" />
              <SubmitBtn loading={loading} label="Continue →" onClick={handleCredentials} />
              <SwitchLink text="Don't have an account?" link="Sign up" onClick={() => { reset(); setMode("teacher-signup"); }} />
            </>
          )}

          {/* ── Teacher Signup ── */}
          {mode === "teacher-signup" && (
            <>
              <FormHeader icon="👨‍🏫" title="Teacher Sign Up" onBack={() => setMode("role")} />
              <Field label="Full Name" value={form.name} onChange={v => set("name", v)} placeholder="Your name" />
              <Field label="Email" value={form.email} onChange={v => set("email", v)} type="email" placeholder="your@email.com" />
              <Field label="Password" value={form.password} onChange={v => set("password", v)} type="password" placeholder="Min 6 characters" />
              <SubmitBtn loading={loading} label="Create Account →" onClick={handleCredentials} />
              <SwitchLink text="Already have an account?" link="Sign in" onClick={() => { reset(); setMode("teacher-login"); }} />
            </>
          )}

          {/* ── Student Login ── */}
          {mode === "student-login" && (
            <>
              <FormHeader icon="🎓" title="Student Sign In" onBack={() => setMode("role")} />
              <Field label="Roll Number" value={form.roll_no} onChange={v => set("roll_no", v)} placeholder="Your roll number" />
              <Field label="Password" value={form.password} onChange={v => set("password", v)} type="password" placeholder="••••••••" />
              <SubmitBtn loading={loading} label="Sign In →" onClick={handleCredentials} />
              <SwitchLink text="Don't have an account?" link="Sign up" onClick={() => { reset(); setMode("student-signup"); }} />
            </>
          )}

          {/* ── Student Signup ── */}
          {mode === "student-signup" && (
            <>
              <FormHeader icon="🎓" title="Student Sign Up" onBack={() => setMode("role")} />
              <Field label="Full Name" value={form.name} onChange={v => set("name", v)} placeholder="Your name" />
              <Field label="Roll Number" value={form.roll_no} onChange={v => set("roll_no", v)} placeholder="Same as registered by teacher" />
              <Field label="Password" value={form.password} onChange={v => set("password", v)} type="password" placeholder="Min 6 characters" />
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, color: "#6366f1", fontSize: 11, lineHeight: 1.7 }}>
                ⚠ Use the exact roll number your teacher used when registering you.
              </div>
              <SubmitBtn loading={loading} label="Create Account →" onClick={handleCredentials} />
              <SwitchLink text="Already have an account?" link="Sign in" onClick={() => { reset(); setMode("student-login"); }} />
            </>
          )}

          {/* ── Email Sent (magic link waiting screen) ── */}
          {mode === "email-sent" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
                <div style={{ color: "#e0e0ff", fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
                  Check Your Email
                </div>
                <div style={{ color: "#5a5a8a", fontSize: 12, lineHeight: 1.7 }}>
                  {sentEmail}
                </div>
                <div style={{ marginTop: 20, padding: "14px 18px", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10 }}>
                  <div style={{ color: "#6ee7b7", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    ✓ Verification link sent
                  </div>
                  <div style={{ color: "#3a5a4a", fontSize: 11 }}>
                    Click the link in your email to sign in. It expires in 15 minutes.
                  </div>
                </div>
              </div>

              {/* Dev fallback — shown only when SMTP not configured */}
              {devLink && (
                <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8 }}>
                  <div style={{ color: "#f59e0b", fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>
                    ⚙ DEV MODE — SMTP NOT CONFIGURED
                  </div>
                  <div style={{ color: "#6a5a2a", fontSize: 10, marginBottom: 10 }}>
                    Click this link to verify (only visible in dev mode):
                  </div>
                  <a
                    href={devLink}
                    style={{ display: "block", padding: "8px 12px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, color: "#fbbf24", fontSize: 11, wordBreak: "break-all", textDecoration: "none" }}
                  >
                    {devLink}
                  </a>
                </div>
              )}

              <button
                onClick={() => { reset(); setMode("role"); setDevLink(""); setSentEmail(""); }}
                style={{ width: "100%", marginTop: 20, padding: "10px", background: "transparent", border: "1px solid #1a1a30", borderRadius: 8, color: "#4a4a6a", fontSize: 11, cursor: "pointer", letterSpacing: 1 }}
              >
                ← Back to Login
              </button>
            </>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#ef4444", fontSize: 12 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function FormHeader({ icon, title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#4a4a6a", cursor: "pointer", fontSize: 16, padding: 0 }}>←</button>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ color: "#e0e0ff", fontWeight: 700, fontSize: 15 }}>{title}</span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#3a3a5a", marginBottom: 6 }}>{label}</div>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "11px 14px", background: "#080810",
          border: "1px solid #1a1a30", borderRadius: 8,
          color: "#e0e0ff", fontFamily: "inherit", fontSize: 13,
          outline: "none", boxSizing: "border-box", transition: "border-color 0.2s"
        }}
        onFocus={e => e.target.style.borderColor = "#6366f1"}
        onBlur={e => e.target.style.borderColor = "#1a1a30"}
      />
    </div>
  );
}

function SubmitBtn({ loading, label, onClick }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      width: "100%", marginTop: 8, padding: "13px",
      background: loading ? "#1a1a30" : "linear-gradient(135deg, #6366f1, #4f46e5)",
      border: "none", borderRadius: 8, color: "#fff",
      fontFamily: "inherit", fontSize: 13, fontWeight: 700,
      letterSpacing: 1, cursor: loading ? "not-allowed" : "pointer",
      transition: "opacity 0.2s", opacity: loading ? 0.6 : 1
    }}>
      {loading ? "Please wait..." : label}
    </button>
  );
}

function RoleBtn({ label, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "11px", borderRadius: 8, cursor: "pointer",
      background: `${color}12`, border: `1px solid ${color}30`,
      color, fontFamily: "inherit", fontSize: 12, fontWeight: 600,
      transition: "all 0.15s"
    }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.borderColor = `${color}55`; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}12`; e.currentTarget.style.borderColor = `${color}30`; }}>
      {label}
    </button>
  );
}

function SwitchLink({ text, link, onClick }) {
  return (
    <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#3a3a5a" }}>
      {text}{" "}
      <button onClick={onClick} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>
        {link}
      </button>
    </div>
  );
}