import json
from typing import Any, Optional
import hashlib
import re
from pathlib import Path


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
    print(f"Extracting text from PDF: {path}")
    try:
        import pdfplumber

        print(f"Extracting text from PDF: {path}")
        with pdfplumber.open(str(path)) as pdf:
            text = "\n".join(
                [(page.extract_text() or "") for page in pdf.pages]
            ).strip()
            if text:
                print(f"Extracted text from PDF: {text}")
                return text

    except Exception:
        pass

    try:
        from pypdf import PdfReader

        print(f"Extracting text from PDF: {path}")
        reader = PdfReader(str(path))
        print(f"Extracted text from PDF: {reader}")
        text = "\n".join([(p.extract_text() or "") for p in reader.pages]).strip()
        if text:
            print(f"Extracted text from PDF: {text}")
            return text
        return ""
    except Exception:
        return ""


def get_pdf_page_count(path: Path) -> int:
    try:
        import pdfplumber

        with pdfplumber.open(str(path)) as pdf:
            return int(len(pdf.pages))
    except Exception:
        pass

    try:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        return int(len(reader.pages))
    except Exception:
        return 0


def extract_text_docx(path: Path) -> str:
    try:
        import docx

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
