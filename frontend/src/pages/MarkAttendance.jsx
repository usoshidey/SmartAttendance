import { useState, useEffect } from "react";
import api from "../api";
import VideoUploader from "../components/VideoUploader";
import JobStatus from "../components/JobStatus";
import AttendanceTable from "../components/AttendanceTable";
import useJobPoller from "../hooks/useJobPoller";

const STEPS = ["Select Subject", "Upload Video", "Results"];

export default function MarkAttendance({
  globalJobId, globalJobStatus, onJobStart, onJobCancel, onJobDone
}) {
  const [step, setStep]                   = useState(0);
  const [subjects, setSubjects]           = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [videoFile, setVideoFile]         = useState(null);
  const [jobId, setJobId]                 = useState(globalJobId || null);
  const [session, setSession]             = useState(null);
  const [uploading, setUploading]         = useState(false);
  const [error, setError]                 = useState(null);

  // Sync with global job state when navigating back to this page
  useEffect(() => {
    if (globalJobId && globalJobStatus === "processing" && step === 0) {
      setJobId(globalJobId);
      setStep(1);
    }
  }, [globalJobId, globalJobStatus]);

  const { job } = useJobPoller(step === 1 ? jobId : null);

  useEffect(() => {
    api.getSubjects().then(setSubjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (job?.status === "done" && !session) {
      api.getAttendanceByJob(job.id).then(data => {
        setSession(data);
        setStep(2);
        onJobDone?.();
        // Auto-download Excel
        const link = document.createElement("a");
        link.href = api.downloadReport(job.id);
        link.download = `attendance_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }).catch(e => setError(e.message));
    }
    if (job?.status === "failed") {
      setError("Pipeline failed. Please try again.");
      onJobDone?.();
    }
  }, [job?.status]);

  const handleUpload = async () => {
    if (!videoFile || !selectedSubjectId) return;
    setUploading(true); setError(null);
    try {
      const j = await api.uploadAttendanceVideo(videoFile, selectedSubjectId);
      setJobId(j.id);
      const subj = subjects.find(s => s.id === selectedSubjectId);
      onJobStart?.(j.id, subj?.name || "");
      setStep(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    onJobCancel?.();
    setStep(0); setJobId(null); setVideoFile(null); setError(null);
  };

  const handleReset = () => {
    setStep(0); setJobId(null); setSession(null);
    setVideoFile(null); onJobCancel?.();
  };

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  const btnSt = (color) => ({
    padding: "10px 20px", borderRadius: 8, cursor: "pointer",
    background: `${color}20`, border: `1px solid ${color}55`,
    color, fontSize: 12, letterSpacing: 0.5, transition: "all 0.2s"
  });

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 10, letterSpacing: 6, color: "#4a4a7a", marginBottom: 8 }}>PIPELINE</div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "#e0e0ff" }}>Mark Attendance</h1>
        <div style={{ color: "#4a4a7a", fontSize: 13, marginTop: 6 }}>
          Upload class video → AI matches faces → Automatic attendance
        </div>
      </div>

      {/* Step Indicator */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: i < step ? "rgba(6,182,212,0.2)" : i === step ? "rgba(99,102,241,0.2)" : "transparent",
              border: `1px solid ${i < step ? "#06b6d4" : i === step ? "#6366f1" : "#1e1e3a"}`,
              color: i < step ? "#67e8f9" : i === step ? "#a5b4fc" : "#2a2a4a",
              fontSize: 11, fontWeight: 700
            }}>
              {i < step ? "✓" : i + 1}
            </div>
            <span style={{ marginLeft: 8, fontSize: 12, marginRight: 8, color: i === step ? "#c8c8e8" : "#4a4a7a" }}>{s}</span>
            {i < STEPS.length - 1 && (
              <div style={{ width: 40, height: 1, margin: "0 8px", background: i < step ? "#06b6d4" : "#1e1e3a" }} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: "12px 16px", marginBottom: 24, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#fca5a5", fontSize: 13 }}>{error}</div>
      )}

      {/* Step 0 */}
      {step === 0 && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 11, letterSpacing: 2, color: "#4a4a7a", display: "block", marginBottom: 12 }}>SELECT SUBJECT</label>
            {subjects.length === 0 ? (
              <div style={{ padding: 20, border: "1px solid #1e1e3a", borderRadius: 8, color: "#4a4a7a", fontSize: 13 }}>
                No subjects found. Please register students first.
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {subjects.map(s => (
                  <button key={s.id} onClick={() => setSelectedSubjectId(s.id)} style={{
                    padding: "8px 16px", borderRadius: 6, cursor: "pointer",
                    background: selectedSubjectId === s.id ? "rgba(6,182,212,0.15)" : "transparent",
                    border: `1px solid ${selectedSubjectId === s.id ? "rgba(6,182,212,0.4)" : "#1e1e3a"}`,
                    color: selectedSubjectId === s.id ? "#67e8f9" : "#6666aa", fontSize: 12
                  }}>
                    <span style={{ opacity: 0.5, marginRight: 6 }}>{s.code}</span>{s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedSubject && (
            <div style={{ padding: "12px 16px", marginBottom: 24, background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 8, color: "#67e8f9", fontSize: 12 }}>
              ◉ Students registered for {selectedSubject.name}
            </div>
          )}

          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 11, letterSpacing: 2, color: "#4a4a7a", display: "block", marginBottom: 12 }}>UPLOAD CLASS VIDEO</label>
            <VideoUploader onFileSelected={setVideoFile} disabled={!selectedSubjectId} />
          </div>

          <button onClick={handleUpload} disabled={!videoFile || !selectedSubjectId || uploading} style={{
            ...btnSt("#06b6d4"), padding: "14px 32px", fontSize: 13, width: "100%",
            opacity: (!videoFile || !selectedSubjectId) ? 0.4 : 1,
            cursor: (!videoFile || !selectedSubjectId) ? "not-allowed" : "pointer"
          }}>
            {uploading ? "Uploading..." : "◉ Start Attendance Pipeline"}
          </button>
        </div>
      )}

      {/* Step 1: Processing */}
      {step === 1 && (
        <div style={{ maxWidth: 540 }}>
          <div style={{ color: "#8888aa", fontSize: 13, marginBottom: 20 }}>
            Processing attendance for <span style={{ color: "#67e8f9" }}>{selectedSubject?.name}</span>.
            You can navigate to other pages — this continues in background.
          </div>
          <JobStatus job={job} />
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            {job?.status === "failed" && (
              <button onClick={() => { setStep(0); setJobId(null); }} style={btnSt("#ef4444")}>← Try Again</button>
            )}
            <button onClick={handleCancel} style={btnSt("#ef4444")}>✕ Cancel</button>
          </div>
        </div>
      )}

      {/* Step 2: Results */}
      {step === 2 && session && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <div style={{ color: "#8888aa", fontSize: 13 }}>
                Attendance for <span style={{ color: "#67e8f9" }}>{selectedSubject?.name}</span>
                {" · "}<span style={{ color: "#c8c8e8" }}>{session.date}</span>
              </div>
              <div style={{ color: "#4a4a7a", fontSize: 11, marginTop: 4 }}>
                ✅ Excel report auto-downloaded
              </div>
            </div>
            <button onClick={handleReset} style={btnSt("#06b6d4")}>New Session</button>
          </div>
          <AttendanceTable session={session} jobId={jobId} />
        </div>
      )}
    </div>
  );
}
