from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import create_tables
from backend.routers import jobs, register, attendance, students
from backend.routers.auth import router as auth_router

app = FastAPI(
    title="Smart Attendance API",
    description="AI-powered attendance marking using YOLO + DeepFace + DBSCAN",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(jobs.router)
app.include_router(register.router)
app.include_router(attendance.router)
app.include_router(students.router)


@app.on_event("startup")
def startup():
    create_tables()
    print("✅ Database tables created/verified.")
    print("✅ Smart Attendance API is running.")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Smart Attendance API"}
