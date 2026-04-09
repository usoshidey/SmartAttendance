"""
routers/register.py
After registration pipeline completes, teacher views clusters and assigns names.
"""
import json
import os
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db, Job, ClusterResult, Student
from backend.models.schemas import ClusterFaceOut, AssignClustersRequest, StudentOut

router = APIRouter(prefix="/register", tags=["Registration"])


@router.get("/{job_id}/clusters", response_model=list[ClusterFaceOut])
def get_clusters(job_id: str, db: Session = Depends(get_db)):
    """
    Get all clusters for a completed registration job.
    Returns cluster ID and list of face image paths for display.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != "done":
        raise HTTPException(400, f"Job not done yet (status: {job.status})")
    if job.type != "registration":
        raise HTTPException(400, "This is not a registration job")

    clusters = db.query(ClusterResult).filter(
        ClusterResult.job_id == job_id
    ).order_by(ClusterResult.cluster_id).all()

    result = []
    for c in clusters:
        face_paths = c.get_face_paths()
        # quote() URL-encodes backslashes and spaces in Windows paths
        result.append(ClusterFaceOut(
            cluster_id=c.cluster_id,
            face_paths=[f"/register/face-image?path={quote(fp, safe='')}" for fp in face_paths],
            face_count=len(face_paths)
        ))
    return result


@router.get("/face-image")
def serve_face_image(path: str):
    """Serve a face image by absolute path."""
    if not os.path.exists(path):
        raise HTTPException(404, "Image not found")
    return FileResponse(path, media_type="image/jpeg")


@router.post("/assign", response_model=list[StudentOut])
def assign_clusters(body: AssignClustersRequest, db: Session = Depends(get_db)):
    """
    Teacher submits name + roll_no assignments for each cluster.
    Creates Student records with the cluster centroid as their embedding.
    """
    job = db.query(Job).filter(Job.id == body.job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != "done" or job.type != "registration":
        raise HTTPException(400, "Invalid job state for assignment")

    created_students = []

    for assignment in body.assignments:
        # Look up cluster result
        cluster = db.query(ClusterResult).filter(
            ClusterResult.job_id == body.job_id,
            ClusterResult.cluster_id == assignment.cluster_id
        ).first()

        if not cluster:
            continue

        # Check if student already registered for this subject
        existing = db.query(Student).filter(
            Student.roll_no == assignment.roll_no,
            Student.subject_id == body.subject_id
        ).first()

        face_paths = cluster.get_face_paths()
        sample_face = face_paths[0] if face_paths else None

        if existing:
            # Update embedding with fresh data
            existing.name = assignment.name
            existing.embedding = cluster.embedding
            existing.sample_face_path = sample_face
            db.commit()
            db.refresh(existing)
            created_students.append(existing)
        else:
            student = Student(
                name=assignment.name,
                roll_no=assignment.roll_no,
                subject_id=body.subject_id,
                embedding=cluster.embedding,
                sample_face_path=sample_face
            )
            db.add(student)
            db.commit()
            db.refresh(student)
            created_students.append(student)

    return created_students
