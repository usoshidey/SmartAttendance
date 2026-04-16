from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date

class JobOut(BaseModel):
    id: str
    type: str
    status: str
    subject_id: Optional[int] = None
    progress: int = 0
    progress_message: Optional[str] = None
    result_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SubjectCreate(BaseModel):
    name: str
    code: str

class SubjectOut(BaseModel):
    id: int
    name: str
    code: str
    teacher_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class StudentOut(BaseModel):
    id: int
    name: str
    roll_no: str
    subject_id: int
    sample_face_path: Optional[str] = None
    registered_at: datetime

    class Config:
        from_attributes = True

class AttendanceRecordOut(BaseModel):
    student_id: int
    name: str
    roll_no: str
    status: str
    similarity: Optional[float] = None

class AttendanceSessionOut(BaseModel):
    session_id: int
    subject_id: int
    date: date
    records: List[AttendanceRecordOut]
