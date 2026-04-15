import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

/**
 * VerifyEmailPage
 * Rendered when the URL contains ?token=...
 * Calls GET /auth/verify-email?token=... and logs the user in on success.
 */
export default function VerifyEmailPage({ token }) {
    const { login } = useAuth();
    const [status, setStatus] = useState("loading"); // "loading" | "success" | "error"
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        if (!token) { setStatus("error"); setErrorMsg("No verification token found."); return; }
        api.verifyEmailToken(token)
            .then(res => {
                login(res);       // sets JWT + user, triggers redirect
                setStatus("success");
            })
            .catch(err => {
                setErrorMsg(err.message || "This link is invalid or has expired.");
                setStatus("error");
            });
    }, [token]);

    const containerStyle = {
        minHeight: "100vh", background: "#06060f",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'IBM Plex Mono', monospace"
    };

    const cardStyle = {
        width: 420, background: "#0d0d1a",
        border: "1px solid #1a1a30", borderRadius: 16, padding: 40,
        textAlign: "center"
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                {/* Logo */}
                <div style={{ fontSize: 30, color: "#6366f1", marginBottom: 8 }}>◈</div>
                <div style={{ color: "#6366f1", fontSize: 14, fontWeight: 800, letterSpacing: 4, marginBottom: 32 }}>
                    SMART ATTENDANCE
                </div>

                {status === "loading" && (
                    <>
                        <div style={{ fontSize: 40, marginBottom: 16, animation: "spin 1.5s linear infinite" }}>⟳</div>
                        <div style={{ color: "#a5b4fc", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                            Verifying your email…
                        </div>
                        <div style={{ color: "#3a3a5a", fontSize: 11 }}>Please wait a moment.</div>
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                        <div style={{ color: "#6ee7b7", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                            Verified! Signing you in…
                        </div>
                        <div style={{ color: "#3a5a4a", fontSize: 11 }}>Redirecting to your dashboard.</div>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
                        <div style={{ color: "#ef4444", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                            Verification Failed
                        </div>
                        <div style={{
                            padding: "12px 16px", background: "rgba(239,68,68,0.08)",
                            border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10,
                            color: "#fca5a5", fontSize: 12, lineHeight: 1.6, marginBottom: 24
                        }}>
                            {errorMsg}
                        </div>
                        <a href="/" style={{
                            display: "block", padding: "12px", background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                            borderRadius: 8, color: "#fff", textDecoration: "none",
                            fontSize: 13, fontWeight: 700, letterSpacing: 1
                        }}>
                            ← Back to Login
                        </a>
                    </>
                )}
            </div>
        </div>
    );
}
