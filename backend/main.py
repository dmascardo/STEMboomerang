from __future__ import annotations

import json
import os
import re
import shutil
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Tuple, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Optional (recommended): load OPENAI_API_KEY from backend/.env
try:
    from dotenv import load_dotenv  # type: ignore
except Exception:
    load_dotenv = None


# =========================================================
# App
# =========================================================
app = FastAPI(title="STEM Boomerang Backend", version="2.0.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# Load env (.env)
# =========================================================
if load_dotenv:
    load_dotenv()  # loads backend/.env if present


# =========================================================
# Paths + DB
# =========================================================
BASE_DIR = Path(__file__).resolve().parent  # backend/
DB_PATH = (BASE_DIR / "candidates.db").resolve()
UPLOADS_DIR = (BASE_DIR / "uploads").resolve()

BASE_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


# =========================================================
# DB Models
# =========================================================
class CandidateDB(Base):
    """
    Deliverable 1 fields + quality indicators + derived fields,
    stored in ONE table (your request).
    """
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)

    # -----------------------------
    # 5.1 Required Fields (Core)
    # -----------------------------
    full_name = Column(String, nullable=True)
    email = Column(String, nullable=False, index=True, unique=True)
    phone = Column(String, nullable=True)
    linkedin_url = Column(Text, nullable=True)

    city = Column(String, nullable=True)
    state = Column(String, nullable=True)

    school = Column(String, nullable=True)
    degree = Column(String, nullable=True)
    terminal_degree_year = Column(String, nullable=True)

    current_job_title = Column(String, nullable=True)

    resume_source_link = Column(Text, nullable=True)

    needs_review = Column(String, nullable=False, default="YES")
    review_reason = Column(Text, nullable=True)

    # -----------------------------
    # 5.2 Optional Fields
    # -----------------------------
    skills = Column(Text, nullable=True)  # JSON list string
    professional_summary = Column(Text, nullable=True)
    latest_company = Column(String, nullable=True)
    certifications = Column(Text, nullable=True)  # JSON list string
    portfolio_url = Column(Text, nullable=True)
    github_url = Column(Text, nullable=True)

    # -----------------------------
    # 5.3 Academic/Research Context
    # -----------------------------
    academic_title = Column(String, nullable=True)
    research_area = Column(String, nullable=True)
    publications_summary = Column(Text, nullable=True)
    awards_summary = Column(Text, nullable=True)

    # -----------------------------
    # Location extras
    # -----------------------------
    state_full = Column(String, nullable=True)
    location_display = Column(String, nullable=True)

    # -----------------------------
    # Derived career level fields
    # -----------------------------
    years_experience_overall = Column(String, nullable=True)
    years_experience_in_field = Column(String, nullable=True)

    title_seniority_signal = Column(String, nullable=True)
    education_stage_signal = Column(String, nullable=True)
    career_level_overall = Column(String, nullable=True)
    career_level_target_field = Column(String, nullable=True)
    career_level_confidence = Column(String, nullable=True)
    career_level_reason = Column(Text, nullable=True)

    # -----------------------------
    # Resume metadata
    # -----------------------------
    resume_file_name = Column(String, nullable=True)
    resume_file_type = Column(String, nullable=True)
    resume_page_count = Column(Integer, nullable=False, default=0)
    resume_text_quality = Column(String, nullable=True)

    # -----------------------------
    # Quality indicators
    # -----------------------------
    parsed_char_count = Column(Integer, nullable=False, default=0)
    llm_input_char_count = Column(Integer, nullable=False, default=0)

    fields_found_count = Column(Integer, nullable=False, default=0)
    required_fields_found_count = Column(Integer, nullable=False, default=0)

    required_fields_missing = Column(Text, nullable=True)  # JSON list string
    extraction_confidence = Column(String, nullable=True)

    flag_reasons = Column(Text, nullable=True)  # JSON list string
    flag_details = Column(Text, nullable=True)

    extracted_fields = Column(Text, nullable=True)  # JSON dict string

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class ResumeDB(Base):
    """
    File-level log for batch runs + debugging.
    """
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)

    candidate_id = Column(Integer, nullable=True, index=True)

    resume_file_name = Column(String, nullable=False)
    resume_file_type = Column(String, nullable=True)
    saved_path = Column(Text, nullable=False)
    content_sha256 = Column(String, nullable=True, index=True, unique=True)
    normalized_text_sha256 = Column(String, nullable=True, index=True, unique=True)

    parsed_char_count = Column(Integer, nullable=False, default=0)
    resume_page_count = Column(Integer, nullable=False, default=0)
    resume_text_quality = Column(String, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
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
                conn.exec_driver_sql("ALTER TABLE resumes ADD COLUMN content_sha256 VARCHAR")
            if "normalized_text_sha256" not in col_names:
                conn.exec_driver_sql("ALTER TABLE resumes ADD COLUMN normalized_text_sha256 VARCHAR")

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
# Response Schemas
# =========================================================
class CandidateOut(BaseModel):
    id: int

    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None

    school: Optional[str] = None
    degree: Optional[str] = None
    terminal_degree_year: Optional[str] = None
    current_job_title: Optional[str] = None

    skills: Optional[str] = None
    professional_summary: Optional[str] = None
    latest_company: Optional[str] = None
    certifications: Optional[str] = None
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None

    academic_title: Optional[str] = None
    research_area: Optional[str] = None
    publications_summary: Optional[str] = None
    awards_summary: Optional[str] = None

    state_full: Optional[str] = None
    location_display: Optional[str] = None

    years_experience_overall: Optional[str] = None
    years_experience_in_field: Optional[str] = None
    title_seniority_signal: Optional[str] = None
    education_stage_signal: Optional[str] = None
    career_level_overall: Optional[str] = None
    career_level_target_field: Optional[str] = None
    career_level_confidence: Optional[str] = None
    career_level_reason: Optional[str] = None

    resume_source_link: Optional[str] = None

    resume_file_name: Optional[str] = None
    resume_file_type: Optional[str] = None
    resume_page_count: int
    resume_text_quality: Optional[str] = None

    needs_review: str
    review_reason: Optional[str] = None

    parsed_char_count: int
    llm_input_char_count: int
    fields_found_count: int
    required_fields_found_count: int
    required_fields_missing: Optional[str] = None
    extraction_confidence: Optional[str] = None
    flag_reasons: Optional[str] = None
    flag_details: Optional[str] = None

    extracted_fields: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ResumeOut(BaseModel):
    id: int
    candidate_id: Optional[int] = None
    resume_file_name: str
    resume_file_type: Optional[str] = None
    saved_path: str
    content_sha256: Optional[str] = None
    normalized_text_sha256: Optional[str] = None
    parsed_char_count: int
    resume_page_count: int
    resume_text_quality: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UploadResponse(BaseModel):
    candidate: CandidateOut
    resume: ResumeOut
    duplicate: bool = False
    duplicate_type: Optional[str] = None


class BatchUploadResponse(BaseModel):
    results: List[UploadResponse]


# =========================================================
# Helpers - JSON, normalization
# =========================================================
def safe_json(obj: Any) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False)
    except Exception:
        return json.dumps({"error": "failed_to_serialize"})


