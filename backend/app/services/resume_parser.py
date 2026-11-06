"""Rule-based, deterministic resume text parser.
Uses PyMuPDF (fitz) for PDF extraction and python-docx for DOCX extraction.
Uses regex, section detection heuristics, and a controlled skill taxonomy.
ZERO LLM calls or external AI API calls.
"""
from __future__ import annotations

import io
import re
from typing import Any

import docx
import fitz

from app.config import settings


class ParseError(RuntimeError):
    pass


# ---------------------------------------------------------------- Skill Taxonomy
SKILL_TAXONOMY: dict[str, list[str]] = {
    "Programming": [
        "Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#", "Go", "Rust", "PHP",
        "Ruby", "Kotlin", "Swift", "Scala", "R", "MATLAB", "SQL", "HTML", "CSS", "Shell", "Bash", "PowerShell"
    ],
    "Frontend": [
        "HTML", "CSS", "React", "Next.js", "Angular", "Vue.js", "Svelte", "Tailwind CSS",
        "Bootstrap", "Redux", "Sass", "Less", "Webpack", "Vite", "jQuery"
    ],
    "Backend": [
        "Node.js", "Express.js", "FastAPI", "Django", "Flask", "Spring Boot", "Ruby on Rails",
        "ASP.NET", "NestJS", "GraphQL", "REST API", "gRPC", "Microservices"
    ],
    "Database": [
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "Cassandra", "DynamoDB",
        "MariaDB", "Elasticsearch", "Neo4j", "Oracle", "Firebase"
    ],
    "Cloud/DevOps": [
        "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Jenkins", "GitHub Actions",
        "Terraform", "Ansible", "CI/CD", "Nginx", "Linux"
    ],
    "AI/ML": [
        "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "TensorFlow",
        "PyTorch", "Scikit-learn", "Pandas", "NumPy", "Keras", "OpenCV", "Hugging Face", "LLMs"
    ],
    "Tools": [
        "Git", "GitHub", "GitLab", "Postman", "Jira", "Figma", "Bitbucket", "VS Code"
    ]
}

# Alias mapping -> Canonical Skill Name
SKILL_ALIASES: dict[str, str] = {
    # Postgres
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    # React
    "react": "React",
    "reactjs": "React",
    "react.js": "React",
    # Node
    "node": "Node.js",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    # TypeScript
    "typescript": "TypeScript",
    "ts": "TypeScript",
    # JavaScript
    "javascript": "JavaScript",
    "js": "JavaScript",
    # Mongo
    "mongo": "MongoDB",
    "mongodb": "MongoDB",
    # Scikit Learn
    "scikit learn": "Scikit-learn",
    "scikitlearn": "Scikit-learn",
    "sklearn": "Scikit-learn",
    "scikit-learn": "Scikit-learn",
    # Next.js
    "nextjs": "Next.js",
    "next.js": "Next.js",
    # Express.js
    "express": "Express.js",
    "expressjs": "Express.js",
    "express.js": "Express.js",
    # Vue.js
    "vue": "Vue.js",
    "vuejs": "Vue.js",
    "vue.js": "Vue.js",
    # Spring Boot
    "spring": "Spring Boot",
    "springboot": "Spring Boot",
    "spring boot": "Spring Boot",
    # Go
    "golang": "Go",
    "go": "Go",
    # C++
    "cpp": "C++",
    "c++": "C++",
    "c/c++": "C++",
    # C#
    "c#": "C#",
    "c sharp": "C#",
    # Kubernetes
    "k8s": "Kubernetes",
    "kubernetes": "Kubernetes",
    # AWS
    "aws": "AWS",
    "aws cloud": "AWS",
    # GCP
    "gcp": "GCP",
    "google cloud": "GCP",
    # Azure
    "azure": "Azure",
    # Tailwind
    "tailwind": "Tailwind CSS",
    "tailwind css": "Tailwind CSS",
    "tailwindcss": "Tailwind CSS",
    # Frameworks & Libraries
    "fastapi": "FastAPI",
    "django": "Django",
    "flask": "Flask",
    "python": "Python",
    "java": "Java",
    "html": "HTML",
    "css": "CSS",
    "docker": "Docker",
    "git": "Git",
    "github": "GitHub",
    "gitlab": "GitLab",
    "machine learning": "Machine Learning",
    "deep learning": "Deep Learning",
    "nlp": "NLP",
    "computer vision": "Computer Vision",
    "tensorflow": "TensorFlow",
    "pytorch": "PyTorch",
    "pandas": "Pandas",
    "numpy": "NumPy",
    "postman": "Postman",
    "jira": "Jira",
    "figma": "Figma",
    "graphql": "GraphQL",
    "rest": "REST API",
    "rest api": "REST API",
    "microservices": "Microservices",
    "redis": "Redis",
    "sqlite": "SQLite",
    "mysql": "MySQL",
    "jenkins": "Jenkins",
    "github actions": "GitHub Actions",
    "terraform": "Terraform",
    "ansible": "Ansible",
    "ci/cd": "CI/CD",
    "cicd": "CI/CD",
    "linux": "Linux",
    "c": "C",
    "rust": "Rust",
    "php": "PHP",
    "ruby": "Ruby",
    "kotlin": "Kotlin",
    "swift": "Swift",
    "scala": "Scala",
    "r": "R",
    "matlab": "MATLAB",
}


