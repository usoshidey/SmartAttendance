FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV + DeepFace
RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    ffmpeg libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY backend/ ./backend/

# Create data directories
RUN mkdir -p data/uploads data/faces data/faces_filtered \
    data/embeddings data/clusters data/registered_embeddings \
    data/attendance_reports models

EXPOSE 6005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:6005/health').read()" || exit 1

# Run FastAPI application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "6005"]
