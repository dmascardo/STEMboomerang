import json
from typing import Any

from models import CandidateDB
from response_types import CandidateOut, CandidateUpdate


def _decode_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception:
            return [item.strip() for item in value.split(",") if item.strip()]
    return []


def _decode_text(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        parsed = json.loads(value)
    except Exception:
        return value
    if isinstance(parsed, list):
        return "; ".join(str(item) for item in parsed if item is not None)
    return value


def candidate_db_to_out(candidate: type[CandidateDB]) -> CandidateOut:
    base_data = {
        column.name: getattr(candidate, column.name)
        for column in CandidateDB.__table__.columns
    }
    data = {
        **base_data,
        "full_name": _decode_text(candidate.full_name),
        "phone": _decode_text(candidate.phone),
        "linkedin_url": _decode_text(candidate.linkedin_url),
        "city": _decode_text(candidate.city),
        "state": _decode_text(candidate.state),
        "school": _decode_text(candidate.school),
        "degree": _decode_text(candidate.degree),
        "terminal_degree_year": _decode_text(candidate.terminal_degree_year),
        "current_job_title": _decode_text(candidate.current_job_title),
        "resume_source_link": _decode_text(candidate.resume_source_link),
        "flag_reasons": _decode_list(candidate.flag_reasons),
        "required_fields_missing": _decode_list(candidate.required_fields_missing),
        "years_experience_overall": int(candidate.years_experience_overall) if candidate.years_experience_overall else None,
        "years_experience_in_field": int(candidate.years_experience_in_field) if candidate.years_experience_in_field else None,
    }
    return CandidateOut(**data)

# def candidate_update_to_db(candidate: CandidateUpdate) -> CandidateDB:
#     data = {
#         **candidate.__dict__,
#         "flag_reasons": ",".join(candidate.flag_reasons) if candidate.flag_reasons else None,
#         "required_fields_missing": ",".join(candidate.required_fields_missing) if candidate.required_fields_missing else None,
#         "years_experience_overall": str(candidate.years_experience_overall) if candidate.years_experience_overall else None,
#         "years_experience_in_field": str(candidate.years_experience_in_field) if candidate.years_experience_in_field else None,
#     }
#     return CandidateDB(**data)