# ---------------------------------------------------------------- 1. File Extraction
def _extract_pdf_lines(data: bytes) -> list[str]:
    """Extract page text using PyMuPDF (fitz), ignoring empty pages."""
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ParseError(f"Could not open PDF file: {exc}") from exc

    if len(doc) == 0:
        raise ParseError("PDF document contains no pages")

    lines: list[str] = []
    has_text = False
    for page in doc:
        page_text = page.get_text("text") or ""
        if not page_text.strip():
            continue
        has_text = True
        for line in page_text.splitlines():
            line_str = line.strip()
            if line_str:
                lines.append(line_str)
    doc.close()

    if not has_text or not lines:
        raise ParseError("PDF document has no extractable text")
    return lines


def _extract_docx_lines(data: bytes) -> list[str]:
    """Extract paragraph and table text using python-docx, preserving ordering."""
    try:
        doc = docx.Document(io.BytesIO(data))
    except Exception as exc:
        raise ParseError(f"Could not open DOCX file: {exc}") from exc

    lines: list[str] = []
    # Extract paragraphs
    for p in doc.paragraphs:
        p_text = (p.text or "").strip()
        if p_text:
            lines.append(p_text)

    # Extract tables
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                lines.append(row_text)

    if not lines:
        raise ParseError("DOCX document has no extractable text")
    return lines


def _extract_plain_text_lines(data: bytes) -> list[str]:
    try:
        text = data.decode("utf-8", errors="replace")
    except Exception as exc:
        raise ParseError(f"Could not decode text file: {exc}") from exc
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        raise ParseError("Text document has no extractable text")
    return lines


# ---------------------------------------------------------------- 2. Text Normalization
def normalize_text(text: str) -> str:
    """Normalizes whitespace, Unicode quotes/dashes/bullets while preserving line structure."""
    if not text:
        return ""
    # Unicode spaces & characters
    text = text.replace("\u00a0", " ").replace("\u200b", "").replace("\ufeff", "")
    # Smart quotes
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    # Dashes
    text = text.replace("–", "-").replace("—", "-")
    # Bullet point symbols at start of lines
    bullet_pattern = r"^[•▪\*·o\-\u25cf\u25ba\u25a0\uf0b7\u2022]\s*"

    normalized_lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            normalized_lines.append("")
            continue
        line = re.sub(bullet_pattern, "", line).strip()
        line = re.sub(r"[ \t]+", " ", line)
        normalized_lines.append(line)

    result = "\n".join(normalized_lines)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


