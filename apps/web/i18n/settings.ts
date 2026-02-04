export const languages = ["pt"];
export const defaultNamespace = "translation";
export const cookieName = "i18next";

// Use static fallback to avoid SSR issues
export const fallbackLanguage = "pt";

import { getHtmlLang, getLanguageCookie } from "@/lib/language-utils";

// SSR-safe language detection
function getClientLanguage(): string | null {
  if (typeof window === "undefined") {
    return null; // Return null during SSR
  }
  return getLanguageCookie() || getHtmlLang();
}

export function getOptions(
  lng?: string,
  namespace = defaultNamespace
) {
  // Use provided language or detect client-side language, fallback to default
  const detectedLng = lng || getClientLanguage() || fallbackLanguage;

  // Validate language and fallback to "pt" if not available
  const validLng = languages.includes(detectedLng) ? detectedLng : fallbackLanguage;

  return {
    debug: false,
    supportedLngs: languages,
    lng: validLng,
    fallbackNS: defaultNamespace,
    fallbackLng: fallbackLanguage,
    defaultNamespace,
    namespace,
  };
}
