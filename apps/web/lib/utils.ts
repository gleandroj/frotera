import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parsePhoneNumberWithError, type CountryCode } from "libphonenumber-js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Maps language codes to country codes for phone number formatting
 */
const languageToCountry: Record<string, CountryCode> = {
  pt: "BR", // Portuguese -> Brazil
  en: "US", // English -> United States
};

/**
 * Formats a phone number based on language/country preference.
 * Uses libphonenumber-js for proper formatting with country-specific formats.
 * For BR and US numbers, uses national format for better readability.
 * Falls back to simple "+" prefix if formatting fails.
 *
 * @param phoneNumber - The phone number to format
 * @param fallback - The value to return if phone number is empty
 * @param language - Optional language code (e.g., "pt", "en") to determine country format
 * @returns Formatted phone number with country-specific formatting
 */
export function formatPhoneNumber(
  phoneNumber: string | null | undefined,
  fallback: string = "-",
  language?: string | null
): string {
  if (!phoneNumber || phoneNumber.trim() === "") {
    return fallback;
  }

  let trimmed = phoneNumber.trim();

  // If the number doesn't start with "+" and is long enough to potentially be international,
  // try adding "+" to help with parsing (e.g., "5512991470165" -> "+5512991470165")
  // This helps the library correctly identify country codes
  if (!trimmed.startsWith("+") && trimmed.length >= 10) {
    // Try with "+" prefix first for better country code detection
    const withPlus = `+${trimmed}`;
    try {
      const phoneNumberObj = parsePhoneNumberWithError(withPlus);
      const country = phoneNumberObj.country;

      // Use national format for BR and US for better readability
      if (country === "BR" || country === "US") {
        const countryCallingCode = phoneNumberObj.countryCallingCode;
        const nationalFormat = phoneNumberObj.formatNational();
        return `+${countryCallingCode} ${nationalFormat}`;
      }

      return phoneNumberObj.formatInternational();
    } catch {
      // If that fails, continue with original number
    }
  }

  try {
    // First, try to parse without country code to auto-detect the country
    // This is important because numbers like "5512991470165" should be detected as Brazil (55), not US
    try {
      const phoneNumberObj = parsePhoneNumberWithError(trimmed);
      const country = phoneNumberObj.country;

      // Use national format for BR and US for better readability
      // BR: +55 (12) 99147-0165 or +55 (12) 3456-7890
      // US: +1 (234) 567-8900
      if (country === "BR" || country === "US") {
        const countryCallingCode = phoneNumberObj.countryCallingCode;
        const nationalFormat = phoneNumberObj.formatNational();
        return `+${countryCallingCode} ${nationalFormat}`;
      }

      // For other countries, use international format
      return phoneNumberObj.formatInternational();
    } catch {
      // If auto-detection fails, try with language-based country code as fallback
      const countryCode: CountryCode | undefined = language && languageToCountry[language]
        ? languageToCountry[language]
        : undefined;

      if (countryCode) {
        try {
          const phoneNumberObj = parsePhoneNumberWithError(trimmed, countryCode);
          const country = phoneNumberObj.country;

          // Use national format for BR and US
          if (country === "BR" || country === "US") {
            const countryCallingCode = phoneNumberObj.countryCallingCode;
            const nationalFormat = phoneNumberObj.formatNational();
            return `+${countryCallingCode} ${nationalFormat}`;
          }

          return phoneNumberObj.formatInternational();
        } catch {
          // If parsing with country code also fails, fall back to simple "+" prefix logic
          if (trimmed.startsWith("+")) {
            return trimmed;
          }
          return `+${trimmed}`;
        }
      } else {
        // No country code available, fall back to simple "+" prefix logic
        if (trimmed.startsWith("+")) {
          return trimmed;
        }
        return `+${trimmed}`;
      }
    }
  } catch {
    // Fallback to simple "+" prefix if anything goes wrong
    if (trimmed.startsWith("+")) {
      return trimmed;
    }
    return `+${trimmed}`;
  }
}
