"""
routers/auth.py
Authentication with real email OTP via Gmail SMTP.
"""
import os
import re
import random
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional

from backend.database import get_db, User, Student, AttendanceRecord

router = APIRouter(prefix="/auth", tags=["Auth"])

# ── JWT config ─────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "smart-attendance-secret-change-in-prod-2024")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login-teacher")

# ── SMTP config (set in .env or environment) ──────────────────────────────────
SMTP_EMAIL    = os.getenv("SMTP_EMAIL", "")       # your Gmail address
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")    # Gmail App Password
SMTP_HOST     = "smtp.gmail.com"
SMTP_PORT     = 587

# ── In-memory OTP store: {user_id: (otp_code, expires_at, email_or_roll)} ────
_otp_store: dict = {}
OTP_EXPIRE_SECONDS = 300  # 5 minutes


# ── Schemas ───────────────────────────────────────────────────────────────────
class TeacherSignupRequest(BaseModel):
    name:     str
    email:    str
    password: str

class StudentSignupRequest(BaseModel):
    name:     str
    roll_no:  str
    password: str

class TeacherLoginRequest(BaseModel):
    email:    str
    password: str

class StudentLoginRequest(BaseModel):
    roll_no:  str
    password: str

class OTPVerifyRequest(BaseModel):
    user_id: int
    otp:     str

class OTPPendingResponse(BaseModel):
    user_id: int
    message: str
    # otp_code only included if SMTP not configured (fallback for dev)
    otp_code: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    role:         str
    name:         str
    user_id:      int

class UserOut(BaseModel):
    id:      int
    name:    str
    email:   Optional[str]
    role:    str
    roll_no: Optional[str]


# ── Helpers ───────────────────────────────────────────────────────────────────
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

def validate_email(email: str) -> bool:
    email = email.strip()
    return " " not in email and bool(EMAIL_REGEX.match(email))

def hash_password(p: str) -> str:
    return pwd_context.hash(p)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(user_id: int, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "role": role, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM
    )

def _send_otp_email(to_email: str, otp_code: str, name: str) -> bool:
    """Send OTP to email via Gmail SMTP. Returns True if sent successfully."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        return False  # SMTP not configured — fallback to showing OTP on screen

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Smart Attendance — Your OTP"
        msg["From"]    = f"Smart Attendance <{SMTP_EMAIL}>"
        msg["To"]      = to_email

        html = f"""
        <div style="font-family: monospace; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d0d1a; border-radius: 12px; color: #e0e0ff;">
            <div style="font-size: 20px; font-weight: bold; color: #6366f1; margin-bottom: 8px;">◈ Smart Attendance</div>
            <p style="color: #8888aa;">Hi {name},</p>
            <p style="color: #8888aa;">Your one-time password is:</p>
            <div style="font-size: 40px; font-weight: 900; letter-spacing: 14px; color: #a5b4fc; text-align: center; padding: 24px; background: #0a0a14; border-radius: 8px; border: 1px solid #2a2a4a; margin: 20px 0;">
                {otp_code}
            </div>
            <p style="color: #4a4a6a; font-size: 12px;">This OTP expires in 5 minutes. Do not share it with anyone.</p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[SMTP ERROR] {e}")
        return False

def generate_otp(user_id: int) -> str:
    code = str(random.randint(100000, 999999))
    _otp_store[user_id] = (code, time.time() + OTP_EXPIRE_SECONDS)
    return code

def verify_otp(user_id: int, code: str) -> bool:
    entry = _otp_store.get(user_id)
    if not entry:
        return False
    stored_code, expires_at = entry
    if time.time() > expires_at:
        del _otp_store[user_id]
        return False
    if stored_code != code.strip():
        return False
    del _otp_store[user_id]
    return True

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise exc
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise exc
    return user

