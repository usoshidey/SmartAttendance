# 🎓 Smart Attendance System

AI-powered classroom attendance using **YOLO face detection + DeepFace embeddings + DBSCAN clustering**.

---

## 📁 Project Structure

```
smart_attendance/
├── backend/
│   ├── main.py              # FastAPI entry point
│   ├── config.py            # All paths and settings
│   ├── database.py          # SQLAlchemy models
│   ├── tasks.py             # Celery background tasks
│   ├── routers/
│   │   ├── jobs.py          # Video upload → job dispatch
│   │   ├── register.py      # Cluster viewing + name assignment
│   │   ├── attendance.py    # Attendance results + download
│   │   └── students.py      # Subject/student CRUD
│   └── pipeline/
│       ├── frame_extractor.py   # Video → frames
│       ├── face_detector.py     # YOLO → face crops
│       ├── face_filter.py       # Quality filtering
│       ├── embedder.py          # VGG-Face embeddings
│       ├── clusterer.py         # DBSCAN with grid search
│       └── matcher.py           # Cluster → student matching
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── RegisterStudents.jsx
│       │   ├── MarkAttendance.jsx
│       │   └── StudentsPage.jsx
│       └── components/
│           ├── VideoUploader.jsx
│           ├── JobStatus.jsx
│           ├── ClusterGrid.jsx
│           └── AttendanceTable.jsx
├── models/
│   └── yolo.pt              # ← Place your YOLO model here
├── data/                    # Auto-created at runtime
├── docker-compose.yml
├── Dockerfile.backend
└── requirements.txt
```

---

## 🚀 Setup & Running

### Prerequisites
- Docker + Docker Compose
- Your `yolo.pt` model file

### Step 1 — Add Your YOLO Model
```bash
cp /path/to/your/yolov8l-face_2.pt models/yolo.pt
```

### Step 2 — Launch with Docker Compose
```bash
docker-compose up --build
```

This starts:
- **Redis** on port 6379 (task broker)
- **FastAPI Backend** on port 6005
- **Celery Worker** (processes video jobs)
- **React Frontend** on port 3000

### Step 3 — Open the App
Navigate to **http://localhost:3000**

---

## 🔄 Usage Flow

### Flow 1: Register Students (First Time)
1. Go to **Register Students**
2. Select or create a Subject (e.g. "EE201 - Circuit Theory")
3. Upload a class video (or record via webcam)
4. Wait for pipeline to complete (progress shown live)
5. You'll see face clusters — **assign Name + Roll No** to each
6. Click **Save** → students are registered

### Flow 2: Mark Attendance
1. Go to **Mark Attendance**
2. Select the subject
3. Upload today's class video
4. Pipeline runs automatically
5. View **Present / Absent** table
6. Download Excel report

---

## ⚙️ Configuration

Edit `backend/config.py` to tune:

| Setting | Default | Description |
|---|---|---|
| `FRAME_SAMPLE_RATE` | 1 | Process every Nth frame |
| `MIN_FACE_SIZE` | 40px | Minimum face dimensions |
| `BLUR_THRESHOLD` | 100.0 | Laplacian variance cutoff |
| `YOLO_CONF` | 0.5 | Detection confidence |
| `SIMILARITY_THRESHOLD` | 0.35 | Min cosine similarity = Present |

---

## 🛠️ Local Development (without Docker)

### Backend
```bash
# Install deps
pip install -r requirements.txt

# Start Redis (or use Docker just for Redis)
docker run -d -p 6379:6379 redis:7-alpine

# Start FastAPI
uvicorn backend.main:app --reload --port 6005

# Start Celery worker (separate terminal)
celery -A backend.tasks.celery_app worker --loglevel=info --concurrency=1
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/jobs/upload/registration` | Upload video for registration |
| `POST` | `/jobs/upload/attendance` | Upload video for attendance |
| `GET` | `/jobs/{id}` | Poll job status |
| `GET` | `/register/{job_id}/clusters` | Get clusters after registration |
| `POST` | `/register/assign` | Assign names to clusters |
| `GET` | `/attendance/session/{job_id}` | Get attendance results |
| `GET` | `/attendance/download/{job_id}` | Download Excel report |
| `GET` | `/subjects` | List subjects |
| `POST` | `/subjects` | Create subject |
| `GET` | `/students` | List students |
| `GET` | `/stats` | Dashboard stats |

Full interactive docs at: **http://localhost:6005/docs**

---

## 🧠 Pipeline Details

```
Video
  └─► Frame Extraction (OpenCV, every Nth frame)
        └─► Face Detection (YOLO yolov8l-face_2.pt, conf=0.5)
              └─► Face Filtering (min size 40px, blur check)
                    └─► Embedding (DeepFace VGG-Face, 4096-dim)
                          └─► DBSCAN Clustering (grid search: eps, min_samples)
                                └─► [Registration] Assign name/roll → save centroid
                                    [Attendance] Match centroids → Present/Absent
```

---

## 📝 Notes

- **First run** of DeepFace will download VGG-Face weights (~580MB) automatically
- **Celery concurrency=1** is intentional — YOLO + DeepFace are GPU/memory intensive
- The **similarity threshold** of 0.35 can be raised if you get false positives, or lowered if students are being missed
- Face images are stored per job in `data/uploads/{job_id}/`


echo " " >> MANUAL_DEPLOYMENT.md
