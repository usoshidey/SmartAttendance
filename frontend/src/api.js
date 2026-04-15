const BASE_URL = "/api";

function getToken() {
  return localStorage.getItem("sa_token");
}

async function request(method, path, body = null, isFormData = false) {
  const token = getToken();
  const headers = isFormData ? {} : { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    if (res.status === 401) {
      localStorage.removeItem("sa_token");
      localStorage.removeItem("sa_user");
      window.location.href = "/";
    }
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  // ── Auth — Teacher ────────────────────────────────────────────────────────
  signupTeacher: (name, email, password) =>
    request("POST", "/auth/signup/teacher", { name, email, password }),
  loginTeacher: (email, password) =>
    request("POST", "/auth/login/teacher", { email, password }),

  // ── Auth — Student ─────────────────────────────────────────────────────────
  signupStudent: (name, roll_no, password) =>
    request("POST", "/auth/signup/student", { name, roll_no, password }),
  loginStudent: (roll_no, password) =>
    request("POST", "/auth/login/student", { roll_no, password }),

  // ── Email Verification (magic link) ───────────────────────────────────────
  verifyEmailToken: (token) =>
    request("GET", `/auth/verify-email?token=${encodeURIComponent(token)}`),

  me: () => request("GET", "/auth/me"),
  studentStatus: () => request("GET", "/auth/student/status"),

  // ── Subjects & Students ───────────────────────────────────────────────────
  getStats: () => request("GET", "/stats"),
  getSubjects: () => request("GET", "/subjects"),
  createSubject: (data) => request("POST", "/subjects", data),
  deleteSubject: (id) => request("DELETE", `/subjects/${id}`),
  getStudents: (sid) => request("GET", `/students${sid ? `?subject_id=${sid}` : ""}`),
  deleteStudent: (id) => request("DELETE", `/students/${id}`),
  studentFaceUrl: (id) => `${BASE_URL}/students/${id}/face`,

  // ── Jobs ──────────────────────────────────────────────────────────────────
  uploadRegistrationVideo: (file, subject_id) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("subject_id", subject_id);
    return request("POST", "/jobs/upload/registration", fd, true);
  },
  uploadAttendanceVideo: (file, subject_id) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("subject_id", subject_id);
    return request("POST", "/jobs/upload/attendance", fd, true);
  },
  getJob: (id) => request("GET", `/jobs/${id}`),
  listJobs: (type, limit = 10) => request("GET", `/jobs?${type ? `job_type=${type}&` : ""}limit=${limit}`),

  // ── Registration ──────────────────────────────────────────────────────────
  getClusters: (job_id) => request("GET", `/register/${job_id}/clusters`),
  faceImageUrl: (path) => `${BASE_URL}/register/face-image?path=${encodeURIComponent(path)}`,
  assignClusters: (job_id, subject_id, assignments) => request("POST", "/register/assign", { job_id, subject_id, assignments }),

  // ── Attendance ────────────────────────────────────────────────────────────
  getAttendanceByJob: (job_id) => request("GET", `/attendance/session/${job_id}`),
  downloadReport: (job_id) => `${BASE_URL}/attendance/download/${job_id}`,
  getAttendanceHistory: (subject_id, limit = 10) => request("GET", `/attendance/history/${subject_id}?limit=${limit}`),
  downloadConsolidated: (subject_id) => `${BASE_URL}/attendance/consolidated/${subject_id}`,
};

export default api;
