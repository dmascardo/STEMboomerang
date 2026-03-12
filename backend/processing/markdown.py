from typing import List

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