def require_teacher(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "teacher":
        raise HTTPException(403, "Teacher access required")
    return current_user

def _otp_response(user: User, otp: str) -> dict:
    """
    If SMTP configured → send email, return message without OTP.
    If not configured → return OTP in response (dev fallback).
    """
    email_sent = False
    if user.email:
        email_sent = _send_otp_email(user.email, otp, user.name)

    if email_sent:
        return {
            "user_id":  user.id,
            "message":  f"OTP sent to {user.email[:3]}***{user.email[user.email.index('@'):]}"
        }
    else:
        # Fallback: show OTP on screen (dev mode or SMTP not configured)
        return {
            "user_id":  user.id,
            "message":  "SMTP not configured — OTP shown below (dev mode)",
            "otp_code": otp
        }


# ── Teacher Sign Up ────────────────────────────────────────────────────────────
@router.post("/signup/teacher", status_code=201)
def teacher_signup(body: TeacherSignupRequest, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name is required")
    if not validate_email(body.email):
        raise HTTPException(400, "Invalid email format. Use a real email like name@domain.com")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if db.query(User).filter(User.email == body.email.lower().strip()).first():
        raise HTTPException(400, "This email is already registered")

    user = User(
        name=body.name.strip(), email=body.email.lower().strip(),
        role="teacher", roll_no=None, password_hash=hash_password(body.password)
    )
    db.add(user); db.commit(); db.refresh(user)
    otp = generate_otp(user.id)
    return _otp_response(user, otp)


# ── Student Sign Up ────────────────────────────────────────────────────────────
@router.post("/signup/student", status_code=201)
def student_signup(body: StudentSignupRequest, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name is required")
    if not body.roll_no.strip():
        raise HTTPException(400, "Roll number is required")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if db.query(User).filter(User.roll_no == body.roll_no.strip(), User.role == "student").first():
        raise HTTPException(400, "This roll number is already registered")

    user = User(
        name=body.name.strip(), email=None, role="student",
        roll_no=body.roll_no.strip(), password_hash=hash_password(body.password)
    )
    db.add(user); db.commit(); db.refresh(user)
    otp = generate_otp(user.id)
    # Students have no email — always show OTP on screen
    return {"user_id": user.id, "message": "Account created!", "otp_code": otp}


# ── Teacher Login ──────────────────────────────────────────────────────────────
@router.post("/login/teacher")
def teacher_login(body: TeacherLoginRequest, db: Session = Depends(get_db)):
    if not validate_email(body.email):
        raise HTTPException(400, "Invalid email format")
    user = db.query(User).filter(
        User.email == body.email.lower().strip(), User.role == "teacher"
    ).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    otp = generate_otp(user.id)
    return _otp_response(user, otp)


# ── Student Login ──────────────────────────────────────────────────────────────
@router.post("/login/student")
def student_login(body: StudentLoginRequest, db: Session = Depends(get_db)):
    if not body.roll_no.strip():
        raise HTTPException(400, "Roll number is required")
    user = db.query(User).filter(
        User.roll_no == body.roll_no.strip(), User.role == "student"
    ).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect roll number or password")
    otp = generate_otp(user.id)
    # Students have no email — show OTP on screen
    return {"user_id": user.id, "message": "Credentials verified!", "otp_code": otp}


# ── OTP Verify ─────────────────────────────────────────────────────────────────
@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp_and_login(body: OTPVerifyRequest, db: Session = Depends(get_db)):
    if not verify_otp(body.user_id, body.otp):
        raise HTTPException(400, "Invalid or expired OTP. Please try again.")
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return TokenResponse(
        access_token=create_token(user.id, user.role),
        role=user.role, name=user.name, user_id=user.id
    )


# ── Resend OTP ─────────────────────────────────────────────────────────────────
@router.post("/resend-otp")
def resend_otp(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    otp = generate_otp(user.id)
    if user.email:
        return _otp_response(user, otp)
    return {"user_id": user.id, "message": "New OTP generated.", "otp_code": otp}


# ── Me ─────────────────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id, name=current_user.name, email=current_user.email,
        role=current_user.role, roll_no=current_user.roll_no
    )


# ── Student Status ─────────────────────────────────────────────────────────────
@router.get("/student/status")
def student_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "student":
        raise HTTPException(403, "Student access only")
    if not current_user.roll_no:
        raise HTTPException(400, "No roll number on this account")

    registrations = db.query(Student).filter(Student.roll_no.ilike(current_user.roll_no)).all()
    result = []
    for reg in registrations:
        records = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == reg.id).all()
        total   = len(records)
        present = sum(1 for r in records if r.status == "present")
        result.append({
            "subject_name":   reg.subject.name if reg.subject else "Unknown",
            "subject_code":   reg.subject.code if reg.subject else "",
            "registered":     True,
            "registered_at":  reg.registered_at.isoformat() if reg.registered_at else None,
            "total_sessions": total, "present": present,
            "absent":         total - present,
            "attendance_pct": round(present / total * 100, 1) if total > 0 else None,
        })
    return {
        "student_name": current_user.name, "roll_no": current_user.roll_no,
        "registrations": result, "is_registered_anywhere": len(result) > 0
    }