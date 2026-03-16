from __future__ import annotations

import os
from typing import Optional, List

from processing.core import process_resume_file
from response_types import (
    UploadResponse,
    CandidateOut,
    ResumeOut,
    BatchUploadResponse,
    CandidateUpdate,
)
from models import CandidateDB, ResumeDB, Base
from constants import BASE_DIR, DB_PATH, UPLOADS_DIR, DATABASE_URL
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from utils.conversions import candidate_db_to_out


# Optional (recommended): load OPENAI_API_KEY from backend/.env
try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None


# =========================================================
# App
# =========================================================
app = FastAPI(title="STEM Boomerang Backend", version="2.0.2")

cors_origins_env = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
cors_origins = [
    origin.strip() for origin in cors_origins_env.split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    # allow_origins=cors_origins,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# Load env (.env)
# =========================================================
if load_dotenv:
    load_dotenv()  # loads backend/.env if present


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    future=True,
)


# 3. Create all tables in the database
def create_db_and_tables():
    Base.metadata.create_all(bind=engine)


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()
    ensure_resume_dedupe_schema()
    ensure_candidate_email_unique_schema()
    ensure_candidate_email_not_null_schema()


def ensure_resume_dedupe_schema() -> None:
    """
    Lightweight SQLite migration for existing local DBs.
    Adds content_sha256 if missing and a unique index for future dedupe.
    """
    try:
        with engine.begin() as conn:
            cols = conn.exec_driver_sql("PRAGMA table_info(resumes)").fetchall()
            col_names = {str(row[1]) for row in cols}

            if "content_sha256" not in col_names:
                conn.exec_driver_sql(
                    "ALTER TABLE resumes ADD COLUMN content_sha256 VARCHAR"
                )
            if "normalized_text_sha256" not in col_names:
                conn.exec_driver_sql(
                    "ALTER TABLE resumes ADD COLUMN normalized_text_sha256 VARCHAR"
                )

            conn.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_resumes_content_sha256 "
                "ON resumes(content_sha256) WHERE content_sha256 IS NOT NULL"
            )
            conn.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_resumes_normalized_text_sha256 "
                "ON resumes(normalized_text_sha256) WHERE normalized_text_sha256 IS NOT NULL"
            )
    except Exception:
        # Keep startup resilient; app-level dedupe still runs even if migration/index creation fails.
        pass


def ensure_candidate_email_unique_schema() -> None:
    """
    Lightweight SQLite migration for existing local DBs.
    Adds a unique index so non-null candidate emails stay unique.
    """
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_candidates_email "
                "ON candidates(email) WHERE email IS NOT NULL"
            )
    except Exception:
        # Keep startup resilient when old local data still contains duplicate emails.
        pass


def ensure_candidate_email_not_null_schema() -> None:
    """
    Enforce non-null/non-empty emails for existing SQLite DBs without rebuilding tables.
    """
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                """
                CREATE TRIGGER IF NOT EXISTS trg_candidates_email_not_null_insert
                BEFORE INSERT ON candidates
                FOR EACH ROW
                WHEN NEW.email IS NULL OR trim(NEW.email) = ''
                BEGIN
                    SELECT RAISE(ABORT, 'candidates.email cannot be null');
                END;
                """
            )
            conn.exec_driver_sql(
                """
                CREATE TRIGGER IF NOT EXISTS trg_candidates_email_not_null_update
                BEFORE UPDATE OF email ON candidates
                FOR EACH ROW
                WHEN NEW.email IS NULL OR trim(NEW.email) = ''
                BEGIN
                    SELECT RAISE(ABORT, 'candidates.email cannot be null');
                END;
                """
            )
    except Exception:
        # Keep startup resilient if trigger creation fails for any local DB edge case.
        pass


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================================================
# Routes
# =========================================================
@app.get("/")
def root() -> dict:
    return {"status": "ok", "hint": "Try /docs or /health"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/debug/paths")
def debug_paths() -> dict:
    return {
        "base_dir": str(BASE_DIR),
        "db_path": str(DB_PATH),
        "uploads_dir": str(UPLOADS_DIR),
    }


@app.get("/candidates", response_model=List[CandidateOut])
def list_candidates(db: Session = Depends(get_db)) -> List[CandidateOut]:
    rows = db.query(CandidateDB).order_by(CandidateDB.id.desc()).all()
    return [candidate_db_to_out(row) for row in rows]
    # return db.query(CandidateDB).order_by(CandidateDB.id.desc()).all()


@app.get("/candidates/{candidate_id}", response_model=CandidateOut)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)) -> CandidateOut:
    row = db.get(CandidateDB, candidate_id)
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate_db_to_out(row)


@app.get("/resumes", response_model=List[ResumeOut])
def list_resumes(db: Session = Depends(get_db)) -> List[ResumeOut]:
    return db.query(ResumeDB).order_by(ResumeDB.id.desc()).all()


@app.post("/resumes/temp-upload")
def temp_upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UploadResponse:
    print(f"Temp upload resume: {file.filename}")
    return process_resume_file(file=file, db=db, overrides={})


@app.post("/resumes/upload", response_model=UploadResponse)
def upload_resume(
    file: UploadFile = File(...),
    full_name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    school: Optional[str] = Form(None),
    degree: Optional[str] = Form(None),
    terminal_degree_year: Optional[str] = Form(None),
    current_job_title: Optional[str] = Form(None),
    latest_company: Optional[str] = Form(None),
    skills: Optional[str] = Form(None),
    certifications: Optional[str] = Form(None),
    professional_summary: Optional[str] = Form(None),
    portfolio_url: Optional[str] = Form(None),
    github_url: Optional[str] = Form(None),
    academic_title: Optional[str] = Form(None),
    research_area: Optional[str] = Form(None),
    publications_summary: Optional[str] = Form(None),
    awards_summary: Optional[str] = Form(None),
    resume_source_link: Optional[str] = Form(None),
    db: Session = Depends(get_db),
) -> UploadResponse:
    overrides = {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "linkedin_url": linkedin_url,
        "city": city,
        "state": state,
        "school": school,
        "degree": degree,
        "terminal_degree_year": terminal_degree_year,
        "current_job_title": current_job_title,
        "latest_company": latest_company,
        "skills": skills,
        "certifications": certifications,
        "professional_summary": professional_summary,
        "portfolio_url": portfolio_url,
        "github_url": github_url,
        "academic_title": academic_title,
        "research_area": research_area,
        "publications_summary": publications_summary,
        "awards_summary": awards_summary,
        "resume_source_link": resume_source_link,
    }
    return process_resume_file(file=file, db=db, overrides=overrides)


@app.post("/resumes/batch_upload", response_model=BatchUploadResponse)
def batch_upload_resumes(
    files: List[UploadFile] = File(...),
    resume_source_link: Optional[str] = Form(None),
    db: Session = Depends(get_db),
) -> BatchUploadResponse:
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    results: List[UploadResponse] = []
    for f in files:
        overrides = {"resume_source_link": resume_source_link}
        results.append(process_resume_file(file=f, db=db, overrides=overrides))

    return BatchUploadResponse(results=results)


@app.post("/candidates/update", response_model=CandidateOut)
def update_candidate(
    id: int,
    candidate: CandidateUpdate, 
    db: Session = Depends(get_db),
) -> CandidateOut:
    candidate = db.get(CandidateDB, id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    for field, value in candidate.model_dump().items():
        setattr(candidate, field, value)
    db.commit()
    db.refresh(candidate)
    return candidate_db_to_out(candidate)
