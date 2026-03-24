from typing import Any, Dict, List
from processing.heuristics import STATE_ABBR_TO_FULL
from utils.helpers import (
    normalize_str,
    title_case_words,
    normalize_email,
    normalize_state,
    make_location_display,
)
from processing.llm import ALL_FIELDS, LLM_REQUIRED_FIELDS


# =========================================================
# Quality + flags
# =========================================================
def count_populated_fields(data: Dict[str, Any]) -> int:
    count = 0
    for k in ALL_FIELDS + [
        "state_full",
        "location_display",
        "resume_file_name",
        "resume_file_type",
        "resume_page_count",
        "resume_text_quality",
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
    data["location_display"] = make_location_display(
        data.get("city"), data.get("state")
    )

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
    elif (
        len(missing) <= 2 and found >= 10 and resume_text_quality in ("High", "Medium")
    ):
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
