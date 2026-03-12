import json
import re
from typing import Any, Dict, Optional, Tuple
import os


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
    "full_name",
    "email",
    "phone",
    "linkedin_url",
    "city",
    "state",
    "school",
    "degree",
    "terminal_degree_year",
    "current_job_title",
    "resume_source_link",
    "skills",
    "professional_summary",
    "latest_company",
    "certifications",
    "portfolio_url",
    "github_url",
    "academic_title",
    "research_area",
    "publications_summary",
    "awards_summary",
    "years_experience_overall",
    "years_experience_in_field",
    "title_seniority_signal",
    "education_stage_signal",
    "career_level_overall",
    "career_level_target_field",
    "career_level_confidence",
    "career_level_reason",
]


def try_openai_llm_extract(
    markdown_text: str,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        from openai import OpenAI
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
