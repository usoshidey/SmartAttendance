import { useState } from "react";
import api from "../api";

const BASE_URL = "/api";

export default function ClusterGrid({ clusters, jobId, subjectId, onSaved }) {
  // assignments[cluster_id] = { name, roll_no }
  const [assignments, setAssignments] = useState(() => {
    const init = {};
    clusters.forEach(c => { init[c.cluster_id] = { name: "", roll_no: "" }; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);

  const updateAssignment = (clusterId, field, value) => {
    setAssignments(prev => ({
      ...prev,
      [clusterId]: { ...prev[clusterId], [field]: value }
    }));
  };

  const completedCount = Object.values(assignments).filter(
    a => a.name.trim() && a.roll_no.trim()
  ).length;

  const handleSave = async () => {
    const filled = Object.entries(assignments)
      .filter(([, v]) => v.name.trim() && v.roll_no.trim())
      .map(([cluster_id, v]) => ({
        cluster_id: parseInt(cluster_id),
        name: v.name.trim(),
        roll_no: v.roll_no.trim()
      }));

    if (filled.length === 0) {
      setError("Please fill in at least one student's name and roll number.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.assignClusters(jobId, subjectId, filled);
      onSaved(filled.length);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Summary Bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", background: "#0d0d18",
        border: "1px solid #1e1e3a", borderRadius: 10, marginBottom: 24
      }}>
        <div style={{ color: "#8888aa", fontSize: 13 }}>
          <span style={{ color: "#e0e0ff", fontWeight: 600 }}>{clusters.length}</span> clusters found
          &nbsp;·&nbsp;
          <span style={{ color: "#10b981", fontWeight: 600 }}>{completedCount}</span> assigned
        </div>
        <button
          onClick={handleSave}
          disabled={saving || completedCount === 0}
          style={{
            padding: "10px 24px", borderRadius: 8,
            background: completedCount > 0 && !saving ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${completedCount > 0 && !saving ? "rgba(16,185,129,0.4)" : "#1e1e3a"}`,
            color: completedCount > 0 && !saving ? "#6ee7b7" : "#2a2a4a",
            cursor: completedCount > 0 && !saving ? "pointer" : "not-allowed",
            fontSize: 13, letterSpacing: 0.5, transition: "all 0.2s"
          }}
        >
          {saving ? "Saving..." : `Save ${completedCount} Student${completedCount !== 1 ? "s" : ""}`}
        </button>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px", marginBottom: 20,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 8, color: "#fca5a5", fontSize: 13
        }}>{error}</div>
      )}

      {/* Cluster Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 20
      }}>
        {clusters.map(cluster => {
          const asgn = assignments[cluster.cluster_id] || {};
          const isAssigned = asgn.name?.trim() && asgn.roll_no?.trim();
          const isSelected = selectedCluster === cluster.cluster_id;

          return (
            <div
              key={cluster.cluster_id}
              style={{
                background: "#0d0d18",
                border: `1px solid ${isAssigned ? "rgba(16,185,129,0.3)" : isSelected ? "rgba(99,102,241,0.4)" : "#1e1e3a"}`,
                borderRadius: 12, overflow: "hidden",
                transition: "border-color 0.2s",
                boxShadow: isSelected ? "0 0 20px rgba(99,102,241,0.1)" : "none"
              }}
            >
              {/* Cluster Label */}
              <div style={{
                padding: "10px 14px", background: "#0a0a0f",
                borderBottom: "1px solid #1e1e3a",
                display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <span style={{ color: "#4a4a7a", fontSize: 11, letterSpacing: 2 }}>
                  CLUSTER #{cluster.cluster_id}
                </span>
                <span style={{ color: "#2a2a4a", fontSize: 10 }}>
                  {cluster.face_count} faces
                </span>
              </div>

              {/* Face Thumbnails */}
              <div style={{
                display: "flex", gap: 4, padding: 12, flexWrap: "wrap",
                cursor: "pointer"
              }} onClick={() => setSelectedCluster(isSelected ? null : cluster.cluster_id)}>
                {cluster.face_paths.slice(0, 6).map((fp, i) => (
                  <img
                    key={i}
                    src={`${BASE_URL}${fp}`}
                    alt={`face ${i}`}
                    style={{
                      width: 56, height: 56, objectFit: "cover",
                      borderRadius: 6, border: "1px solid #1e1e3a",
                      background: "#0a0a0f"
                    }}
                    onError={e => { e.target.style.display = "none"; }}
                  />
                ))}
              </div>

              {/* Input Fields */}
              <div style={{ padding: "8px 12px 14px" }}>
                <input
                  type="text"
                  placeholder="Student Name"
                  value={asgn.name || ""}
                  onChange={e => updateAssignment(cluster.cluster_id, "name", e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Roll Number"
                  value={asgn.roll_no || ""}
                  onChange={e => updateAssignment(cluster.cluster_id, "roll_no", e.target.value)}
                  style={{ ...inputStyle, marginTop: 8 }}
                />
                {isAssigned && (
                  <div style={{
                    marginTop: 8, color: "#6ee7b7", fontSize: 10, letterSpacing: 1
                  }}>
                    ✓ ASSIGNED
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "9px 12px",
  background: "#0a0a0f", border: "1px solid #1e1e3a",
  borderRadius: 6, color: "#c8c8e8", fontSize: 12,
  outline: "none", boxSizing: "border-box",
  fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 0.5,
  transition: "border-color 0.2s"
};
