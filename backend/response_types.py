from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime



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

    years_experience_overall: Optional[int] = None
    years_experience_in_field: Optional[int] = None
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
    required_fields_missing: List[str] = []
    extraction_confidence: Optional[str] = None
    flag_reasons: List[str] = []
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



class CandidateUpdate(BaseModel):
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

    years_experience_overall: Optional[int] = None
    years_experience_in_field: Optional[int] = None
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

    needs_review: Optional[str] = None
    review_reason: Optional[str] = None

    parsed_char_count: Optional[int] = None
    llm_input_char_count: Optional[int] = None
    fields_found_count: Optional[int] = None
    required_fields_found_count: Optional[int] = None
    required_fields_missing: Optional[List[str]] = None
    extraction_confidence: Optional[str] = None
    flag_reasons: Optional[List[str]] = None
    flag_details: Optional[str] = None

    extracted_fields: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
    
