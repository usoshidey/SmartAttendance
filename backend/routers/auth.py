"""
routers/auth.py
Authentication with email verification links (no OTP)
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

# ── Global Config ──────────────────────────────────────────────────────────────
VERIFICATION_TOKEN_EXPIRE_HOURS = 24

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

class VerificationLinkResponse(BaseModel):
    message: str

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
    is_verified: bool

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

def generate_verification_token() -> str:
    """Generate a secure random verification token."""
    return secrets.token_urlsafe(32)

def send_verification_email(to_email: str, name: str, verification_token: str) -> bool:
    """Send verification email with link. Returns True if sent successfully."""
    
    # Fetch credentials and frontend URL at runtime to guarantee we have the latest .env updates
    sender_email = os.getenv("SMTP_EMAIL", "").strip()
    sender_password = os.getenv("SMTP_PASSWORD", "").strip()
    current_frontend_url = os.getenv("FRONTEND_URL", "http://10.29.8.13:6004").rstrip('/')

    if not sender_email or not sender_password:
        print(f"[DEV MODE] Verification link: {current_frontend_url}/verify-email?token={verification_token}")
        return False

    try:
        verification_link = f"{current_frontend_url}/verify-email?token={verification_token}"
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Smart Attendance — Verify Your Email"
        msg["From"]    = f"Smart Attendance <{sender_email}>"
        msg["To"]      = to_email

        html = f"""
        <div style="font-family: monospace; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d0d1a; border-radius: 12px; color: #e0e0ff;">
            <div style="font-size: 20px; font-weight: bold; color: #6366f1; margin-bottom: 8px;">◈ Smart Attendance</div>
            <p style="color: #8888aa;">Hi {name},</p>
            <p style="color: #8888aa;">Thank you for signing up! Please verify your email by clicking the button below:</p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="{verification_link}" style="background: #6366f1; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Verify Email</a>
            </div>
            <p style="color: #8888aa;">Or copy this link:</p>
            <p style="color: #a5b4fc; word-break: break-all; font-size: 12px;">{verification_link}</p>
            <p style="color: #4a4a6a; font-size: 12px;">This link expires in {VERIFICATION_TOKEN_EXPIRE_HOURS} hours. Do not share it with anyone.</p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))

        # Explicitly hardcode smtp.gmail.com and 465 to bypass firewall rules
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, msg.as_string())
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
@router.post("/signup/teacher", status_code=201, response_model=VerificationLinkResponse)
def teacher_signup(body: TeacherSignupRequest, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name is required")
    if not validate_email(body.email):
        raise HTTPException(400, "Invalid email format. Use a real email like name@domain.com")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if db.query(User).filter(User.email == body.email.lower().strip()).first():
        raise HTTPException(400, "This email is already registered")

    # Generate verification token
    verification_token = generate_verification_token()
    token_expires_at = datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)

    user = User(
        name=body.name.strip(),
        email=body.email.lower().strip(),
        role="teacher",
        roll_no=None,
        password_hash=hash_password(body.password),
        is_verified=False,
        verification_token=verification_token,
        verification_token_expires_at=token_expires_at
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send verification email
    email_sent = send_verification_email(user.email, user.name, verification_token)

    if email_sent:
        return {"message": f"Verification email sent to {user.email}. Please check your inbox."}
    else:
        # Dev mode: provide the token for testing
        return {"message": f"[DEV MODE] Verification link generated. Check terminal for link."}

# ── Student Sign Up ────────────────────────────────────────────────────────────
@router.post("/signup/student", status_code=201, response_model=TokenResponse)
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
        name=body.name.strip(),
        email=None,
        role="student",
        roll_no=body.roll_no.strip(),
        password_hash=hash_password(body.password),
        is_verified=True  # Students don't need email verification
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Directly return token for students (no email verification needed)
    return TokenResponse(
        access_token=create_token(user.id, user.role),
        role=user.role,
        name=user.name,
        user_id=user.id
    )

# ── Teacher Login ──────────────────────────────────────────────────────────────
@router.post("/login/teacher")
def teacher_login(body: TeacherLoginRequest, db: Session = Depends(get_db)):
    if not validate_email(body.email):
        raise HTTPException(400, "Invalid email format")
    
    user = db.query(User).filter(
        User.email == body.email.lower().strip(),
        User.role == "teacher"
    ).first()
    
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")

    # If not verified, generate a new link
    if not user.is_verified:
        verification_token = generate_verification_token()
        token_expires_at = datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)
        
        user.verification_token = verification_token
        user.verification_token_expires_at = token_expires_at
        db.commit()

        email_sent = send_verification_email(user.email, user.name, verification_token)

        if email_sent:
            return VerificationLinkResponse(message=f"Verification email sent to {user.email}. Please check your inbox and click the verification link.")
        else:
            return VerificationLinkResponse(message=f"[DEV MODE] Verification link generated. Check terminal for link.")
    
    # User is verified, return the access token
    return TokenResponse(
        access_token=create_token(user.id, user.role),
        role=user.role,
        name=user.name,
        user_id=user.id
    )

# ── Student Login ──────────────────────────────────────────────────────────────
@router.post("/login/student", response_model=TokenResponse)
def student_login(body: StudentLoginRequest, db: Session = Depends(get_db)):
    if not body.roll_no.strip():
        raise HTTPException(400, "Roll number is required")
    
    user = db.query(User).filter(
        User.roll_no == body.roll_no.strip(),
        User.role == "student"
    ).first()
    
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect roll number or password")

    # Students are always verified
    return TokenResponse(
        access_token=create_token(user.id, user.role),
        role=user.role,
        name=user.name,
        user_id=user.id
    )

# ── Verify Email Token (from email link) ────────────────────────────────────────
@router.get("/verify-email", response_model=TokenResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(400, "Verification token is required")

    user = db.query(User).filter(
        User.verification_token == token,
        User.role == "teacher"
    ).first()

    if not user:
        raise HTTPException(404, "Invalid verification token")

    if user.verification_token_expires_at and datetime.utcnow() > user.verification_token_expires_at:
        raise HTTPException(400, "Verification link has expired. Please login again to receive a new link.")

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires_at = None
    db.commit()

    return TokenResponse(
        access_token=create_token(user.id, user.role),
        role=user.role,
        name=user.name,
        user_id=user.id
    )

# ── Resend Verification Email ──────────────────────────────────────────────────
@router.post("/resend-verification", response_model=VerificationLinkResponse)
def resend_verification(email: str, db: Session = Depends(get_db)):
    if not validate_email(email):
        raise HTTPException(400, "Invalid email format")

    user = db.query(User).filter(
        User.email == email.lower().strip(),
        User.role == "teacher"
    ).first()

    if not user:
        raise HTTPException(404, "No teacher account found with this email")

    if user.is_verified:
        return {"message": "This email is already verified. You can login now."}

    verification_token = generate_verification_token()
    token_expires_at = datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)
    
    user.verification_token = verification_token
    user.verification_token_expires_at = token_expires_at
    db.commit()

    email_sent = send_verification_email(user.email, user.name, verification_token)

    if email_sent:
        return {"message": f"Verification email resent to {user.email}"}
    else:
        return {"message": "[DEV MODE] Verification link generated. Check terminal for link."}


# ── Me ─────────────────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        roll_no=current_user.roll_no,
        is_verified=current_user.is_verified
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