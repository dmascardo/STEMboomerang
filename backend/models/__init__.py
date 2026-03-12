from pydantic import BaseModel
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from datetime import datetime

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
