"""
routers/jobs.py
Handles video uploads and job status polling.
"""
import os
import uuid
import shutil
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.database import get_db, Job
from backend.models.schemas import JobOut
from backend.config import UPLOADS_DIR
from backend.tasks import run_registration_pipeline, run_attendance_pipeline

router = APIRouter(prefix="/jobs", tags=["Jobs"])

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def _save_upload(file: UploadFile, job_id: str) -> str:
    """Save uploaded video file and return its path."""
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    job_dir = UPLOADS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    video_path = str(job_dir / f"video{ext}")
    with open(video_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return video_path


@router.post("/upload/registration", response_model=JobOut)
async def upload_registration_video(
    file: UploadFile = File(...),
    subject_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """
    Upload a video for student registration pipeline.
    Returns a job object — poll /jobs/{id} for progress.
    """
    job_id = str(uuid.uuid4())
    video_path = _save_upload(file, job_id)

    job = Job(
        id=job_id,
        type="registration",
        status="pending",
        subject_id=subject_id,
        video_path=video_path,
        progress=0,
        progress_message="Queued for processing..."
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Dispatch Celery task
    run_registration_pipeline.apply_async(args=[job_id])

    return job


@router.post("/upload/attendance", response_model=JobOut)
async def upload_attendance_video(
    file: UploadFile = File(...),
    subject_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """
    Upload a video for attendance marking pipeline.
    Returns a job object — poll /jobs/{id} for progress.
    """
    job_id = str(uuid.uuid4())
    video_path = _save_upload(file, job_id)

    job = Job(
        id=job_id,
        type="attendance",
        status="pending",
        subject_id=subject_id,
        video_path=video_path,
        progress=0,
        progress_message="Queued for processing..."
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Dispatch Celery task
    run_attendance_pipeline.apply_async(args=[job_id])

    return job


@router.get("/{job_id}", response_model=JobOut)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Poll job status and progress."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.get("/", response_model=list[JobOut])
def list_jobs(
    job_type: str = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """List recent jobs, optionally filtered by type."""
    q = db.query(Job)
    if job_type:
        q = q.filter(Job.type == job_type)
    jobs = q.order_by(Job.created_at.desc()).limit(limit).all()
    return jobs
