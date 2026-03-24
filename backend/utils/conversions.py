from models import CandidateDB
from response_types import CandidateOut, CandidateUpdate


def candidate_db_to_out(candidate: type[CandidateDB]) -> CandidateOut:
    data: type[CandidateOut] = {
        **candidate.model_dump(),
        "flag_reasons": candidate.flag_reasons.split(",") if candidate.flag_reasons else [],
        "required_fields_missing": candidate.required_fields_missing.split(",") if candidate.required_fields_missing else [],
        "years_experience_overall": int(candidate.years_experience_overall) if candidate.years_experience_overall else None,
        "years_experience_in_field": int(candidate.years_experience_in_field) if candidate.years_experience_in_field else None,
    }    
    return CandidateOut(data)

# def candidate_update_to_db(candidate: CandidateUpdate) -> CandidateDB:
#     data = {
#         **candidate.__dict__,
#         "flag_reasons": ",".join(candidate.flag_reasons) if candidate.flag_reasons else None,
#         "required_fields_missing": ",".join(candidate.required_fields_missing) if candidate.required_fields_missing else None,
#         "years_experience_overall": str(candidate.years_experience_overall) if candidate.years_experience_overall else None,
#         "years_experience_in_field": str(candidate.years_experience_in_field) if candidate.years_experience_in_field else None,
#     }
#     return CandidateDB(**data)

