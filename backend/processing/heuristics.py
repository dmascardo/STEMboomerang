from datetime import datetime
import re
from typing import Any, List, Optional, Tuple, Dict
from utils.helpers import title_case_words


# =========================================================
# Heuristic extractors
# =========================================================
EMAIL_RE = re.compile(r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)")
PHONE_RE = re.compile(r"(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
URL_RE = re.compile(r"(https?://[^\s)]+)")
LINKEDIN_RE = re.compile(
    r"(https?://(?:www\.)?linkedin\.com/[^\s)]+|(?:www\.)?linkedin\.com/[^\s)]+)",
    re.IGNORECASE,
)
GITHUB_RE = re.compile(
    r"(https?://(?:www\.)?github\.com/[A-Za-z0-9_.-]+|(?:www\.)?github\.com/[A-Za-z0-9_.-]+)",
    re.IGNORECASE,
)

STATE_ABBREV = (
    "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|"
    "MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC"
)
STATE_NAME_TO_ABBR: Dict[str, str] = {
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "colorado": "CO",
    "connecticut": "CT",
    "delaware": "DE",
    "florida": "FL",
    "georgia": "GA",
    "hawaii": "HI",
    "idaho": "ID",
    "illinois": "IL",
    "indiana": "IN",
    "iowa": "IA",
    "kansas": "KS",
    "kentucky": "KY",
    "louisiana": "LA",
    "maine": "ME",
    "maryland": "MD",
    "massachusetts": "MA",
    "michigan": "MI",
    "minnesota": "MN",
    "mississippi": "MS",
    "missouri": "MO",
    "montana": "MT",
    "nebraska": "NE",
    "nevada": "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "ohio": "OH",
    "oklahoma": "OK",
    "oregon": "OR",
    "pennsylvania": "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    "tennessee": "TN",
    "texas": "TX",
    "utah": "UT",
    "vermont": "VT",
    "virginia": "VA",
    "washington": "WA",
    "west virginia": "WV",
    "wisconsin": "WI",
    "wyoming": "WY",
    "district of columbia": "DC",
}
STATE_ABBR_TO_FULL = {v: k.title() for k, v in STATE_NAME_TO_ABBR.items()}

CITY_STATE_RE = re.compile(rf"\b([A-Za-z][A-Za-z .'-]+?),\s*({STATE_ABBREV})\b")
CITY_STATE_SPACE_RE = re.compile(rf"\b([A-Za-z][A-Za-z .'-]+?)\s+({STATE_ABBREV})\b")
CITY_STATE_PUNCT_RE = re.compile(
    rf"\b([A-Za-z][A-Za-z .'-]+?)\s*[•·–—\-]\s*({STATE_ABBREV})\b"
)
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
        "summary",
        "experience",
        "education",
        "skills",
        "projects",
        "certifications",
        "work experience",
        "technical skills",
        "professional experience",
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

    degree_keywords = [
        "bachelor",
        "b.sc",
        "bs",
        "b.s",
        "master",
        "m.sc",
        "ms",
        "m.s",
        "phd",
        "doctor",
        "associate",
    ]
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    school = None
    degree = None

    for ln in lines[:160]:
        low = ln.lower()
        if not school and (
            "university" in low or "college" in low or "institute" in low
        ):
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
        ln
        for ln in lines[:220]
        if any(
            k in ln.lower()
            for k in [
                "graduation",
                "expected",
                "bachelor",
                "master",
                "phd",
                "university",
                "college",
            ]
        )
    ]
    for ln in preferred[:60]:
        m = YEAR_RE.search(ln)
        if m:
            return m.group(1)

    m2 = YEAR_RE.search(text)
    return m2.group(1) if m2 else None


def guess_current_job_title_and_company(
    text: str,
) -> Tuple[Optional[str], Optional[str]]:
    if not text:
        return None, None

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    exp_idx = None
    for i, ln in enumerate(lines[:250]):
        if ln.strip().lower() == "experience":
            exp_idx = i
            break

    start = exp_idx + 1 if exp_idx is not None else 0
    for ln in lines[start : start + 60]:
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
    def _coerce_text(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, list):
            return " ".join(str(item) for item in value if item is not None).strip()
        if isinstance(value, dict):
            return " ".join(f"{key} {val}" for key, val in value.items()).strip()
        return str(value).strip()

    title = _coerce_text(current_job_title).lower()
    deg = _coerce_text(degree_text).lower()
    text = _coerce_text(resume_text).lower()

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
    for m in re.finditer(
        r"\b(19\d{2}|20\d{2})\s*[-–—]\s*(19\d{2}|20\d{2}|present)\b",
        text,
        flags=re.IGNORECASE,
    ):
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
    elif title_signal in (
        "Senior",
        "Lead",
        "Principal",
        "Manager",
        "Director",
        "VP",
        "Chief",
    ):
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