def to_db_text(value: Any) -> Any:
    """
    SQLite cannot store Python lists/dicts directly.
    Convert them into JSON strings.
    """
    if isinstance(value, (list, dict)):
        return safe_json(value)
    return value


def normalize_str(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = v.strip()
    return s or None


def normalize_email(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    s = v.strip().lower()
    return s or None


def title_case_words(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    parts = [p for p in v.strip().split() if p]
    return " ".join([p[:1].upper() + p[1:].lower() for p in parts])


def normalize_state(state: Optional[str]) -> Optional[str]:
    if not state:
        return None
    s = state.strip()
    if not s:
        return None
    return s.upper()


def make_location_display(city: Optional[str], state: Optional[str]) -> Optional[str]:
    if city and state:
        return f"{city}, {state}"
    return None


# =========================================================
# Helpers - file type / extraction
# =========================================================
def detect_file_type(filename: str) -> str:
    fn = (filename or "").lower()
    if fn.endswith(".pdf"):
        return "pdf"
    if fn.endswith(".docx"):
        return "docx"
    if fn.endswith(".txt"):
        return "txt"
    return "other"


def compute_sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalize_resume_text_for_hash(text: str) -> str:
    """
    Stable normalization for content-level dedupe across different file exports.
    """
    s = (text or "").lower()
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def extract_text_pdf(path: Path) -> str:
    """
    1) pdfplumber (better on resumes)
    2) pypdf fallback
    """
    try:
        import pdfplumber  # type: ignore
        with pdfplumber.open(str(path)) as pdf:
            text = "\n".join([(page.extract_text() or "") for page in pdf.pages]).strip()
            if text:
                return text
    except Exception:
        pass

    try:
        from pypdf import PdfReader  # type: ignore
        reader = PdfReader(str(path))
        return "\n".join([(p.extract_text() or "") for p in reader.pages]).strip()
    except Exception:
        return ""


def get_pdf_page_count(path: Path) -> int:
    try:
        import pdfplumber  # type: ignore
        with pdfplumber.open(str(path)) as pdf:
            return int(len(pdf.pages))
    except Exception:
        pass

    try:
        from pypdf import PdfReader  # type: ignore
        reader = PdfReader(str(path))
        return int(len(reader.pages))
    except Exception:
        return 0


def extract_text_docx(path: Path) -> str:
    try:
        import docx  # type: ignore
        d = docx.Document(str(path))
        return "\n".join([p.text for p in d.paragraphs if p.text]).strip()
    except Exception:
        return ""


def extract_text_txt(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore").strip()
    except Exception:
        return ""


def get_docx_page_count_estimate(text: str) -> int:
    if not text:
        return 0
    return max(1, int(len(text) / 1800))


def compute_text_quality(parsed_char_count: int) -> str:
    if parsed_char_count >= 1500:
        return "High"
    if parsed_char_count >= 300:
        return "Medium"
    return "Low"


# =========================================================
# Heuristic extractors
# =========================================================
EMAIL_RE = re.compile(r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)")
PHONE_RE = re.compile(r"(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
URL_RE = re.compile(r"(https?://[^\s)]+)")
LINKEDIN_RE = re.compile(r"(https?://(?:www\.)?linkedin\.com/[^\s)]+|(?:www\.)?linkedin\.com/[^\s)]+)", re.IGNORECASE)
GITHUB_RE = re.compile(r"(https?://(?:www\.)?github\.com/[A-Za-z0-9_.-]+|(?:www\.)?github\.com/[A-Za-z0-9_.-]+)", re.IGNORECASE)

STATE_ABBREV = (
    "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|"
    "MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC"
)
STATE_NAME_TO_ABBR: Dict[str, str] = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
    "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
    "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
    "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
    "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
    "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
    "district of columbia": "DC",
}
STATE_ABBR_TO_FULL = {v: k.title() for k, v in STATE_NAME_TO_ABBR.items()}

CITY_STATE_RE = re.compile(rf"\b([A-Za-z][A-Za-z .'-]+?),\s*({STATE_ABBREV})\b")
CITY_STATE_SPACE_RE = re.compile(rf"\b([A-Za-z][A-Za-z .'-]+?)\s+({STATE_ABBREV})\b")
CITY_STATE_PUNCT_RE = re.compile(rf"\b([A-Za-z][A-Za-z .'-]+?)\s*[•·–—\-]\s*({STATE_ABBREV})\b")
CITY_STATE_FULLNAME_RE = re.compile(r"\b([A-Za-z][A-Za-z .'-]+?),\s*([A-Za-z ]{3,})\b")

YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")


def guess_email(text: str) -> Optional[str]:
    m = EMAIL_RE.search(text or "")
    return m.group(1).lower().strip() if m else None


def guess_phone(text: str) -> Optional[str]:
    m = PHONE_RE.search(text or "")
    return m.group(0).strip() if m else None


def guess_linkedin(text: str) -> Optional[str]:
    m = LINKEDIN_RE.search(text or "")
    if not m:
        return None
    url = m.group(1).strip()
    if url.startswith("www."):
        url = "https://" + url
    return url.lower()


def guess_github(text: str) -> Optional[str]:
    m = GITHUB_RE.search(text or "")
    if not m:
        return None

    url = m.group(1).strip()

    # Add https if missing
    if not url.lower().startswith("http"):
        url = "https://" + url.lstrip("/")

    return url.lower()


def guess_portfolio(text: str) -> Optional[str]:
    urls = [u.strip() for u in URL_RE.findall(text or "")]
    for u in urls:
        low = u.lower()
        if "linkedin.com" in low or "github.com" in low:
            continue
        return u
    return None


def guess_city_state(text: str) -> Tuple[Optional[str], Optional[str]]:
    t = text or ""

    m = CITY_STATE_RE.search(t)
    if m:
        return title_case_words(m.group(1).strip()), m.group(2).strip().upper()

    m2 = CITY_STATE_SPACE_RE.search(t)
    if m2:
        return title_case_words(m2.group(1).strip()), m2.group(2).strip().upper()

    m3 = CITY_STATE_PUNCT_RE.search(t)
    if m3:
        return title_case_words(m3.group(1).strip()), m3.group(2).strip().upper()

    m4 = CITY_STATE_FULLNAME_RE.search(t)
    if m4:
        city = title_case_words(m4.group(1).strip())
        state_name = m4.group(2).strip().lower()
        abbr = STATE_NAME_TO_ABBR.get(state_name)
        if abbr:
            return city, abbr

    return None, None


def guess_full_name(text: str) -> Optional[str]:
    if not text:
        return None

    headers = {
        "summary", "experience", "education", "skills", "projects", "certifications",
        "work experience", "technical skills", "professional experience"
    }

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for ln in lines[:30]:
        low = ln.lower()

        if low in headers:
            continue
        if "@" in ln:
            continue
        if PHONE_RE.search(ln):
            continue
        if "linkedin" in low or "github" in low or "http" in low or "www." in low:
            continue
        if len(ln) > 120:
            continue

        candidate = re.split(r"[|•·–—]", ln)[0].strip()
        candidate = re.sub(r"\s+", " ", candidate)

        if re.fullmatch(r"[A-Za-z][A-Za-z .'\-]+", candidate):
            words = candidate.split()
            if 2 <= len(words) <= 5:
                return candidate.strip()

    return None


def guess_degree_and_school(text: str) -> Tuple[Optional[str], Optional[str]]:
    if not text:
        return None, None

    degree_keywords = ["bachelor", "b.sc", "bs", "b.s", "master", "m.sc", "ms", "m.s", "phd", "doctor", "associate"]
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    school = None
    degree = None

    for ln in lines[:160]:
        low = ln.lower()
        if not school and ("university" in low or "college" in low or "institute" in low):
            school = ln[:140].strip()
        if not degree and any(k in low for k in degree_keywords):
            degree = ln[:180].strip()
        if school and degree:
            break

    return degree, school


def guess_terminal_degree_year(text: str) -> Optional[str]:
    if not text:
        return None

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    preferred = [
        ln for ln in lines[:220]
        if any(k in ln.lower() for k in ["graduation", "expected", "bachelor", "master", "phd", "university", "college"])
    ]
    for ln in preferred[:60]:
        m = YEAR_RE.search(ln)
        if m:
            return m.group(1)

    m2 = YEAR_RE.search(text)
    return m2.group(1) if m2 else None


def guess_current_job_title_and_company(text: str) -> Tuple[Optional[str], Optional[str]]:
    if not text:
        return None, None

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    exp_idx = None
    for i, ln in enumerate(lines[:250]):
        if ln.strip().lower() == "experience":
            exp_idx = i
            break

    start = exp_idx + 1 if exp_idx is not None else 0
    for ln in lines[start:start + 60]:
        if ln.startswith(("•", "●", "-")):
            continue

        if " - " in ln:
            parts = [p.strip() for p in ln.split(" - ", 1)]
            if len(parts) == 2 and parts[0] and parts[1]:
                return parts[0][:140], parts[1][:140]

        if " — " in ln:
            parts = [p.strip() for p in ln.split(" — ", 1)]
            if len(parts) == 2 and parts[0] and parts[1]:
                return parts[0][:140], parts[1][:140]

    return None, None


# =========================================================
# Markdown conversion
# =========================================================
SECTION_HEADERS = ["education", "experience", "skills", "projects", "certifications", "summary", "publications", "awards"]


def to_markdown(resume_text: str) -> str:
    if not resume_text:
        return ""

    md_lines: List[str] = []
    for raw in resume_text.splitlines():
        line = raw.strip()
        if not line:
            continue
        low = line.lower()

        if low in SECTION_HEADERS:
            md_lines.append(f"## {line.title()}")
            continue

        if line.startswith(("●", "•")):
            md_lines.append("- " + line[1:].strip())
        else:
            md_lines.append(line)

    return "\n".join(md_lines).strip()


# =========================================================
# LLM extraction
# =========================================================
LLM_REQUIRED_FIELDS = [
    "full_name",
    "email",
    "city",
    "state",
    "school",
    "degree",
    "terminal_degree_year",
    "current_job_title",
    "resume_source_link",
]

ALL_FIELDS = [
    "full_name", "email", "phone", "linkedin_url", "city", "state",
    "school", "degree", "terminal_degree_year", "current_job_title", "resume_source_link",
    "skills", "professional_summary", "latest_company", "certifications", "portfolio_url", "github_url",
    "academic_title", "research_area", "publications_summary", "awards_summary",
    "years_experience_overall", "years_experience_in_field", "title_seniority_signal",
    "education_stage_signal", "career_level_overall", "career_level_target_field",
    "career_level_confidence", "career_level_reason",
]


def try_openai_llm_extract(markdown_text: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        from openai import OpenAI  # type: ignore
    except Exception:
        return None, "openai_not_installed"

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None, "missing_OPENAI_API_KEY"

    try:
        client = OpenAI(api_key=api_key)
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        system = (
            "You extract candidate fields from resume text. "
            "Rules: Do NOT guess. Use null if missing/unclear. "
            "Return ONLY valid JSON (no markdown, no commentary)."
        )

        user = {
            "task": "Extract the fields listed in `fields` from the resume markdown in `resume_markdown`.",
            "fields": ALL_FIELDS,
            "output_rules": {
                "missing_values": "use null",
                "skills_and_certifications": "return arrays of strings when possible",
                "phone_format": "keep original formatting if present",
                "state": "2-letter USPS code uppercase when possible",
                "city": "Title Case when possible",
            },
            "resume_markdown": (markdown_text or "")[:12000],
        }

        resp = client.chat.completions.create(
            model=model,
            temperature=0.0,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
            ],
        )

        content = (resp.choices[0].message.content or "").strip()
        if not content:
            return None, "empty_llm_response"

        try:
            data = json.loads(content)
            if not isinstance(data, dict):
                return None, "llm_response_not_dict"
            return data, None
        except Exception:
            m = re.search(r"\{.*\}", content, flags=re.DOTALL)
            if m:
                try:
                    data = json.loads(m.group(0))
                    if isinstance(data, dict):
                        return data, None
                except Exception:
                    pass
            return None, "llm_json_parse_failed"

    except Exception:
        return None, "llm_call_failed"


# =========================================================
# Derived Career Level heuristic
# =========================================================
SENIORITY_ORDER = [
    ("intern", "Intern"),
    ("junior", "Junior"),
    ("associate", "Associate"),
    ("mid", "Mid"),
    ("senior", "Senior"),
    ("lead", "Lead"),
    ("principal", "Principal"),
    ("manager", "Manager"),
    ("director", "Director"),
    ("vp", "VP"),
    ("chief", "Chief"),
]


def derive_career_level_signals(
    current_job_title: Optional[str],
    degree_text: Optional[str],
    resume_text: str,
) -> Dict[str, Optional[str]]:
    title = (current_job_title or "").lower()
    deg = (degree_text or "").lower()
    text = (resume_text or "").lower()

    title_signal = None
    for k, label in SENIORITY_ORDER:
        if k in title:
            title_signal = label
            break

    edu_signal = None
    if "expected" in text or "expected" in deg:
        edu_signal = "Student"
    if "phd" in deg or "doctor" in deg:
        edu_signal = "PhD"
    elif "master" in deg or "m.s" in deg or "ms " in deg:
        edu_signal = "MS"
    elif "bachelor" in deg or "b.s" in deg or "bs " in deg:
        edu_signal = "BS"

    years = []
    for m in re.finditer(r"\b(19\d{2}|20\d{2})\s*[-–—]\s*(19\d{2}|20\d{2}|present)\b", text, flags=re.IGNORECASE):
        a = m.group(1)
        b = m.group(2)
        try:
            start = int(a)
        except Exception:
            continue
        if b.lower() == "present":
            end = datetime.utcnow().year
        else:
            try:
                end = int(b)
            except Exception:
                continue
        if 1950 <= start <= end <= (datetime.utcnow().year + 1):
            years.append(max(0, end - start))

    years_overall = None
    if years:
        years_overall = str(sum(years))

    level = None
    confidence = "Low"
    reason_parts: List[str] = []

    if edu_signal == "Student" or (title_signal == "Intern"):
        level = "Student"
        confidence = "High"
        reason_parts.append("Detected student/intern signal.")
    elif title_signal in ("Junior", "Associate"):
        level = "Early Career"
        confidence = "Medium"
        reason_parts.append(f"Title seniority signal: {title_signal}.")
    elif title_signal in ("Senior", "Lead", "Principal", "Manager", "Director", "VP", "Chief"):
        level = "Senior"
        confidence = "Medium"
        reason_parts.append(f"Title seniority signal: {title_signal}.")
    elif years_overall is not None:
        try:
            y = int(years_overall)
            if y <= 2:
                level = "Early Career"
                confidence = "Low"
                reason_parts.append("Estimated low years of experience.")
            elif 2 < y <= 7:
                level = "Mid Career"
                confidence = "Low"
                reason_parts.append("Estimated mid years of experience.")
            else:
                level = "Senior"
                confidence = "Low"
                reason_parts.append("Estimated high years of experience.")
        except Exception:
            pass

    return {
        "years_experience_overall": years_overall,
        "years_experience_in_field": None,
        "title_seniority_signal": title_signal,
        "education_stage_signal": edu_signal,
        "career_level_overall": level,
        "career_level_target_field": None,
        "career_level_confidence": confidence,
        "career_level_reason": " ".join(reason_parts) if reason_parts else None,
    }


# =========================================================
# Quality + flags
# =========================================================
def count_populated_fields(data: Dict[str, Any]) -> int:
    count = 0
    for k in ALL_FIELDS + [
        "state_full", "location_display",
        "resume_file_name", "resume_file_type", "resume_page_count", "resume_text_quality",
    ]:
        v = data.get(k)
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        count += 1
    return count


def normalize_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    data["email"] = normalize_email(data.get("email"))


    for u in ["linkedin_url", "github_url", "portfolio_url"]:
        v = data.get(u)
        if v and isinstance(v, str):
            v = v.strip()

            # if it's like "linkedin.com/..." or "github.com/..." add https://
            if not v.lower().startswith(("http://", "https://")):
                v = "https://" + v.lstrip("/")

            data[u] = v.lower()

    data["city"] = title_case_words(normalize_str(data.get("city")))
    data["state"] = normalize_state(data.get("state"))

    if data.get("state") and not data.get("state_full"):
        data["state_full"] = STATE_ABBR_TO_FULL.get(data["state"])
    data["location_display"] = make_location_display(data.get("city"), data.get("state"))

    return data


def compute_flags(data: Dict[str, Any], resume_text_quality: str) -> Dict[str, Any]:
    missing = []
    for f in LLM_REQUIRED_FIELDS:
        v = data.get(f)
        if v is None or (isinstance(v, str) and not v.strip()):
            missing.append(f)

    flags: List[str] = []
    details: List[str] = []

    if missing:
        flags.append("missing_required_fields")
        details.append(f"Missing required fields: {', '.join(missing)}")

    if resume_text_quality == "Low":
        flags.append("low_text_quality")
        details.append("Resume text quality is Low (may be scanned/image-only PDF).")

    if data.get("_conflicting_emails"):
        flags.append("conflicting_values")
        details.append("Multiple emails detected in resume text.")

    found = count_populated_fields(data)
    required_found = len(LLM_REQUIRED_FIELDS) - len(missing)

    if len(missing) == 0 and resume_text_quality == "High":
        conf = "High"
    elif len(missing) <= 2 and found >= 10 and resume_text_quality in ("High", "Medium"):
        conf = "Medium"
    else:
        conf = "Low"

    needs_review = "YES" if flags else "NO"
    review_reason = details[0] if details else None

    return {
        "needs_review": needs_review,
        "review_reason": review_reason,
        "required_fields_missing": missing,
        "fields_found_count": found,
        "required_fields_found_count": required_found,
        "extraction_confidence": conf,
        "flag_reasons": flags,
        "flag_details": " ".join(details) if details else None,
    }


# =========================================================
# Core processing function
# =========================================================
def process_resume_file(
    file: UploadFile,
    db: Session,
    overrides: Dict[str, Optional[str]],
) -> UploadResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    file_type = detect_file_type(file.filename)
    file_bytes = file.file.read()
    content_sha256 = compute_sha256_bytes(file_bytes)

    existing_resume = (
        db.query(ResumeDB)
        .filter(ResumeDB.content_sha256 == content_sha256)
        .order_by(ResumeDB.id.desc())
        .first()
    )
    if existing_resume:
        existing_candidate = db.get(CandidateDB, existing_resume.candidate_id) if existing_resume.candidate_id else None
        if not existing_candidate:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Duplicate resume detected, but linked candidate record was not found.",
                    "resume_id": existing_resume.id,
                },
            )
        return UploadResponse(
            candidate=existing_candidate,
            resume=existing_resume,
            duplicate=True,
            duplicate_type="exact",
        )

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    safe_name = file.filename.replace("/", "_").replace("\\", "_")
    saved_path = (UPLOADS_DIR / f"{ts}__{safe_name}").resolve()

    with saved_path.open("wb") as out:
        out.write(file_bytes)

    if file_type == "pdf":
        text = extract_text_pdf(saved_path)
        page_count = get_pdf_page_count(saved_path)
    elif file_type == "docx":
        text = extract_text_docx(saved_path)
        page_count = get_docx_page_count_estimate(text)
    elif file_type == "txt":
        text = extract_text_txt(saved_path)
        page_count = get_docx_page_count_estimate(text)
    else:
        text = ""
        page_count = 0

    parsed_char_count = len(text or "")
    resume_text_quality = compute_text_quality(parsed_char_count)
    normalized_text_sha256 = None
    normalized_for_hash = normalize_resume_text_for_hash(text)
    if normalized_for_hash:
        normalized_text_sha256 = compute_sha256_bytes(normalized_for_hash.encode("utf-8"))

    if normalized_text_sha256:
        existing_text_resume = (
            db.query(ResumeDB)
            .filter(ResumeDB.normalized_text_sha256 == normalized_text_sha256)
            .order_by(ResumeDB.id.desc())
            .first()
        )
        if existing_text_resume:
            if saved_path.exists():
                try:
                    saved_path.unlink()
                except Exception:
                    pass
            existing_candidate = db.get(CandidateDB, existing_text_resume.candidate_id) if existing_text_resume.candidate_id else None
            if not existing_candidate:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "Duplicate resume content detected, but linked candidate record was not found.",
                        "resume_id": existing_text_resume.id,
                    },
                )
            return UploadResponse(
                candidate=existing_candidate,
                resume=existing_text_resume,
                duplicate=True,
                duplicate_type="content",
            )

    emails = EMAIL_RE.findall(text or "")
    conflicting_emails = len(set([e.lower().strip() for e in emails])) > 1

    md = to_markdown(text)
    llm_input_char_count = len((md or "")[:12000])

    extracted: Dict[str, Any] = {k: normalize_str(v) for k, v in overrides.items()}
    extracted["email"] = normalize_email(extracted.get("email"))

    llm_data, llm_err = try_openai_llm_extract(md)
    llm_used = False
    if isinstance(llm_data, dict):
        llm_used = True
        for k in ALL_FIELDS:
            if extracted.get(k):
                continue
            extracted[k] = llm_data.get(k)

    # Heuristic fallbacks
    if not extracted.get("email"):
        extracted["email"] = guess_email(text)
    if not extracted.get("phone"):
        extracted["phone"] = guess_phone(text)
    if not extracted.get("linkedin_url"):
        extracted["linkedin_url"] = guess_linkedin(text)
    if not extracted.get("github_url"):
        extracted["github_url"] = guess_github(text)
    if not extracted.get("portfolio_url"):
        extracted["portfolio_url"] = guess_portfolio(text)

    if not extracted.get("city") or not extracted.get("state"):
        g_city, g_state = guess_city_state(text)
        if not extracted.get("city"):
            extracted["city"] = g_city
        if not extracted.get("state"):
            extracted["state"] = g_state

    if not extracted.get("full_name"):
        extracted["full_name"] = guess_full_name(text)

    if not extracted.get("degree") or not extracted.get("school"):
        g_degree, g_school = guess_degree_and_school(text)
        if not extracted.get("degree"):
            extracted["degree"] = g_degree
        if not extracted.get("school"):
            extracted["school"] = g_school

    if not extracted.get("terminal_degree_year"):
        extracted["terminal_degree_year"] = guess_terminal_degree_year(text)

    if not extracted.get("current_job_title") or not extracted.get("latest_company"):
        g_title, g_company = guess_current_job_title_and_company(text)
        if not extracted.get("current_job_title"):
            extracted["current_job_title"] = g_title
        if not extracted.get("latest_company"):
            extracted["latest_company"] = g_company

    if not extracted.get("resume_source_link"):
        extracted["resume_source_link"] = str(saved_path)

    # Resume metadata
    extracted["resume_file_name"] = file.filename
    extracted["resume_file_type"] = file_type
    extracted["resume_page_count"] = page_count
    extracted["resume_text_quality"] = resume_text_quality

    # Derived fields
    derived = derive_career_level_signals(
        current_job_title=extracted.get("current_job_title"),
        degree_text=extracted.get("degree"),
        resume_text=text,
    )
    for k, v in derived.items():
        if not extracted.get(k):
            extracted[k] = v

    extracted["_conflicting_emails"] = conflicting_emails
    extracted = normalize_fields(extracted)

    if not extracted.get("email"):
        if saved_path.exists():
            try:
                saved_path.unlink()
            except Exception:
                pass
        raise HTTPException(status_code=400, detail="Email is required")

    quality = compute_flags(extracted, resume_text_quality)

    # Ensure comma-strings -> JSON list for skills/certs
    for list_field in ["skills", "certifications"]:
        v = extracted.get(list_field)
        if isinstance(v, str) and v and "," in v and not v.strip().startswith("["):
            items = [s.strip() for s in v.split(",") if s.strip()]
            extracted[list_field] = safe_json(items)

    # 🔥 THE FIX: ensure no list/dict types remain before DB insert
    for k in ["skills", "certifications", "publications_summary", "awards_summary"]:
        extracted[k] = to_db_text(extracted.get(k))

    extracted.pop("_conflicting_emails", None)

    candidate_values = dict(
        full_name=extracted.get("full_name"),
        email=extracted.get("email"),
        phone=extracted.get("phone"),
        linkedin_url=extracted.get("linkedin_url"),
        city=extracted.get("city"),
        state=extracted.get("state"),
        school=extracted.get("school"),
        degree=extracted.get("degree"),
        terminal_degree_year=extracted.get("terminal_degree_year"),
        current_job_title=extracted.get("current_job_title"),
        resume_source_link=extracted.get("resume_source_link"),

        skills=to_db_text(extracted.get("skills")),
        professional_summary=to_db_text(extracted.get("professional_summary")),
        latest_company=to_db_text(extracted.get("latest_company")),
        certifications=to_db_text(extracted.get("certifications")),
        portfolio_url=to_db_text(extracted.get("portfolio_url")),
        github_url=to_db_text(extracted.get("github_url")),

        academic_title=to_db_text(extracted.get("academic_title")),
        research_area=to_db_text(extracted.get("research_area")),
        publications_summary=to_db_text(extracted.get("publications_summary")),
        awards_summary=to_db_text(extracted.get("awards_summary")),

        state_full=to_db_text(extracted.get("state_full")),
        location_display=to_db_text(extracted.get("location_display")),

        years_experience_overall=to_db_text(extracted.get("years_experience_overall")),
        years_experience_in_field=to_db_text(extracted.get("years_experience_in_field")),
        title_seniority_signal=to_db_text(extracted.get("title_seniority_signal")),
        education_stage_signal=to_db_text(extracted.get("education_stage_signal")),
        career_level_overall=to_db_text(extracted.get("career_level_overall")),
        career_level_target_field=to_db_text(extracted.get("career_level_target_field")),
        career_level_confidence=to_db_text(extracted.get("career_level_confidence")),
        career_level_reason=to_db_text(extracted.get("career_level_reason")),

        resume_file_name=file.filename,
        resume_file_type=file_type,
        resume_page_count=page_count,
        resume_text_quality=resume_text_quality,

        needs_review=quality["needs_review"],
        review_reason=quality["review_reason"],
        parsed_char_count=parsed_char_count,
        llm_input_char_count=llm_input_char_count,
        fields_found_count=quality["fields_found_count"],
        required_fields_found_count=quality["required_fields_found_count"],
        required_fields_missing=to_db_text(quality["required_fields_missing"]) if quality["required_fields_missing"] else None,
        extraction_confidence=quality["extraction_confidence"],
        flag_reasons=to_db_text(quality["flag_reasons"]) if quality["flag_reasons"] else None,
        flag_details=quality["flag_details"],

        extracted_fields=safe_json(
            {
                "source": "upload_and_extract",
                "llm_used": llm_used,
                "llm_error": llm_err,
                "file_type": file_type,
                "parsed_char_count": parsed_char_count,
                "llm_input_char_count": llm_input_char_count,
                "final_values": extracted,
            }
        ),
    )

    candidate = None
    if extracted.get("email"):
        candidate = (
            db.query(CandidateDB)
            .filter(CandidateDB.email == extracted["email"])
            .order_by(CandidateDB.id.desc())
            .first()
        )

    if candidate is None:
        candidate = CandidateDB(**candidate_values)
        db.add(candidate)
    else:
        for field, value in candidate_values.items():
            setattr(candidate, field, value)

    db.flush()

    resume_row = ResumeDB(
        candidate_id=candidate.id,
        resume_file_name=file.filename,
        resume_file_type=file_type,
        saved_path=str(saved_path),
        content_sha256=content_sha256,
        normalized_text_sha256=normalized_text_sha256,
        parsed_char_count=parsed_char_count,
        resume_page_count=page_count,
        resume_text_quality=resume_text_quality,
    )
    db.add(resume_row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if saved_path.exists():
            try:
                saved_path.unlink()
            except Exception:
                pass

        existing_resume = (
            db.query(ResumeDB)
            .filter(ResumeDB.content_sha256 == content_sha256)
            .order_by(ResumeDB.id.desc())
            .first()
        )
        duplicate_type = "exact"
        if not existing_resume and normalized_text_sha256:
            existing_resume = (
                db.query(ResumeDB)
                .filter(ResumeDB.normalized_text_sha256 == normalized_text_sha256)
                .order_by(ResumeDB.id.desc())
                .first()
            )
            if existing_resume:
                duplicate_type = "content"
        if existing_resume:
            existing_candidate = db.get(CandidateDB, existing_resume.candidate_id) if existing_resume.candidate_id else None
            if existing_candidate:
                return UploadResponse(
                    candidate=existing_candidate,
                    resume=existing_resume,
                    duplicate=True,
                    duplicate_type=duplicate_type,
                )
        raise HTTPException(status_code=409, detail="Duplicate resume detected")

    db.refresh(candidate)
    db.refresh(resume_row)

    return UploadResponse(candidate=candidate, resume=resume_row, duplicate=False, duplicate_type=None)


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
def list_candidates(db: Session = Depends(get_db)) -> List[CandidateDB]:
    return db.query(CandidateDB).order_by(CandidateDB.id.desc()).all()


@app.get("/candidates/{candidate_id}", response_model=CandidateOut)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)) -> CandidateDB:
    row = db.get(CandidateDB, candidate_id)
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return row


@app.get("/resumes", response_model=List[ResumeOut])
def list_resumes(db: Session = Depends(get_db)) -> List[ResumeDB]:
    return db.query(ResumeDB).order_by(ResumeDB.id.desc()).all()


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