def extract_text(data: bytes, mime_type: str | None = None) -> str:
    """Primary file extraction entry point.
    Determines mime type / magic bytes, uses PyMuPDF for PDF and python-docx for DOCX,
    returns normalized plain text representation.
    """
    if not data:
        raise ParseError("Uploaded file is empty")

    mime = (mime_type or "").lower().split(";")[0].strip()
    if mime in {"application/octet-stream", ""}:
        if data.startswith(b"%PDF-"):
            mime = "application/pdf"
        elif data.startswith(b"PK\x03\x04"):
            mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            mime = "text/plain"

    if mime == "application/pdf" or data.startswith(b"%PDF-"):
        lines = _extract_pdf_lines(data)
    elif mime in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/docx",
        "application/msword",
    } or data.startswith(b"PK\x03\x04"):
        lines = _extract_docx_lines(data)
    elif mime.startswith("text/") or mime in {"text/plain", "text/markdown"}:
        lines = _extract_plain_text_lines(data)
    else:
        # Fallback attempt text decode
        lines = _extract_plain_text_lines(data)

    raw_text = "\n".join(lines)
    clean_text = normalize_text(raw_text)
    if not clean_text:
        raise ParseError("No readable text found in the document")
    return clean_text[:200_000]


# ---------------------------------------------------------------- 3. Section Parser
SECTION_HEADERS: dict[str, list[str]] = {
    "summary": [
        "summary", "professional summary", "executive summary", "profile",
        "personal profile", "career objective", "objective", "about me", "overview"
    ],
    "skills_text": [
        "skills", "technical skills", "skills & expertise", "skills and expertise",
        "core competencies", "technical stack", "technologies", "technical proficiencies",
        "areas of expertise", "programming skills", "skills & technologies"
    ],
    "experience_text": [
        "experience", "work experience", "professional experience", "employment history",
        "work history", "experience & history", "career history", "relevant experience"
    ],
    "education_text": [
        "education", "academic qualifications", "academic background", "education & training",
        "qualifications", "academic profile", "education and certifications"
    ],
    "projects_text": [
        "projects", "personal projects", "key projects", "academic projects",
        "portfolio", "technical projects"
    ],
    "certifications_text": [
        "certifications", "certificates", "licenses & certifications",
        "certifications & courses", "courses & certifications", "training & certifications"
    ],
    "achievements_text": [
        "achievements", "honors & awards", "awards", "honors and awards", "accomplishments"
    ],
    "languages_text": [
        "languages", "spoken languages", "languages known"
    ],
    "interests_text": [
        "interests", "hobbies", "interests & hobbies", "extracurricular activities"
    ],
    "volunteer_text": [
        "volunteer experience", "volunteer work", "community service"
    ],
}


def parse_sections(text: str) -> dict[str, str]:
    """Splits text into sections based on recognized headings."""
    lines = text.splitlines()
    sections: dict[str, list[str]] = {
        "header": [],
        "summary": [],
        "skills_text": [],
        "experience_text": [],
        "education_text": [],
        "projects_text": [],
        "certifications_text": [],
        "achievements_text": [],
        "languages_text": [],
        "interests_text": [],
        "volunteer_text": [],
    }

    current_section = "header"

    for line in lines:
        cleaned_line = line.strip()
        if not cleaned_line:
            continue

        # Check if line matches a section header
        header_candidate = re.sub(r"^[\#\*\d\.\-\:\s]+", "", cleaned_line).strip().lower()
        header_candidate = re.sub(r"[:\*\#]+$", "", header_candidate).strip()

        matched_section: str | None = None
        if len(header_candidate) <= 45:
            for sec_key, keywords in SECTION_HEADERS.items():
                if header_candidate in keywords:
                    matched_section = sec_key
                    break

        if matched_section:
            current_section = matched_section
        else:
            sections[current_section].append(cleaned_line)

    return {k: "\n".join(v).strip() for k, v in sections.items()}


