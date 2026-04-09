import { useState, useRef } from "react";

export default function VideoUploader({ onFileSelected, disabled = false }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [mode, setMode] = useState("upload"); // "upload" | "webcam"
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const fileInputRef = useRef();
  const mediaRecorderRef = useRef();
  const streamRef = useRef();
  const videoPreviewRef = useRef();
  const timerRef = useRef();
  const chunksRef = useRef([]);

  const handleFile = (file) => {
    if (!file) return;
    const allowed = ["video/mp4", "video/avi", "video/quicktime", "video/x-matroska", "video/webm"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp4|avi|mov|mkv|webm)$/i)) {
      alert("Please upload a video file (mp4, avi, mov, mkv, webm)");
      return;
    }
    setSelectedFile(file);
    setRecordedBlob(null);
    onFileSelected(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;

      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const file = new File([blob], `webcam_recording_${Date.now()}.webm`, { type: "video/webm" });
        setRecordedBlob(blob);
        setSelectedFile(file);
        onFileSelected(file);
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
          videoPreviewRef.current.src = URL.createObjectURL(blob);
        }
      };

      mr.start(1000);
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (e) {
      alert("Cannot access webcam: " + e.message);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const currentFile = selectedFile;

  return (
    <div style={{ width: "100%" }}>
      {/* Mode Toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["upload", "webcam"].map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setSelectedFile(null); setRecordedBlob(null); }}
            disabled={disabled}
            style={{
              padding: "8px 20px", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
              background: mode === m ? "rgba(99,102,241,0.2)" : "transparent",
              border: `1px solid ${mode === m ? "rgba(99,102,241,0.5)" : "#1e1e3a"}`,
              color: mode === m ? "#a5b4fc" : "#4a4a7a",
              fontSize: 12, letterSpacing: 1, textTransform: "uppercase",
              transition: "all 0.2s"
            }}
          >
            {m === "upload" ? "⬆ Upload File" : "◉ Record Webcam"}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? "#6366f1" : currentFile ? "#06b6d4" : "#1e1e3a"}`,
            borderRadius: 12, padding: "40px 24px", textAlign: "center",
            cursor: disabled ? "not-allowed" : "pointer",
            background: dragOver ? "rgba(99,102,241,0.05)" : currentFile ? "rgba(6,182,212,0.03)" : "transparent",
            transition: "all 0.2s"
          }}
        >
          <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }}
            onChange={e => handleFile(e.target.files[0])} />

          {currentFile ? (
            <div>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <div style={{ color: "#06b6d4", fontSize: 14, marginBottom: 4 }}>{currentFile.name}</div>
              <div style={{ color: "#4a4a7a", fontSize: 12 }}>
                {(currentFile.size / 1024 / 1024).toFixed(1)} MB
              </div>
              <div style={{ color: "#4a4a7a", fontSize: 11, marginTop: 8 }}>Click to change</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>⬡</div>
              <div style={{ color: "#4a4a7a", fontSize: 14 }}>Drop video here or click to browse</div>
              <div style={{ color: "#2a2a4a", fontSize: 11, marginTop: 8 }}>
                MP4, AVI, MOV, MKV, WebM
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ border: "1px solid #1e1e3a", borderRadius: 12, overflow: "hidden" }}>
          <video
            ref={videoPreviewRef}
            autoPlay muted
            style={{ width: "100%", height: 240, objectFit: "cover", background: "#0a0a0f", display: "block" }}
          />
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, background: "#0d0d18" }}>
            {!recording && !recordedBlob && (
              <button onClick={startRecording} style={recBtnStyle("#6366f1")}>
                ◉ Start Recording
              </button>
            )}
            {recording && (
              <>
                <button onClick={stopRecording} style={recBtnStyle("#ef4444")}>
                  ■ Stop
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ef4444", fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444",
                    animation: "pulse 1s infinite", display: "inline-block" }} />
                  {formatTime(recordingTime)}
                </div>
              </>
            )}
            {recordedBlob && !recording && (
              <>
                <div style={{ color: "#06b6d4", fontSize: 13 }}>✓ Recording saved</div>
                <button onClick={() => { setRecordedBlob(null); setSelectedFile(null); }}
                  style={{ ...recBtnStyle("#4a4a7a"), marginLeft: "auto" }}>
                  Re-record
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const recBtnStyle = (color) => ({
  padding: "8px 18px", background: `${color}22`, border: `1px solid ${color}66`,
  borderRadius: 6, color: color, fontSize: 12, cursor: "pointer", letterSpacing: 1
});
