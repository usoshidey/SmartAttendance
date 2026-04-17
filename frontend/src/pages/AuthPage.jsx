import { useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const { login } = useAuth();
  const [mode, setMode]         = useState("role");
  const [form, setForm]         = useState({ name: "", email: "", roll_no: "", password: "" });
  const [verificationMsg, setVerificationMsg] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const reset = () => { setForm({ name: "", email: "", roll_no: "", password: "" }); setError(""); };

  const isTeacher = mode.includes("teacher");

  const handleCredentials = async () => {
    setError(""); setLoading(true);
    try {
      let res;
      if (mode === "teacher-login") {
        res = await api.loginTeacher(form.email, form.password);
        setVerificationMsg(res.message || "Verification email sent. Please check your inbox.");
        setMode("email-verification");
      } else if (mode === "student-login") {
        res = await api.loginStudent(form.roll_no, form.password);
        login(res);
      } else if (mode === "teacher-signup") {
        if (!form.name.trim()) { setError("Name is required"); setLoading(false); return; }
        if (form.password.length < 6) { setError("Password must be at least 6 characters"); setLoading(false); return; }
        res = await api.signupTeacher(form.name, form.email, form.password);
        setVerificationMsg(res.message || "Verification email sent. Please check your inbox.");
        setMode("email-verification");
      } else if (mode === "student-signup") {
        if (!form.name.trim()) { setError("Name is required"); setLoading(false); return; }
        if (!form.roll_no.trim()) { setError("Roll number is required"); setLoading(false); return; }
        if (form.password.length < 6) { setError("Password must be at least 6 characters"); setLoading(false); return; }
        res = await api.signupStudent(form.name, form.roll_no, form.password);
        login(res);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError(""); setLoading(true);
    try {
      const res = await api.resendVerification(form.email);
      setVerificationMsg(res.message || "Verification email resent. Please check your inbox.");
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
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 36, color: "#6366f1", marginBottom: 10 }}>◈</div>
          <div style={{ color: "#6366f1", fontSize: 16, fontWeight: 800, letterSpacing: 4 }}>SMART ATTENDANCE</div>
          <div style={{ color: "#2a2a4a", fontSize: 11, marginTop: 6, letterSpacing: 2 }}>AI-POWERED CLASSROOM SYSTEM</div>
        </div>

        <div style={{ background: "#0d0d1a", border: "1px solid #1a1a30", borderRadius: 16, padding: 36 }}>

          {mode === "role" && (
            <>
              <div style={{ fontSize: 11, letterSpacing: 3, color: "#3a3a5a", marginBottom: 24, textAlign: "center" }}>SELECT YOUR ROLE TO CONTINUE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { role: "teacher", icon: "👨‍🏫", title: "Teacher" },
                  { role: "student", icon: "🎓", title: "Student" },
                ].map(r => (
                  <div key={r.role}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: "#3a3a5a", marginBottom: 8 }}>{r.title.toUpperCase()}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <RoleBtn label="Sign In" color="#6366f1" onClick={() => { reset(); setMode(`${r.role}-login`); }} />
                      <RoleBtn label="Sign Up" color="#10b981" onClick={() => { reset(); setMode(`${r.role}-signup`); }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {mode === "teacher-login" && <>
            <FormHeader icon="👨‍🏫" title="Teacher Sign In" onBack={() => setMode("role")} />
            <Field label="Email" value={form.email} onChange={v => set("email", v)} type="email" placeholder="your@email.com" />
            <Field label="Password" value={form.password} onChange={v => set("password", v)} type="password" placeholder="••••••••" />
            <SubmitBtn loading={loading} label="Continue →" onClick={handleCredentials} />
            <SwitchLink text="Don't have an account?" link="Sign up" onClick={() => { reset(); setMode("teacher-signup"); }} />
          </>}

          {mode === "teacher-signup" && <>
            <FormHeader icon="👨‍🏫" title="Teacher Sign Up" onBack={() => setMode("role")} />
            <Field label="Full Name" value={form.name} onChange={v => set("name", v)} placeholder="Your name" />
            <Field label="Email" value={form.email} onChange={v => set("email", v)} type="email" placeholder="your@email.com" />
            <Field label="Password" value={form.password} onChange={v => set("password", v)} type="password" placeholder="Min 6 characters" />
            <SubmitBtn loading={loading} label="Create Account →" onClick={handleCredentials} />
            <SwitchLink text="Already have an account?" link="Sign in" onClick={() => { reset(); setMode("teacher-login"); }} />
          </>}

          {mode === "student-login" && <>
            <FormHeader icon="🎓" title="Student Sign In" onBack={() => setMode("role")} />
            <Field label="Roll Number" value={form.roll_no} onChange={v => set("roll_no", v)} placeholder="Your roll number" />
            <Field label="Password" value={form.password} onChange={v => set("password", v)} type="password" placeholder="••••••••" />
            <SubmitBtn loading={loading} label="Continue →" onClick={handleCredentials} />
            <SwitchLink text="Don't have an account?" link="Sign up" onClick={() => { reset(); setMode("student-signup"); }} />
          </>}

          {mode === "student-signup" && <>
            <FormHeader icon="🎓" title="Student Sign Up" onBack={() => setMode("role")} />
            <Field label="Full Name" value={form.name} onChange={v => set("name", v)} placeholder="Your name" />
            <Field label="Roll Number" value={form.roll_no} onChange={v => set("roll_no", v)} placeholder="Same as registered by teacher" />
            <Field label="Password" value={form.password} onChange={v => set("password", v)} type="password" placeholder="Min 6 characters" />
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, color: "#6366f1", fontSize: 11, lineHeight: 1.7 }}>⚠ Use the exact roll number your teacher used when registering you.</div>
            <SubmitBtn loading={loading} label="Create Account →" onClick={handleCredentials} />
            <SwitchLink text="Already have an account?" link="Sign in" onClick={() => { reset(); setMode("student-login"); }} />
          </>}

          {mode === "email-verification" && <>
            <FormHeader icon="📧" title="Check Your Email" onBack={() => { setMode(isTeacher ? "teacher-login" : "role"); }} />
            <div style={{ marginBottom: 24, padding: 20, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
              <div style={{ color: "#6ee7b7", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Verification Email Sent</div>
              <div style={{ color: "#a5b4fc", fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>{verificationMsg}</div>
              <div style={{ color: "#3a3a5a", fontSize: 11 }}>Click the link in the email to verify and access your account.</div>
            </div>
            <div style={{ padding: "12px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, color: "#6366f1", fontSize: 11, lineHeight: 1.6, marginBottom: 16 }}>💡 Check your spam/junk folder if you don't see the email. It may be marked as spam.</div>
            <button onClick={handleResendVerification} disabled={loading} style={{
              width: "100%", padding: "13px",
              background: loading ? "#1a1a30" : "linear-gradient(135deg, #6366f1, #4f46e5)",
              border: "none", borderRadius: 8, color: "#fff",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              letterSpacing: 1, cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity 0.2s", opacity: loading ? 0.6 : 1
            }}>{loading ? "Sending..." : "Resend Verification Email"}</button>
            <button onClick={() => { setMode("teacher-login"); reset(); }} style={{
              width: "100%", marginTop: 10, padding: "8px",
              background: "transparent", border: "none",
              color: "#4a4a6a", fontSize: 11, cursor: "pointer", letterSpacing: 1
            }}>← Back to Login</button>
          </>}

          {error && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#ef4444", fontSize: 12 }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

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
          outline: "none", boxSizing: "border-box",
          transition: "border-color 0.2s"
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
