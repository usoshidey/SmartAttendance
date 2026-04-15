import json
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float,
    DateTime, Date, Text, Enum, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from backend.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # nullable for migration
    created_at = Column(DateTime, default=datetime.utcnow)

    students = relationship("Student", back_populates="subject")
    sessions = relationship("AttendanceSession", back_populates="subject")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    roll_no = Column(String, nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    embedding = Column(Text, nullable=False)      # JSON-serialized list of 4096 floats
    sample_face_path = Column(String, nullable=True)
    registered_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject", back_populates="students")
    attendance_records = relationship("AttendanceRecord", back_populates="student")

    __table_args__ = (
        UniqueConstraint("roll_no", "subject_id", name="uq_student_subject"),
    )

    def get_embedding(self):
        return json.loads(self.embedding)

    def set_embedding(self, emb: list):
        self.embedding = json.dumps(emb)


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True)          # UUID
    type = Column(Enum("registration", "attendance", name="job_type"), nullable=False)
    status = Column(
        Enum("pending", "processing", "done", "failed", name="job_status"),
        default="pending"
    )
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    video_path = Column(String, nullable=False)
    progress = Column(Integer, default=0)          # 0–100
    progress_message = Column(String, default="Queued...")
    result_path = Column(String, nullable=True)    # xlsx path for attendance jobs
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    clusters = relationship("ClusterResult", back_populates="job")
    sessions = relationship("AttendanceSession", back_populates="job")


class ClusterResult(Base):
    """Stores per-cluster face data after registration pipeline."""
    __tablename__ = "cluster_results"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)
    cluster_id = Column(Integer, nullable=False)
    embedding = Column(Text, nullable=False)       # centroid embedding JSON
    face_paths = Column(Text, nullable=False)      # JSON list of face image paths
    assigned_name = Column(String, nullable=True)
    assigned_roll = Column(String, nullable=True)

    job = relationship("Job", back_populates="clusters")

    def get_embedding(self):
        return json.loads(self.embedding)

    def get_face_paths(self):
        return json.loads(self.face_paths)


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    date = Column(Date, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="sessions")
    subject = relationship("Subject", back_populates="sessions")
    records = relationship("AttendanceRecord", back_populates="session")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    status = Column(Enum("present", "absent", name="attendance_status"), nullable=False)
    similarity = Column(Float, nullable=True)

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("Student", back_populates="attendance_records")



class User(Base):
    """Accounts for teachers and students."""
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    roll_no    = Column(String, nullable=True)   # students only
    role       = Column(Enum("teacher", "student", name="user_role"), nullable=False)
    email      = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    verify_token         = Column(String, nullable=True)    # magic-link token
    verify_token_expires = Column(DateTime, nullable=True)  # token expiry

def create_tables():
    Base.metadata.create_all(bind=engine)