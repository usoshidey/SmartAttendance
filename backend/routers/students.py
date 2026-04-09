"""
routers/students.py
CRUD for subjects and registered students.
Subjects are scoped per teacher — each teacher only sees their own subjects/students.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import os

from backend.database import get_db, Subject, Student
from backend.models.schemas import SubjectCreate, SubjectOut, StudentOut
from backend.routers.auth import get_current_user
from backend.database import User

router = APIRouter(tags=["Students & Subjects"])


def _teacher_subjects(db: Session, user: User):
    """Return subjects belonging to this teacher only."""
    return db.query(Subject).filter(Subject.teacher_id == user.id)


# ── Subjects ──────────────────────────────────────────────────────────────────

@router.post("/subjects", response_model=SubjectOut)
def create_subject(
    body: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check uniqueness only within this teacher's subjects
    existing = _teacher_subjects(db, current_user).filter(
        Subject.code == body.code
    ).first()
    if existing:
        raise HTTPException(400, f"You already have a subject with code '{body.code}'")

    subject = Subject(
        name=body.name,
        code=body.code,
        teacher_id=current_user.id
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.get("/subjects", response_model=list[SubjectOut])
def list_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return only this teacher's subjects."""
    return _teacher_subjects(db, current_user).order_by(Subject.name).all()


@router.get("/subjects/{subject_id}", response_model=SubjectOut)
def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    subject = _teacher_subjects(db, current_user).filter(
        Subject.id == subject_id
    ).first()
    if not subject:
        raise HTTPException(404, "Subject not found")
    return subject


@router.delete("/subjects/{subject_id}")
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    subject = _teacher_subjects(db, current_user).filter(
        Subject.id == subject_id
    ).first()
    if not subject:
        raise HTTPException(404, "Subject not found")
    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted"}


# ── Students ──────────────────────────────────────────────────────────────────

@router.get("/students", response_model=list[StudentOut])
def list_students(
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Student)
    if subject_id:
        # Verify subject belongs to this teacher
        subj = _teacher_subjects(db, current_user).filter(
            Subject.id == subject_id
        ).first()
        if not subj:
            raise HTTPException(404, "Subject not found")
        q = q.filter(Student.subject_id == subject_id)
    else:
        # Return only students in this teacher's subjects
        teacher_subject_ids = [
            s.id for s in _teacher_subjects(db, current_user).all()
        ]
        q = q.filter(Student.subject_id.in_(teacher_subject_ids))
    return q.order_by(Student.roll_no).all()


@router.get("/students/{student_id}", response_model=StudentOut)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")
    return s


@router.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")
    # Verify this student belongs to teacher's subject
    subj = _teacher_subjects(db, current_user).filter(
        Subject.id == s.subject_id
    ).first()
    if not subj:
        raise HTTPException(403, "Not your student")
    db.delete(s)
    db.commit()
    return {"message": "Student deleted"}


@router.put("/students/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")
    if "name"    in body and body["name"].strip():
        s.name    = body["name"].strip()
    if "roll_no" in body and body["roll_no"].strip():
        s.roll_no = body["roll_no"].strip()
    db.commit()
    db.refresh(s)
    return s


@router.get("/students/{student_id}/face")
def get_student_face(
    student_id: int,
    db: Session = Depends(get_db)
):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s or not s.sample_face_path:
        raise HTTPException(404, "Face image not found")
    if not os.path.exists(s.sample_face_path):
        raise HTTPException(404, "Face image file missing")
    return FileResponse(s.sample_face_path, media_type="image/jpeg")


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.database import AttendanceSession

    # Only count this teacher's data
    teacher_subject_ids = [
        s.id for s in _teacher_subjects(db, current_user).all()
    ]

    total_subjects = len(teacher_subject_ids)
    total_students = db.query(Student).filter(
        Student.subject_id.in_(teacher_subject_ids)
    ).count() if teacher_subject_ids else 0
    total_sessions = db.query(AttendanceSession).filter(
        AttendanceSession.subject_id.in_(teacher_subject_ids)
    ).count() if teacher_subject_ids else 0
    last_session = db.query(AttendanceSession).filter(
        AttendanceSession.subject_id.in_(teacher_subject_ids)
    ).order_by(AttendanceSession.created_at.desc()).first() if teacher_subject_ids else None

    return {
        "total_subjects":   total_subjects,
        "total_students":   total_students,
        "total_sessions":   total_sessions,
        "last_session_date": last_session.date.isoformat() if last_session else None
    }