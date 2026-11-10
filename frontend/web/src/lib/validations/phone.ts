/**
 * Phone number helpers shared by the auth forms.
 *
 * The signup flow defaults to India and stores the 10-digit national number for
 * Indian accounts (matching the legacy API contract), while any other country is
 * stored in E.164 form. Keeping this in one place means the UI, the zod schema
 * and the submit payload can never disagree about what a valid number is.
 */

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 code. */
  iso: string;
  name: string;
  dial: string;
  flag: string;
  /** Exact national-number length when the country uses a fixed-length plan. */
  nationalLength?: number;
  /** Extra rule applied on top of the length check (e.g. Indian mobiles start 6-9). */
  nationalPattern?: RegExp;
  /** Shown as the input placeholder and in the helper text. */
  example: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  {
    iso: 'IN',
    name: 'India',
    dial: '+91',
    flag: '🇮🇳',
    nationalLength: 10,
    nationalPattern: /^[6-9]\d{9}$/,
    example: '98765 43210',
  },
  {
    iso: 'US',
    name: 'United States',
    dial: '+1',
    flag: '🇺🇸',
    nationalLength: 10,
    example: '555 123 4567',
  },
  {
    iso: 'GB',
    name: 'United Kingdom',
    dial: '+44',
    flag: '🇬🇧',
    nationalLength: 10,
    example: '7400 123456',
  },
  {
    iso: 'AE',
    name: 'United Arab Emirates',
    dial: '+971',
    flag: '🇦🇪',
    nationalLength: 9,
    example: '50 123 4567',
  },
  {
    iso: 'SG',
    name: 'Singapore',
    dial: '+65',
    flag: '🇸🇬',
    nationalLength: 8,
    example: '8123 4567',
  },
  {
    iso: 'AU',
    name: 'Australia',
    dial: '+61',
    flag: '🇦🇺',
    nationalLength: 9,
    example: '412 345 678',
  },
  {
    iso: 'CA',
    name: 'Canada',
    dial: '+1',
    flag: '🇨🇦',
    nationalLength: 10,
    example: '555 123 4567',
  },
];

export const DEFAULT_PHONE_COUNTRY = 'IN';

export function getPhoneCountry(iso: string | null | undefined): PhoneCountry {
  return (
    PHONE_COUNTRIES.find((country) => country.iso === iso) ??
    PHONE_COUNTRIES[0]
  );
}

/** Strips spaces, dashes, parentheses and any accidental dial code. */
export function normalizeNationalNumber(value: string): string {
  return (value || '').replace(/\D/g, '');
}

export function isValidPhoneNumber(
  iso: string | null | undefined,
  nationalNumber: string
): boolean {
  const country = getPhoneCountry(iso);
  const digits = normalizeNationalNumber(nationalNumber);

  if (!digits) return false;
  if (country.nationalPattern) return country.nationalPattern.test(digits);
  if (country.nationalLength) return digits.length === country.nationalLength;
  return digits.length >= 6 && digits.length <= 15;
}

export function getPhoneValidationMessage(
  iso: string | null | undefined
): string {
  const country = getPhoneCountry(iso);
  if (country.iso === 'IN') {
    return 'Enter a valid 10-digit Indian mobile number';
  }
  if (country.nationalLength) {
    return `Enter a valid ${country.nationalLength}-digit ${country.name} number`;
  }
  return `Enter a valid ${country.name} phone number`;
}

/**
 * Value sent to the backend. Indian numbers stay 10-digit for backwards
 * compatibility; every other country is prefixed with its dial code.
 */
export function toBackendPhone(
  iso: string | null | undefined,
  nationalNumber: string
): string {
  const country = getPhoneCountry(iso);
  const digits = normalizeNationalNumber(nationalNumber);
  if (!digits) return '';
  return country.iso === 'IN' ? digits : `${country.dial}${digits}`;
}