# ---------------------------------------------------------------- 4. Contact Extraction
def extract_contact(text: str) -> dict[str, str | None]:
    """Extracts email, phone, LinkedIn, GitHub, website, and name using deterministic rules."""
    # Email
    email_match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
    email = email_match.group(0) if email_match else None

    # Phone: international or domestic formats
    phone_match = re.search(
        r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,14}", text
    )
    phone = phone_match.group(0).strip() if phone_match else None

    # LinkedIn
    linkedin_match = re.search(
        r"(?:https?://)?(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+/?", text, re.IGNORECASE
    )
    linkedin = linkedin_match.group(0) if linkedin_match else None

    # GitHub
    github_match = re.search(
        r"(?:https?://)?(?:www\.)?github\.com/[a-zA-Z0-9_-]+/?", text, re.IGNORECASE
    )
    github = github_match.group(0) if github_match else None

    # Portfolio / Personal Website
    website_match = re.search(
        r"https?://(?!www\.linkedin\.com|linkedin\.com|github\.com|www\.github\.com)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?",
        text,
        re.IGNORECASE,
    )
    website = website_match.group(0) if website_match else None

    # Candidate Name heuristic
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    name: str | None = None
    head_keywords = {
        "curriculum", "vitae", "resume", "cv", "summary", "profile",
        "contact", "email", "phone", "skills", "experience", "education"
    }

    for line in lines[:10]:
        # Skip if contains email, phone, or URL
        if "@" in line or "http" in line or "linkedin" in line.lower() or "github" in line.lower():
            continue
        if re.search(r"\d", line):  # Skip lines with digits
            continue
        words = line.split()
        if not (2 <= len(words) <= 4):
            continue
        # Check if line contains heading keywords
        if any(w.lower() in head_keywords for w in words):
            continue
        # Check if characters are only letters, spaces, dots, hyphens
        if re.match(r"^[A-Za-z\.\-\s]+$", line):
            # Check capitalization (Title Case or ALL CAPS)
            if line.isupper() or all(w[0].isupper() for w in words if w):
                name = line.strip()
                break

    return {
        "name": name,
        "email": email,
        "phone": phone,
        "linkedin": linkedin,
        "github": github,
        "website": website,
    }


# ---------------------------------------------------------------- 5 & 6. Skill Extraction
def extract_skills(text: str, skills_text: str = "") -> list[str]:
    """Extracts skills matching the centralized skill taxonomy and alias dictionary."""
    combined_text = (skills_text + "\n" + text).strip()
    if not combined_text:
        return []

    found_skills: set[str] = set()

    for alias_key, canonical in SKILL_ALIASES.items():
        pattern = re.escape(alias_key)

        # Handle skills like C++, C#, Node.js appropriately
        if alias_key in {"c++", "cpp", "c/c++"}:
            regex = r"(?i)(?:^|[\s,;:()/\\-])C\+\+(?:$|[\s,;:()/\\-])"
        elif alias_key in {"c#", "c sharp"}:
            regex = r"(?i)(?:^|[\s,;:()/\\-])C#(?:$|[\s,;:()/\\-])"
        elif alias_key in {"c"}:
            regex = r"(?i)(?:^|[\s,;:()/\\-])C(?:$|[\s,;:()/\\-])"
        elif alias_key in {"r"}:
            regex = r"(?i)(?:^|[\s,;:()/\\-])R(?:$|[\s,;:()/\\-])"
        elif alias_key in {"go"}:
            regex = r"(?i)\bGo\b"
        elif alias_key in {"ts", "js"}:
            regex = r"(?i)\b" + pattern + r"\b"
        else:
            regex = r"(?i)\b" + pattern.replace(r"\.", r"\.") + r"\b"

        if re.search(regex, combined_text):
            found_skills.add(canonical)

    # Also check direct taxonomy canonical names
    for cat, skill_list in SKILL_TAXONOMY.items():
        for skill in skill_list:
            if skill in found_skills:
                continue
            if skill in {"C++", "C#", "C", "R", "Go"}:
                continue
            p = re.escape(skill)
            if re.search(r"(?i)\b" + p + r"\b", combined_text):
                found_skills.add(skill)

    return sorted(list(found_skills))


def derive_skills(text: str) -> list[str]:
    """Lightweight skill extraction interface preserved for backward compatibility."""
    return extract_skills(text)


