import { useState, useEffect } from "react";
import api from "../api";

export default function StudentsPage() {
  const [subjects, setSubjects]           = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [students, setStudents]           = useState([]);
  const [loading, setLoading]             = useState(false);
  const [deleting, setDeleting]           = useState(null);
  const [editing, setEditing]             = useState(null);  // student id being edited
  const [editForm, setEditForm]           = useState({ name: "", roll_no: "" });
  const [saving, setSaving]               = useState(false);

  useEffect(() => {
    api.getSubjects().then(data => {
      setSubjects(data);
      if (data.length > 0) setSelectedSubjectId(data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSubjectId) return;
    setLoading(true);
    api.getStudents(selectedSubjectId)
      .then(setStudents).catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [selectedSubjectId]);

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this student from the registry?")) return;
    setDeleting(id);
    try {
      await api.deleteStudent(id);
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      alert("Delete failed: " + e.message);
    } finally {
      setDeleting(null);
    }
  };

  const startEdit = (student) => {
    setEditing(student.id);
    setEditForm({ name: student.name, roll_no: student.roll_no });
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.name.trim() || !editForm.roll_no.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updateStudent(id, { name: editForm.name.trim(), roll_no: editForm.roll_no.trim() });
      setStudents(prev => prev.map(s => s.id === id ? { ...s, name: updated.name, roll_no: updated.roll_no } : s));
      setEditing(null);
    } catch (e) {
      alert("Update failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 10, letterSpacing: 6, color: "#4a4a7a", marginBottom: 8 }}>MANAGEMENT</div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "#e0e0ff" }}>Student Registry</h1>
        <div style={{ color: "#4a4a7a", fontSize: 13, marginTop: 6 }}>View, edit and manage registered students</div>
      </div>

      {/* Subject Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
        {subjects.map(s => (
          <button key={s.id} onClick={() => setSelectedSubjectId(s.id)} style={{
            padding: "8px 18px", borderRadius: 6, cursor: "pointer",
            background: selectedSubjectId === s.id ? "rgba(99,102,241,0.2)" : "transparent",
            border: `1px solid ${selectedSubjectId === s.id ? "rgba(99,102,241,0.5)" : "#1e1e3a"}`,
            color: selectedSubjectId === s.id ? "#a5b4fc" : "#4a4a7a", fontSize: 12
          }}>
            {s.name} <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.5 }}>{s.code}</span>
          </button>
        ))}
      </div>

      {selectedSubject && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "12px 16px", background: "#0d0d18", border: "1px solid #1e1e3a", borderRadius: 8 }}>
          <span style={{ color: "#a5b4fc", fontSize: 22, fontWeight: 700 }}>{students.length}</span>
          <div>
            <div style={{ color: "#c8c8e8", fontSize: 13 }}>students registered</div>
            <div style={{ color: "#4a4a7a", fontSize: 11 }}>{selectedSubject.name} · {selectedSubject.code}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: "#4a4a7a", fontSize: 13, padding: 20 }}>Loading...</div>
      ) : students.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed #1e1e3a", borderRadius: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>◫</div>
          <div style={{ color: "#4a4a7a", fontSize: 13 }}>No students registered for this subject.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {students.map(student => (
            <div key={student.id} style={{
              background: "#0d0d18", border: "1px solid #1e1e3a",
              borderRadius: 12, overflow: "hidden", transition: "border-color 0.2s"
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a5a"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e3a"}
            >
              {/* Face */}
              <div style={{ height: 140, background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {student.sample_face_path ? (
                  <img src={api.studentFaceUrl(student.id)} alt={student.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
                ) : null}
                <div style={{ display: student.sample_face_path ? "none" : "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: "#2a2a4a" }}>◫</div>
              </div>

              {/* Info / Edit Form */}
              <div style={{ padding: "14px 16px" }}>
                {editing === student.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Student Name" style={inputSt} />
                    <input value={editForm.roll_no} onChange={e => setEditForm(f => ({ ...f, roll_no: e.target.value }))}
                      placeholder="Roll Number" style={inputSt} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleSaveEdit(student.id)} disabled={saving} style={{
                        flex: 1, padding: "6px 0", borderRadius: 5, cursor: "pointer",
                        background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7", fontSize: 11
                      }}>{saving ? "..." : "Save"}</button>
                      <button onClick={() => setEditing(null)} style={{
                        flex: 1, padding: "6px 0", borderRadius: 5, cursor: "pointer",
                        background: "transparent", border: "1px solid #1e1e3a", color: "#4a4a7a", fontSize: 11
                      }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ color: "#e0e0ff", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{student.name}</div>
                    <div style={{ color: "#6888aa", fontSize: 11, fontFamily: "monospace" }}>{student.roll_no}</div>
                    <div style={{ color: "#2a2a4a", fontSize: 10, marginTop: 6 }}>
                      Registered {new Date(student.registered_at).toLocaleDateString()}
                    </div>
                  </>
                )}
              </div>

              {/* Action buttons */}
              {editing !== student.id && (
                <div style={{ padding: "0 16px 14px", display: "flex", gap: 8 }}>
                  <button onClick={() => startEdit(student)} style={{
                    flex: 1, padding: "6px 0", borderRadius: 5, cursor: "pointer",
                    background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
                    color: "#a5b4fc", fontSize: 11
                  }}>✏ Edit</button>
                  <button onClick={() => handleDelete(student.id)} disabled={deleting === student.id} style={{
                    flex: 1, padding: "6px 0", borderRadius: 5, cursor: "pointer",
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                    color: "#fca5a5", fontSize: 11
                  }}>{deleting === student.id ? "..." : "🗑 Remove"}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputSt = { width: "100%", padding: "7px 10px", background: "#0a0a0f", border: "1px solid #1e1e3a", borderRadius: 5, color: "#c8c8e8", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "'IBM Plex Mono', monospace" };
