/**
 * Canonical industry options for Progeni Atlas.
 *
 * Keep in sync with `backend/core/industry_taxonomy.py`. The backend remains
 * authoritative: `/api/recruiter/industries` returns the same version/codes at
 * runtime, and this list is the offline fallback for profile forms.
 *
 * Source: NAICS 2022 sectors (U.S. Census Bureau), the same hierarchy used by
 * LinkedIn Recruiter's industry taxonomy.
 */

export interface IndustryOption {
  code: string;
  label: string;
  taxonomy: string;
}

export const INDUSTRY_TAXONOMY_VERSION = 'NAICS_2022';

export const OTHER_INDUSTRY_OPTION: IndustryOption = {
  code: 'OTHER',
  label: 'Other / custom industry',
  taxonomy: 'CUSTOM',
};

export const INDUSTRY_OPTIONS: IndustryOption[] = [
  { code: '11', label: 'Agriculture, Forestry, Fishing and Hunting', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '21', label: 'Mining, Quarrying, and Oil and Gas Extraction', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '22', label: 'Utilities', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '23', label: 'Construction', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '31-33', label: 'Manufacturing', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '42', label: 'Wholesale Trade', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '44-45', label: 'Retail Trade', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '48-49', label: 'Transportation and Warehousing', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '51', label: 'Information', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '52', label: 'Finance and Insurance', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '53', label: 'Real Estate and Rental and Leasing', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '54', label: 'Professional, Scientific, and Technical Services', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '55', label: 'Management of Companies and Enterprises', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '56', label: 'Administrative and Support and Waste Management and Remediation Services', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '61', label: 'Educational Services', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '62', label: 'Health Care and Social Assistance', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '71', label: 'Arts, Entertainment, and Recreation', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '72', label: 'Accommodation and Food Services', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '81', label: 'Other Services (except Public Administration)', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  { code: '92', label: 'Public Administration', taxonomy: INDUSTRY_TAXONOMY_VERSION },
  OTHER_INDUSTRY_OPTION,
];

/** Resolve the option selected in a form from the persisted free-text value. */
export function industryOptionForValue(value: string): IndustryOption {
  const match = INDUSTRY_OPTIONS.find((option) => option.label === value);
  return match ?? OTHER_INDUSTRY_OPTION;
}
