/**
 * Normalizes Brazilian mobile phone numbers by adding the 9th digit if missing.
 * Brazilian mobile numbers should have format: +55DD9NNNNNNNN or 55DD9NNNNNNNN
 *
 * The function detects Brazilian numbers (starting with +55 or 55) and checks if they are
 * mobile numbers (starting with 9 after the area code). If a mobile number has only
 * 8 digits after the area code, it adds the 9th digit (9) at the beginning.
 *
 * The function preserves the original format (with or without + prefix).
 *
 * @param phoneNumber - Phone number in E.164 format (with +) or without + prefix
 * @returns Normalized phone number with 9th digit added if applicable, preserving original format. Returns original number if not a Brazilian mobile number.
 *
 * @example
 * normalizeBrazilianPhoneNumber('+551281234567') // Returns '+5512981234567'
 * normalizeBrazilianPhoneNumber('551281234567') // Returns '5512981234567'
 * normalizeBrazilianPhoneNumber('+5512981234567') // Returns '+5512981234567' (already normalized)
 * normalizeBrazilianPhoneNumber('+551234567890') // Returns '+551234567890' (not a mobile number)
 * normalizeBrazilianPhoneNumber('+1234567890') // Returns '+1234567890' (not Brazilian)
 */
export function normalizeBrazilianPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return phoneNumber;
  }

  // Handle numbers with or without + prefix
  const hasPlusPrefix = phoneNumber.startsWith('+');

  // Check if number starts with 55 (Brazil country code)
  // Handle both +55 and 55 formats
  if (!phoneNumber.startsWith('+55') && !phoneNumber.startsWith('55')) {
    return phoneNumber;
  }

  // Remove the +55 or 55 prefix to work with the remaining digits
  const withoutCountryCode = phoneNumber.startsWith('+55')
    ? phoneNumber.substring(3)
    : phoneNumber.substring(2);

  // Brazilian phone numbers should have:
  // - 2 digits for area code (DDD)
  // - 8 or 9 digits for the phone number
  // Total after 55 should be 10 or 11 digits
  if (withoutCountryCode.length < 10 || withoutCountryCode.length > 11) {
    return phoneNumber;
  }

  // Extract area code (first 2 digits) and the phone number part
  const areaCode = withoutCountryCode.substring(0, 2);
  const phoneNumberPart = withoutCountryCode.substring(2);

  // Check if it's a mobile number (starts with 9) and has only 8 digits
  // Mobile numbers in Brazil start with 9 and should have 9 digits total
  if (phoneNumberPart.length === 8 && phoneNumberPart.startsWith('9')) {
    // This is a mobile number missing the 9th digit
    // Add the 9 at the beginning
    // Preserve the original format (with or without +)
    const prefix = hasPlusPrefix ? '+55' : '55';
    const normalizedNumber = `${prefix}${areaCode}9${phoneNumberPart}`;
    return normalizedNumber;
  }

  // If it already has 9 digits and starts with 9, or it's not a mobile number, return as is
  return phoneNumber;
}

/**
 * Normalizes phone numbers to E.164 format (with + prefix) for use as senderId in sessions.
 * This ensures consistent formatting across WhatsApp messages and Retell calls to prevent duplicate sessions.
 *
 * The function:
 * 1. First applies Brazilian phone number normalization (adds 9th digit if needed)
 * 2. Then ensures the number has a + prefix (E.164 format)
 *
 * @param phoneNumber - Phone number in any format (with or without + prefix)
 * @returns Normalized phone number in E.164 format (with + prefix)
 *
 * @example
 * normalizePhoneNumberForSession('556294372288') // Returns '+556294372288'
 * normalizePhoneNumberForSession('+5562994372288') // Returns '+5562994372288'
 * normalizePhoneNumberForSession('551281234567') // Returns '+5512981234567' (adds 9th digit and +)
 */
export function normalizePhoneNumberForSession(phoneNumber: string): string {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return phoneNumber;
  }

  // First, apply Brazilian phone number normalization (adds 9th digit if needed)
  let normalized = normalizeBrazilianPhoneNumber(phoneNumber);

  // Then, ensure the number has a + prefix (E.164 format)
  // Remove any existing + to avoid duplicates
  const withoutPlus = normalized.startsWith('+') ? normalized.substring(1) : normalized;

  // Add + prefix to ensure E.164 format
  return `+${withoutPlus}`;
}