# ---------------------------------------------------------------- 7. Education Extraction
DEGREE_PATTERNS = [
    r"B\.?\s*Tech(?:nology)?",
    r"B\.?\s*E\.?",
    r"M\.?\s*Tech(?:nology)?",
    r"M\.?\s*E\.?",
    r"B\.?\s*Sc(?:ience)?",
    r"M\.?\s*Sc(?:ience)?",
    r"BCA",
    r"MCA",
    r"MBA",
    r"Ph\.?\s*D",
    r"Doctorate",
    r"Bachelor of Technology",
    r"Master of Technology",
    r"Bachelor of Science",
    r"Master of Science",
    r"Bachelor of Engineering",
    r"Master of Engineering",
    r"Bachelor of Computer Applications",
    r"Master of Computer Applications",
    r"Bachelor of Business Administration",
    r"Associate Degree",
    r"High School",
]


def extract_education(education_text: str) -> list[dict[str, Any]]:
    """Extracts education entries from education section text."""
    if not education_text.strip():
        return []

    entries: list[dict[str, Any]] = []
    lines = [l.strip() for l in education_text.splitlines() if l.strip()]
    combined_deg_regex = r"(?i)\b(" + "|".join(DEGREE_PATTERNS) + r")\b"

    curr_entry: dict[str, Any] | None = None

    for line in lines:
        deg_match = re.search(combined_deg_regex, line)
        if deg_match:
            if curr_entry:
                entries.append(curr_entry)
            curr_entry = {
                "degree": deg_match.group(0).strip(),
                "institution": None,
                "field": None,
                "start_date": None,
                "end_date": None,
                "gpa": None,
            }
            years = re.findall(r"\b(19\d\d|20\d\d)\b", line)
            if len(years) >= 2:
                curr_entry["start_date"] = years[0]
                curr_entry["end_date"] = years[1]
            elif len(years) == 1:
                curr_entry["end_date"] = years[0]

            gpa_match = re.search(r"(?:CGPA|GPA|Percentage|Marks)[\s:]*([0-9\.]+\s*(?:/\s*[0-9\.]+|%))", line, re.IGNORECASE)
            if gpa_match:
                curr_entry["gpa"] = gpa_match.group(1).strip()
        elif curr_entry:
            if any(w in line.lower() for w in ["university", "college", "institute", "school", "academy"]):
                if not curr_entry["institution"]:
                    curr_entry["institution"] = line
            elif any(w in line.lower() for w in ["computer", "engineering", "science", "information", "technology", "electrical"]):
                if not curr_entry["field"]:
                    curr_entry["field"] = line
            if not curr_entry["start_date"] or not curr_entry["end_date"]:
                years = re.findall(r"\b(19\d\d|20\d\d)\b", line)
                if len(years) >= 2:
                    curr_entry["start_date"] = years[0]
                    curr_entry["end_date"] = years[1]
                elif len(years) == 1 and not curr_entry["end_date"]:
                    curr_entry["end_date"] = years[0]

    if curr_entry:
        entries.append(curr_entry)

    return entries


# ---------------------------------------------------------------- 8. Experience Extraction
DATE_RANGE_REGEX = r"(?i)(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}/\d{4}|\d{4})\s*(?:-|–|—|to)\s*(Present|Current|\d{4}|\d{1,2}/\d{4}|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"

TITLE_KEYWORDS = [
    "developer", "engineer", "architect", "consultant", "intern", "lead", "manager",
    "analyst", "specialist", "administrator", "designer", "associate", "executive"
]


def extract_experience(experience_text: str) -> list[dict[str, Any]]:
    """Extracts work experience entries from experience section text."""
    if not experience_text.strip():
        return []

    lines = [l.strip() for l in experience_text.splitlines() if l.strip()]
    entries: list[dict[str, Any]] = []

    curr_entry: dict[str, Any] | None = None
    desc_lines: list[str] = []

    for line in lines:
        date_match = re.search(DATE_RANGE_REGEX, line)
        title_match = any(kw in line.lower() for kw in TITLE_KEYWORDS)

        if date_match or title_match:
            if curr_entry:
                curr_entry["description"] = "\n".join(desc_lines).strip() or None
                entries.append(curr_entry)
                desc_lines = []

            curr_entry = {
                "company": None,
                "title": line if title_match else None,
                "start_date": None,
                "end_date": None,
                "description": None,
            }

            if date_match:
                parts = re.split(r"(?:-|–|—|to)", date_match.group(0), flags=re.IGNORECASE)
                if len(parts) >= 2:
                    curr_entry["start_date"] = parts[0].strip()
                    curr_entry["end_date"] = parts[1].strip()

            if " at " in line:
                company_part = line.split(" at ", 1)[1].strip()
                curr_entry["company"] = company_part
        elif curr_entry:
            if not curr_entry["company"] and not any(kw in line.lower() for kw in TITLE_KEYWORDS):
                if len(line) < 50 and not line.startswith("-") and not line.startswith("•"):
                    curr_entry["company"] = line
                else:
                    desc_lines.append(line)
            else:
                desc_lines.append(line)

    if curr_entry:
        curr_entry["description"] = "\n".join(desc_lines).strip() or None
        entries.append(curr_entry)

    return entries


