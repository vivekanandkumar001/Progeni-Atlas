"""
Industry taxonomy unit tests.

No DB, no network — pure canonicalization logic.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import industry_taxonomy as tax  # noqa: E402


def test_taxonomy_matches_published_naics_sectors():
    assert len(tax.INDUSTRY_SECTORS) == 20
    codes = [s["code"] for s in tax.INDUSTRY_SECTORS]
    assert codes[0] == "11" and codes[-1] == "92"
    assert "31-33" in codes and "44-45" in codes and "48-49" in codes
    assert tax.INDUSTRY_TAXONOMY_VERSION == "NAICS_2022"


def test_resolve_by_code_label_and_alias():
    assert tax.resolve_industry("51")["label"] == "Information"
    assert tax.resolve_industry("NAICS code 62")["code"] == "62"
    assert tax.resolve_industry("Information")["code"] == "51"
    assert tax.resolve_industry("SaaS")["code"] == "51"
    assert tax.resolve_industry("fintech")["code"] == "52"
    assert tax.resolve_industry("healthcare")["code"] == "62"
    assert tax.resolve_industry("31-33")["label"] == "Manufacturing"
    assert tax.resolve_industry("  Ai  ")["code"] == "51"


def test_resolve_is_strict_about_free_text():
    assert tax.resolve_industry("non-technology consultancy") is None
    assert tax.resolve_industry("") is None
    assert tax.resolve_industry(None) is None


def test_canonicalize_known_values_replaces_label_and_adds_code():
    # Common legacy composite values resolve when all parts agree.
    result = tax.canonicalize_industry("Artificial Intelligence / SaaS")
    assert result["industry"] == "Information"
    assert result["industryCode"] == "51"
    assert result["industryTaxonomy"] == "NAICS_2022"
    assert result["industryMatched"] is True

    result = tax.canonicalize_industry("SaaS")
    assert result["industry"] == "Information"
    assert result["industryCode"] == "51"
    assert result["industryTaxonomy"] == "NAICS_2022"
    assert result["industryMatched"] is True


def test_ambiguous_composite_stays_custom():
    result = tax.canonicalize_industry("Information Technology / Consulting")
    assert result["industry"] == "Information Technology / Consulting"
    assert result["industryCode"] == "OTHER"
    assert result["industryTaxonomy"] == "CUSTOM"
    assert result["industryMatched"] is False


def test_canonicalize_empty_and_unknown():
    assert tax.canonicalize_industry("")["industry"] == ""
    assert tax.canonicalize_industry(None)["industryCode"] == ""
    assert tax.canonicalize_industry("Quantum bio-haptics")["industryCode"] == "OTHER"


def test_display_and_options_contract():
    assert tax.industry_display("51") == "Information (NAICS 51)"
    assert tax.industry_display("Unknown vertical") == "Unknown vertical"
    options = tax.industry_options()
    assert len(options) == 20
    assert options[0]["taxonomy"] == "NAICS_2022"
    assert set(options[0]) == {"code", "label", "taxonomy"}
