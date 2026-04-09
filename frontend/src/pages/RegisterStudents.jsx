import { useState, useEffect } from "react";
import api from "../api";
import VideoUploader from "../components/VideoUploader";
import JobStatus from "../components/JobStatus";
import useJobPoller from "../hooks/useJobPoller";

const STEPS = ["Select Subject", "Upload Video", "Auto-Saving", "Done"];

export default function RegisterStudents({
  globalJobId, globalJobStatus, onJobStart, onJobCancel, onJobDone
}) {
  const [step, setStep]                   = useState(0);
  const [subjects, setSubjects]           = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [videoFile, setVideoFile]         = useState(null);
  const [jobId, setJobId]                 = useState(globalJobId || null);
  const [savedCount, setSavedCount]       = useState(0);
  const [uploading, setUploading]         = useState(false);
  const [error, setError]                 = useState(null);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");

  // Sync with global job state when navigating back to this page
  useEffect(() => {
    if (globalJobId && globalJobStatus === "processing" && step === 0) {
      setJobId(globalJobId);
      setStep(1);
    }
    if (globalJobId && globalJobStatus === "done" && step <= 1) {
      setJobId(globalJobId);
      handleAutoSave(globalJobId);
    }
  }, [globalJobId, globalJobStatus]);

  const { job } = useJobPoller(step === 1 ? jobId : null);

  useEffect(() => {
    api.getSubjects().then(setSubjects).catch(() => {});
  }, []);

  // When job finishes, auto-save clusters
  useEffect(() => {
    if (job?.status === "done" && step === 1) {
      handleAutoSave(job.id);
    }
    if (job?.status === "failed") {
      setError("Pipeline failed. Please try again.");
    }
  }, [job?.status]);

  const handleAutoSave = async (jid) => {
    setStep(2);
    try {
      const clusters = await api.getClusters(jid);
      if (!clusters || clusters.length === 0) {
        setError("No faces detected. Try a clearer video.");
        setStep(0);
        return;
      }
      // Auto-assign: Student 1 / Roll-1, Student 2 / Roll-2, etc.
      const assignments = clusters.map((c, i) => ({
        cluster_id: c.cluster_id,
        name:    `Student ${i + 1}`,
        roll_no: `Roll-${i + 1}`
      }));
      await api.assignClusters(jid, selectedSubjectId || job?.subject_id, assignments);
      setSavedCount(assignments.length);
      onJobDone?.();
      setStep(3);
    } catch (e) {
      setError(e.message);
      setStep(0);
    }
  };

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim() || !newSubjectCode.trim()) return;
    try {
      const s = await api.createSubject({ name: newSubjectName.trim(), code: newSubjectCode.trim() });
      setSubjects(prev => [...prev, s]);
      setSelectedSubjectId(s.id);
      setShowNewSubject(false);
      setNewSubjectName(""); setNewSubjectCode("");
    } catch (e) { setError(e.message); }
  };

  const handleUpload = async () => {
    if (!videoFile || !selectedSubjectId) return;
    setUploading(true); setError(null);
    try {
      const j = await api.uploadRegistrationVideo(videoFile, selectedSubjectId);
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

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 10, letterSpacing: 6, color: "#4a4a7a", marginBottom: 8 }}>PIPELINE</div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "#e0e0ff" }}>Register Students</h1>
        <div style={{ color: "#4a4a7a", fontSize: 13, marginTop: 6 }}>
          Upload a class video → AI detects faces → Auto-registered (rename in Student Registry)
        </div>
      </div>

      {/* Step Indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 40 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: i < step ? "rgba(16,185,129,0.2)" : i === step ? "rgba(99,102,241,0.2)" : "transparent",
              border: `1px solid ${i < step ? "#10b981" : i === step ? "#6366f1" : "#1e1e3a"}`,
              color: i < step ? "#6ee7b7" : i === step ? "#a5b4fc" : "#2a2a4a",
              fontSize: 11, fontWeight: 700
            }}>{i < step ? "✓" : i + 1}</div>
            <span style={{ marginLeft: 8, fontSize: 12, color: i === step ? "#c8c8e8" : "#4a4a7a", marginRight: i < STEPS.length - 1 ? 8 : 0 }}>{s}</span>
            {i < STEPS.length - 1 && <div style={{ width: 40, height: 1, margin: "0 12px", background: i < step ? "#10b981" : "#1e1e3a" }} />}
          </div>
        ))}
      </div>

      {error && <div style={{ padding: "12px 16px", marginBottom: 24, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#fca5a5", fontSize: 13 }}>{error}</div>}

      {/* Step 0: Select + Upload */}
      {step === 0 && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 11, letterSpacing: 2, color: "#4a4a7a", display: "block", marginBottom: 12 }}>SELECT SUBJECT</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {subjects.map(s => (
                <button key={s.id} onClick={() => setSelectedSubjectId(s.id)} style={{
                  padding: "8px 16px", borderRadius: 6, cursor: "pointer",
                  background: selectedSubjectId === s.id ? "rgba(99,102,241,0.2)" : "transparent",
                  border: `1px solid ${selectedSubjectId === s.id ? "rgba(99,102,241,0.5)" : "#1e1e3a"}`,
                  color: selectedSubjectId === s.id ? "#a5b4fc" : "#6666aa", fontSize: 12
                }}>
                  <span style={{ opacity: 0.5, marginRight: 6 }}>{s.code}</span>{s.name}
                </button>
              ))}
              <button onClick={() => setShowNewSubject(!showNewSubject)} style={{
                padding: "8px 16px", borderRadius: 6, cursor: "pointer",
                background: "transparent", border: "1px dashed #1e1e3a", color: "#4a4a7a", fontSize: 12
              }}>+ New Subject</button>
            </div>
            {showNewSubject && (
              <div style={{ marginTop: 16, padding: 16, background: "#0d0d18", border: "1px solid #1e1e3a", borderRadius: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input placeholder="Subject Name" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} style={{ ...inputSt, width: 200 }} />
                <input placeholder="Code (e.g. EE201)" value={newSubjectCode} onChange={e => setNewSubjectCode(e.target.value)} style={{ ...inputSt, width: 140 }} />
                <button onClick={handleCreateSubject} style={btnSt("#6366f1")}>Create</button>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 11, letterSpacing: 2, color: "#4a4a7a", display: "block", marginBottom: 12 }}>UPLOAD CLASS VIDEO</label>
            <VideoUploader onFileSelected={setVideoFile} disabled={!selectedSubjectId} />
          </div>
          <button onClick={handleUpload} disabled={!videoFile || !selectedSubjectId || uploading} style={{
            ...btnSt("#6366f1"), padding: "14px 32px", fontSize: 13, width: "100%",
            opacity: (!videoFile || !selectedSubjectId) ? 0.4 : 1,
            cursor: (!videoFile || !selectedSubjectId) ? "not-allowed" : "pointer"
          }}>
            {uploading ? "Uploading..." : "⬆ Start Registration Pipeline"}
          </button>
        </div>
      )}

      {/* Step 1: Processing */}
      {step === 1 && (
        <div style={{ maxWidth: 540 }}>
          <div style={{ color: "#8888aa", fontSize: 13, marginBottom: 20 }}>
            Processing video for <span style={{ color: "#a5b4fc" }}>{selectedSubject?.name}</span>. You can navigate to other pages — registration continues in background.
          </div>
          <JobStatus job={job} />
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            {job?.status === "failed" && (
              <button onClick={() => { setStep(0); setJobId(null); }} style={btnSt("#ef4444")}>← Try Again</button>
            )}
            <button onClick={handleCancel} style={btnSt("#ef4444")}>✕ Cancel Registration</button>
          </div>
        </div>
      )}

      {/* Step 2: Auto-saving */}
      {step === 2 && (
        <div style={{ maxWidth: 540, textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 16, animation: "spin 1s linear infinite" }}>⟳</div>
          <div style={{ color: "#a5b4fc", fontSize: 14 }}>Auto-registering students...</div>
          <div style={{ color: "#4a4a7a", fontSize: 12, marginTop: 8 }}>Assigning temporary names and roll numbers</div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <div style={{ maxWidth: 540 }}>
          <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>◉</div>
            <h2 style={{ color: "#10b981", marginBottom: 8 }}>Registration Complete!</h2>
            <p style={{ color: "#8888aa", fontSize: 14 }}>
              <strong style={{ color: "#e0e0ff" }}>{savedCount}</strong> students auto-registered as <em>Student 1, Student 2...</em>
            </p>
          </div>
          <div style={{
            padding: 20, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 10, marginBottom: 20
          }}>
            <div style={{ color: "#a5b4fc", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              ✏ Next Step: Edit Names in Student Registry
            </div>
            <div style={{ color: "#6a6a9a", fontSize: 12, lineHeight: 1.7 }}>
              Go to <strong style={{ color: "#e0e0ff" }}>Student Registry</strong> → click the <strong style={{ color: "#e0e0ff" }}>Edit</strong> button on each student card → update their real name and roll number.
            </div>
          </div>
          <button onClick={() => { setStep(0); setJobId(null); setSavedCount(0); setVideoFile(null); onJobCancel?.(); }}
            style={{ ...btnSt("#6366f1"), padding: "12px 28px" }}>
            Register Another Batch
          </button>
        </div>
      )}
    </div>
  );
}

const inputSt = { padding: "9px 12px", background: "#0a0a0f", border: "1px solid #1e1e3a", borderRadius: 6, color: "#c8c8e8", fontSize: 12, outline: "none", fontFamily: "'IBM Plex Mono', monospace" };
const btnSt = (color) => ({ padding: "10px 20px", borderRadius: 8, cursor: "pointer", background: `${color}20`, border: `1px solid ${color}55`, color, fontSize: 12, letterSpacing: 0.5, transition: "all 0.2s" });
