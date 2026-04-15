"""
routers/auth.py
Authentication with email magic-link verification.
Teachers receive a verification link by email; clicking it logs them in.
Students (no email) get a JWT directly after credential check.
"""
import os
import re
import secrets
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

# ── SMTP config ────────────────────────────────────────────────────────────────
SMTP_EMAIL    = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_HOST     = "smtp.gmail.com"
SMTP_PORT     = 587

# ── App base URL for magic link ────────────────────────────────────────────────
# Set this to your public app URL e.g. http://10.29.8.13:6004
APP_BASE_URL  = os.getenv("APP_BASE_URL", "http://localhost:6004")

# ── Token expiry ───────────────────────────────────────────────────────────────
VERIFY_TOKEN_EXPIRE_MINUTES = 15


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

def _issue_verify_token(user: User, db: Session) -> str:
    """Generate a secure random token, store it on the user row, return it."""
    token = secrets.token_urlsafe(32)
    user.verify_token = token
    user.verify_token_expires = datetime.utcnow() + timedelta(minutes=VERIFY_TOKEN_EXPIRE_MINUTES)
    db.commit()
    return token

def _send_verify_email(to_email: str, name: str, token: str) -> bool:
    """Send a beautiful magic-link email. Returns True on success."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        return False

    link = f"{APP_BASE_URL}?token={token}"

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Smart Attendance — Verify Your Email"
        msg["From"]    = f"Smart Attendance <{SMTP_EMAIL}>"
        msg["To"]      = to_email

        html = f"""
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 0; background: #06060f; border-radius: 16px; overflow: hidden; color: #e0e0ff;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 36px 40px 28px;">
            <div style="font-size: 28px; font-weight: 900; color: #fff; letter-spacing: 2px;">◈ SMART ATTENDANCE</div>
            <div style="color: rgba(255,255,255,0.65); font-size: 12px; letter-spacing: 3px; margin-top: 6px;">AI-POWERED CLASSROOM SYSTEM</div>
          </div>
          <div style="padding: 36px 40px;">
            <p style="color: #a0a0cc; font-size: 15px; margin: 0 0 8px;">Hi <strong style="color: #e0e0ff;">{name}</strong>,</p>
            <p style="color: #6a6a9a; font-size: 14px; margin: 0 0 28px; line-height: 1.6;">
              Click the button below to verify your email and sign in to Smart Attendance.
              This link is valid for <strong style="color: #a5b4fc;">15 minutes</strong>.
            </p>
            <a href="{link}" style="display: block; text-align: center; padding: 16px 32px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; letter-spacing: 1px;">
              ✓ &nbsp;Verify &amp; Sign In
            </a>
            <p style="color: #3a3a5a; font-size: 11px; margin-top: 28px; line-height: 1.6;">
              If you didn't request this, you can safely ignore this email.<br>
              The link will expire automatically after 15 minutes.
            </p>
            <p style="color: #2a2a4a; font-size: 11px; margin-top: 16px; word-break: break-all;">
              Or paste this URL in your browser:<br>
              <span style="color: #4a4a7a;">{link}</span>
            </p>
          </div>
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

    token = _issue_verify_token(user, db)
    sent  = _send_verify_email(user.email, user.name, token)

    if sent:
        masked = f"{user.email[:3]}***{user.email[user.email.index('@'):]}"
        return {"message": f"A verification link has been sent to {masked}. Check your inbox.", "email_sent": True}
    else:
        # SMTP not configured — return the token so dev can test manually
        return {
            "message": "SMTP not configured. Use the dev_link below to verify (dev mode only).",
            "email_sent": False,
            "dev_link": f"{APP_BASE_URL}?token={token}"
        }


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

    # Students have no email — issue JWT directly
    return TokenResponse(
        access_token=create_token(user.id, user.role),
        role=user.role, name=user.name, user_id=user.id
    )


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

    token = _issue_verify_token(user, db)
    sent  = _send_verify_email(user.email, user.name, token)

    if sent:
        masked = f"{user.email[:3]}***{user.email[user.email.index('@'):]}"
        return {"message": f"A verification link has been sent to {masked}. Check your inbox.", "email_sent": True}
    else:
        return {
            "message": "SMTP not configured. Use the dev_link below to verify (dev mode only).",
            "email_sent": False,
            "dev_link": f"{APP_BASE_URL}?token={token}"
        }


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

    # Students get JWT immediately — no email verification needed
    return TokenResponse(
        access_token=create_token(user.id, user.role),
        role=user.role, name=user.name, user_id=user.id
    )


# ── Verify Email Token (magic link endpoint) ───────────────────────────────────
@router.get("/verify-email", response_model=TokenResponse)
def verify_email_token(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verify_token == token).first()
    if not user:
        raise HTTPException(400, "Invalid or already-used verification link. Please log in again.")
    if not user.verify_token_expires or datetime.utcnow() > user.verify_token_expires:
        # Clear expired token
        user.verify_token = None
        user.verify_token_expires = None
        db.commit()
        raise HTTPException(400, "This verification link has expired. Please log in again.")

    # Consume the token (one-time use)
    user.verify_token = None
    user.verify_token_expires = None
    db.commit()

    return TokenResponse(
        access_token=create_token(user.id, user.role),
        role=user.role, name=user.name, user_id=user.id
    )


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