# ---------------------------------------------------------------- 9. Projects Extraction
def extract_projects(projects_text: str) -> list[dict[str, Any]]:
    """Extracts project entries and project technologies."""
    if not projects_text.strip():
        return []

    lines = [l.strip() for l in projects_text.splitlines() if l.strip()]
    projects: list[dict[str, Any]] = []

    curr_proj: dict[str, Any] | None = None
    desc_lines: list[str] = []

    for line in lines:
        if len(line) <= 60 and not line.startswith("-") and not line.startswith("•") and not line.lower().startswith("tech"):
            if curr_proj:
                full_desc = "\n".join(desc_lines).strip()
                curr_proj["description"] = full_desc or None
                curr_proj["technologies"] = extract_skills(full_desc + " " + line)
                projects.append(curr_proj)
                desc_lines = []

            curr_proj = {
                "name": line,
                "description": None,
                "technologies": [],
            }
        elif curr_proj:
            desc_lines.append(line)

    if curr_proj:
        full_desc = "\n".join(desc_lines).strip()
        curr_proj["description"] = full_desc or None
        curr_proj["technologies"] = extract_skills(full_desc)
        projects.append(curr_proj)

    return projects


# ---------------------------------------------------------------- 10. Certifications
def extract_certifications(certifications_text: str) -> list[dict[str, Any]]:
    """Extracts certification entries without inferring from skills."""
    if not certifications_text.strip():
        return []

    lines = [l.strip() for l in certifications_text.splitlines() if l.strip()]
    certs: list[dict[str, Any]] = []

    known_issuers = ["aws", "amazon", "google", "microsoft", "coursera", "udemy", "oracle", "cisco", "hashicorp"]

    for line in lines:
        issuer: str | None = None
        for ik in known_issuers:
            if ik in line.lower():
                issuer = ik.upper() if ik != "amazon" else "AWS"
                break

        date_match = re.search(r"\b(19\d\d|20\d\d)\b", line)
        date = date_match.group(0) if date_match else None

        certs.append({
            "name": line,
            "issuer": issuer,
            "date": date,
        })

    return certs


# ---------------------------------------------------------------- 11. Final Structured Result
def parse_resume_text(text: str) -> dict[str, Any]:
    """Parses full resume text into a normalized structured Resume object."""
    sections = parse_sections(text)
    contact = extract_contact(text)
    skills = extract_skills(text, sections.get("skills_text", ""))
    education = extract_education(sections.get("education_text", ""))
    experience = extract_experience(sections.get("experience_text", ""))
    projects = extract_projects(sections.get("projects_text", ""))
    certifications = extract_certifications(sections.get("certifications_text", ""))

    return {
        "name": contact.get("name"),
        "email": contact.get("email"),
        "phone": contact.get("phone"),
        "linkedin": contact.get("linkedin"),
        "github": contact.get("github"),
        "website": contact.get("website"),
        "summary": sections.get("summary") or None,
        "skills": skills,
        "experience": experience,
        "education": education,
        "projects": projects,
        "certifications": certifications,
        "languages": [l for l in sections.get("languages_text", "").splitlines() if l.strip()],
    }


def parse_resume(data: bytes, mime_type: str | None = None) -> dict[str, Any]:
    """Full end-to-end resume parser: file extraction -> normalization -> sectioning -> structured JSON."""
    text = extract_text(data, mime_type)
    return parse_resume_text(text)


def max_upload_bytes() -> int:
    return settings.MAX_UPLOAD_BYTES
