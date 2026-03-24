from sqlite3 import IntegrityError
from typing import Any, Dict, Optional
from fastapi import HTTPException
from fastapi.datastructures import UploadFile
from sqlalchemy.orm import Session
from models import CandidateDB, ResumeDB
from utils.helpers import (
    compute_text_quality,
    detect_file_type,
    compute_sha256_bytes,
    extract_text_docx,
    extract_text_pdf,
    extract_text_txt,
    get_docx_page_count_estimate,
    get_pdf_page_count,
    normalize_email,
    normalize_resume_text_for_hash,
    normalize_str,
    safe_json,
    to_db_text,
)
from utils.list_files import print_directory_tree
from datetime import datetime
from processing.markdown import to_markdown
from processing.llm import ALL_FIELDS, try_openai_llm_extract
from processing.quality import compute_flags, normalize_fields
from processing.heuristics import (
    EMAIL_RE,
    guess_email,
    guess_phone,
    guess_linkedin,
    guess_github,
    guess_portfolio,
    guess_city_state,
    guess_full_name,
    guess_degree_and_school,
    guess_terminal_degree_year,
    guess_current_job_title_and_company,
    derive_career_level_signals,
)
from response_types import UploadResponse
from constants import UPLOADS_DIR
from utils.conversions import candidate_db_to_out


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
        existing_candidate = (
            db.get(CandidateDB, existing_resume.candidate_id)
            if existing_resume.candidate_id
            else None
        )
        if not existing_candidate:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Duplicate resume detected, but linked candidate record was not found.",
                    "resume_id": existing_resume.id,
                },
            )
        return UploadResponse(
            candidate=candidate_db_to_out(existing_candidate),
            resume=existing_resume,
            duplicate=True,
            duplicate_type="exact",
        )

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    safe_name = file.filename.replace("/", "_").replace("\\", "_")
    saved_path = (UPLOADS_DIR / f"{ts}__{safe_name}").resolve()
    print(f"Saved path: {saved_path}")
    with saved_path.open("wb") as out:
        out.write(file_bytes)
    print_directory_tree(UPLOADS_DIR)
    # print_directory_tree(Path(__file__).resolve().parent)
    print(f"File type: {file_type}")

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
        normalized_text_sha256 = compute_sha256_bytes(
            normalized_for_hash.encode("utf-8")
        )

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
            existing_candidate = (
                db.get(CandidateDB, existing_text_resume.candidate_id)
                if existing_text_resume.candidate_id
                else None
            )
            if not existing_candidate:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "Duplicate resume content detected, but linked candidate record was not found.",
                        "resume_id": existing_text_resume.id,
                    },
                )
            return UploadResponse(
                candidate=candidate_db_to_out(existing_candidate),
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
        years_experience_in_field=to_db_text(
            extracted.get("years_experience_in_field")
        ),
        title_seniority_signal=to_db_text(extracted.get("title_seniority_signal")),
        education_stage_signal=to_db_text(extracted.get("education_stage_signal")),
        career_level_overall=to_db_text(extracted.get("career_level_overall")),
        career_level_target_field=to_db_text(
            extracted.get("career_level_target_field")
        ),
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
        required_fields_missing=to_db_text(quality["required_fields_missing"])
        if quality["required_fields_missing"]
        else None,
        extraction_confidence=quality["extraction_confidence"],
        flag_reasons=to_db_text(quality["flag_reasons"])
        if quality["flag_reasons"]
        else None,
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
            existing_candidate = (
                db.get(CandidateDB, existing_resume.candidate_id)
                if existing_resume.candidate_id
                else None
            )
            if existing_candidate:
                return UploadResponse(
                    candidate=candidate_db_to_out(existing_candidate),
                    resume=existing_resume,
                    duplicate=True,
                    duplicate_type=duplicate_type,
                )
        raise HTTPException(status_code=409, detail="Duplicate resume detected")

    db.refresh(candidate)
    db.refresh(resume_row)

    return UploadResponse(
        candidate=candidate_db_to_out(candidate),
        resume=resume_row,
        duplicate=False,
        duplicate_type=None,
    )
