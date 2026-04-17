import os
from pathlib import Path
##r

BASE_DIR = Path(__file__).resolve().parent.parent

# Data directories
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
FACES_DIR = DATA_DIR / "faces"
FACES_FILTERED_DIR = DATA_DIR / "faces_filtered"
EMBEDDINGS_DIR = DATA_DIR / "embeddings"
CLUSTERS_DIR = DATA_DIR / "clusters"
REGISTERED_EMB_DIR = DATA_DIR / "registered_embeddings"
ATTENDANCE_REPORTS_DIR = DATA_DIR / "attendance_reports"

MODELS_DIR = BASE_DIR / "models"
YOLO_MODEL_PATH = MODELS_DIR / "yolov8l.pt"

for d in [UPLOADS_DIR, FACES_DIR, FACES_FILTERED_DIR, EMBEDDINGS_DIR,
          CLUSTERS_DIR, REGISTERED_EMB_DIR, ATTENDANCE_REPORTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Frame extraction
FRAME_SAMPLE_RATE = 10    # every 5th frame — same as working local version

# Face filtering — matched to teacher's notebook (cell 9)
# is_small threshold = 20px, is_blurred threshold = 50
# Teacher does NOT use brightness/variance/aspect checks — removed.
MIN_FACE_SIZE  = 40      # 20→40: removes tiny/partial detections without losing real faces
BLUR_THRESHOLD = 80.0    # 50→80: removes more blurry crops; real faces are sharp enough

# YOLO / DeepFace
YOLO_CONF      = 0.5
DEEPFACE_MODEL = "VGG-Face"
EMBEDDING_DIM  = 4096

# DBSCAN — CRITICAL: teacher uses metric="correlation" (cell 39), NOT euclidean
# eps=0.28 is teacher's calibrated value for correlation distance
# Previous euclidean eps [0.3-0.5] was wrong metric entirely
DBSCAN_METRIC     = "correlation"
DBSCAN_EPS_VALUES = [0.22, 0.25, 0.28, 0.31, 0.35]

# Pre-DBSCAN Noise Removal (teacher's notebook cell 34)
# NoiseRemoval(X, min_neighbours=3, removal_percentage=5)
NOISE_REMOVAL_MIN_NEIGHBOURS  = 3
NOISE_REMOVAL_REMOVAL_PERCENT = 5
NOISE_REMOVAL_MIN_DIST        = 0.01
NOISE_REMOVAL_MAX_DIST        = 5.0
NOISE_REMOVAL_STEP            = 0.05

# Attendance matching
# Primary threshold for cosine similarity match
# A hard 50% post-filter is also applied in tasks.py
SIMILARITY_THRESHOLD = 0.50

REDIS_URL    = os.getenv("REDIS_URL",    "redis://localhost:6379/0")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/smart_attendance.db")