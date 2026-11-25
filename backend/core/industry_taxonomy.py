"""
Progeni Atlas — Canonical organization industry taxonomy
========================================================

The product previously stored ``industry`` as an unconstrained free-text
string (for example "Artificial Intelligence / SaaS").  That is impossible to
aggregate, filter, or feed consistently to an LLM.

This module defines the canonical vocabulary used across the platform.  It is
based on the 20 NAICS 2022 sectors published by the U.S. Census Bureau, which
is also the structure LinkedIn uses for its recruiting/talent taxonomy.
Legacy free text is accepted but explicitly marked as ``CUSTOM`` so it can be
migrated later instead of silently polluting canonical analytics.

Public API
----------
- ``INDUSTRY_TAXONOMY_VERSION`` — version string persisted with the value.
- ``INDUSTRY_SECTORS`` — immutable list of canonical sectors.
- ``resolve_industry(value)`` — sector dict or ``None``.
- ``canonicalize_industry(value)`` — storage/API payload fields.
- ``industry_display(value)`` — human-readable label for prompts/reports.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

INDUSTRY_TAXONOMY_VERSION = "NAICS_2022"

# Two-digit sector codes (ranges are kept exactly as published by the Census
# Bureau).  ``aliases`` covers common recruiter language and legacy free-text
# values observed in the product so existing data resolves instead of being
# discarded.
INDUSTRY_SECTORS: List[Dict[str, Any]] = [
    {
        "code": "11",
        "label": "Agriculture, Forestry, Fishing and Hunting",
        "aliases": ["agriculture", "farming", "forestry", "fishing", "agribusiness", "agtech"],
    },
    {
        "code": "21",
        "label": "Mining, Quarrying, and Oil and Gas Extraction",
        "aliases": ["mining", "quarrying", "oil and gas", "oil and gas extraction", "metals mining"],
    },
    {
        "code": "22",
        "label": "Utilities",
        "aliases": ["utilities", "energy", "electric power", "water and sewer", "renewable energy"],
    },
    {
        "code": "23",
        "label": "Construction",
        "aliases": ["construction", "building construction", "civil engineering", "contracting"],
    },
    {
        "code": "31-33",
        "label": "Manufacturing",
        "aliases": [
            "manufacturing", "industrial", "industrial manufacturing", "food manufacturing",
            "automotive", "chemicals manufacturing", "electronics manufacturing", "textiles",
        ],
    },
    {
        "code": "42",
        "label": "Wholesale Trade",
        "aliases": ["wholesale", "wholesale trade", "distribution", "distributors"],
    },
    {
        "code": "44-45",
        "label": "Retail Trade",
        "aliases": [
            "retail", "retail trade", "e-commerce", "ecommerce", "e-commerce retail",
            "consumer retail", "grocery", "online retail",
        ],
    },
    {
        "code": "48-49",
        "label": "Transportation and Warehousing",
        "aliases": [
            "transportation", "logistics", "supply chain", "warehousing", "shipping",
            "airlines", "trucking", "postal services",
        ],
    },
    {
        "code": "51",
        "label": "Information",
        "aliases": [
            "information", "information technology", "it", "software", "software development",
            "saas", "artificial intelligence", "ai", "machine learning", "technology",
            "computer software", "internet", "media production", "publishing", "telecommunications",
            "gaming", "computer games", "data services",
        ],
    },
    {
        "code": "52",
        "label": "Finance and Insurance",
        "aliases": [
            "finance", "financial services", "banking", "fintech", "insurance", "capital markets",
            "payments", "venture capital", "asset management", "credit union",
        ],
    },
    {
        "code": "53",
        "label": "Real Estate and Rental and Leasing",
        "aliases": ["real estate", "property", "leasing", "rental", "commercial real estate", "proptech"],
    },
    {
        "code": "54",
        "label": "Professional, Scientific, and Technical Services",
        "aliases": [
            "professional services", "scientific services", "technical services", "consulting",
            "management consulting", "legal services", "engineering services", "accounting",
            "architecture", "research and development", "r&d", "advertising", "marketing services",
        ],
    },
    {
        "code": "55",
        "label": "Management of Companies and Enterprises",
        "aliases": ["management of companies", "holding company", "corporate headquarters", "enterprise management"],
    },
    {
        "code": "56",
        "label": "Administrative and Support and Waste Management and Remediation Services",
        "aliases": [
            "administrative services", "support services", "waste management", "remediation",
            "staffing", "facilities management", "security services", "cleaning services",
        ],
    },
    {
        "code": "61",
        "label": "Educational Services",
        "aliases": ["education", "educational services", "edtech", "higher education", "schools", "training"],
    },
    {
        "code": "62",
        "label": "Health Care and Social Assistance",
        "aliases": [
            "healthcare", "health care", "healthtech", "hospital", "hospitals", "pharmaceuticals",
            "biotechnology", "biotech", "medical devices", "social assistance", "clinical research",
        ],
    },
    {
        "code": "71",
        "label": "Arts, Entertainment, and Recreation",
        "aliases": [
            "arts", "entertainment", "recreation", "media", "film", "music", "sports",
            "performing arts", "museums",
        ],
    },
    {
        "code": "72",
        "label": "Accommodation and Food Services",
        "aliases": [
            "hospitality", "hotels", "hotel", "restaurants", "restaurant", "food services",
            "food and beverage", "catering", "travel and tourism",
        ],
    },
    {
        "code": "81",
        "label": "Other Services (except Public Administration)",
        "aliases": [
            "other services", "nonprofit", "non-profit", "repair services", "personal services",
            "religious organizations", "membership organizations",
        ],
    },
    {
        "code": "92",
        "label": "Public Administration",
        "aliases": [
            "public administration", "government", "public sector", "federal government",
            "state government", "local government", "defense", "military",
        ],
    },
]

_CUSTOM_CODE = "OTHER"


def _normalize(value: Any) -> str:
    """Lowercase, strip punctuation and collapse whitespace for matching."""
    text = "" if value is None else str(value).strip().lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


_BY_CODE = {str(s["code"]): s for s in INDUSTRY_SECTORS}
_BY_LABEL = {_normalize(s["label"]): s for s in INDUSTRY_SECTORS}
_BY_ALIAS: Dict[str, Dict[str, Any]] = {}
for _sector in INDUSTRY_SECTORS:
    for _alias in _sector["aliases"]:
        _BY_ALIAS.setdefault(_normalize(_alias), _sector)
    # Codes with ranges ("31-33") normalize to "31 33"; index both forms.
    _BY_ALIAS.setdefault(_normalize(_sector["code"]), _sector)


def resolve_industry(value: Any) -> Optional[Dict[str, Any]]:
    """Return the canonical sector for a code, label, alias, or legacy value.

    Matching order is deliberately strict-to-loose: exact code, exact label,
    then aliases.  A free-text value that merely *contains* an alias is not
    resolved, which prevents "Non-technology consultancy" from being silently
    classified as Information.
    """
    text = _normalize(value)
    if not text:
        return None

    # Accept "NAICS 51", "naics code 54", and bare codes including ranges.
    code_match = re.fullmatch(r"(?:naics(?:\s+code)?\s+)?([0-9]{2}(?:\s+[0-9]{2})?)", text)
    if code_match:
        code = code_match.group(1).replace(" ", "-")
        return _BY_CODE.get(code)

    exact = _BY_LABEL.get(text) or _BY_ALIAS.get(text)
    if exact:
        return exact

    # Legacy composite values such as "Artificial Intelligence / SaaS" or
    # "Fintech & Payments" are common in the existing database. Resolve each
    # part; canonicalize only when every recognized part agrees on one sector.
    parts = [part.strip() for part in re.split(r"[/|;]+|,\s*|\s+and\s+", value or "") if part.strip()]
    if len(parts) < 2:
        return None
    resolved = [resolve_industry(part) for part in parts]
    hits = [sector for sector in resolved if sector]
    if hits and len({sector["code"] for sector in hits}) == 1:
        return hits[0]
    return None


def canonicalize_industry(value: Any) -> Dict[str, str]:
    """Map an incoming industry string to canonical storage/API fields.

    The legacy ``industry`` string is preserved (so existing UI/DB contracts
    keep working) but is replaced with the canonical label when the value is
    recognized.  Unrecognized values remain verbatim and are tagged
    ``CUSTOM`` so analytics can exclude or migrate them.
    """
    raw = "" if value is None else str(value).strip()
    sector = resolve_industry(raw)

    if not raw:
        return {
            "industry": "",
            "industryCode": "",
            "industryTaxonomy": "",
            "industryMatched": False,
        }

    if sector:
        return {
            "industry": str(sector["label"]),
            "industryCode": str(sector["code"]),
            "industryTaxonomy": INDUSTRY_TAXONOMY_VERSION,
            "industryMatched": True,
        }

    return {
        "industry": raw,
        "industryCode": _CUSTOM_CODE,
        "industryTaxonomy": "CUSTOM",
        "industryMatched": False,
    }


def industry_display(value: Any) -> str:
    """Stable, human-readable industry label for prompts and reports."""
    sector = resolve_industry(value)
    if sector:
        return f"{sector['label']} (NAICS {sector['code']})"
    return "" if value is None else str(value).strip()


def industry_options() -> List[Dict[str, str]]:
    """Payload for taxonomy pickers in the frontend."""
    return [
        {"code": str(s["code"]), "label": str(s["label"]), "taxonomy": INDUSTRY_TAXONOMY_VERSION}
        for s in INDUSTRY_SECTORS
    ]
