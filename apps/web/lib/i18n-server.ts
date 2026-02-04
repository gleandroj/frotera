import { createInstance } from 'i18next';
import Backend from 'i18next-fs-backend';
import { cookieName, fallbackLanguage, languages } from '@/i18n/settings';
import { cookies, headers } from 'next/headers';
import path from 'path';
import { existsSync } from 'fs';

type Locale = 'en' | 'pt' | 'de' | 'es';

/**
 * Determine the correct path for translation files
 */
function getTranslationPath(): string {
  const possiblePaths = [
    // Production standalone build path (current directory)
    path.join(process.cwd(), 'i18n/locales/{{lng}}.json'),
    // Alternative production path
    path.join(__dirname, '../i18n/locales/{{lng}}.json'),
    // Direct relative path
    path.join(process.cwd(), './i18n/locales/{{lng}}.json'),
  ];

  // Test paths by checking if en.json exists (cross-platform)
  for (const possiblePath of possiblePaths) {
    // Replace template with 'en' to check if the actual translation file exists
    const testPath = possiblePath.replace('{{lng}}', 'en');
    if (existsSync(testPath)) {
      return possiblePath;
    }
  }

  // Fallback to the first path if none exist (will show error but won't crash)
  console.warn('Translation file (en.json) not found, using fallback path:', possiblePaths[0]);
  return possiblePaths[0];
}

/**
 * Create and initialize a server-side i18next instance
 */
async function createI18nextServerInstance(locale: Locale) {
  const i18nInstance = createInstance();

  await i18nInstance
    .use(Backend)
    .init({
      lng: locale,
      fallbackLng: fallbackLanguage,
      supportedLngs: languages,
      backend: {
        loadPath: getTranslationPath(),
      },
      interpolation: {
        escapeValue: false, // React already escapes
      },
      // Don't load on server unless needed
      initImmediate: false,
    });

  return i18nInstance;
}

/**
 * Detect language from cookies and headers
 */
async function detectServerLocale(): Promise<Locale> {
  try {
    // First, try to get language from cookie
    const cookieStore = await cookies();
    const languageCookie = cookieStore.get(cookieName)?.value;

    // Validate cookie language and fallback to "pt" if not available
    if (languageCookie && languages.includes(languageCookie)) {
      return languageCookie as Locale;
    } else if (languageCookie) {
      // Invalid language in cookie, fallback to "pt"
      console.warn(`Invalid language '${languageCookie}' in cookie, falling back to '${fallbackLanguage}'`);
    }

    // Fallback to Accept-Language header
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language') || '';

    // Simple language detection from Accept-Language header
    if (acceptLanguage.includes('de')) {
      return 'de';
    } else if (acceptLanguage.includes('es')) {
      return 'es';
    } else if (acceptLanguage.includes('en')) {
      return 'en';
    } else if (acceptLanguage.includes('pt')) {
      return 'pt';
    } else {
      return fallbackLanguage as Locale;
    }
  } catch {
    // Fallback if headers/cookies aren't available
    return fallbackLanguage as Locale;
  }
}

/**
 * Get translations for server-side components (metadata, etc.)
 * Replaces the custom getServerTranslation function
 */
export async function getServerTranslation(locale?: Locale) {
  const selectedLocale = locale || (await detectServerLocale());
  const i18n = await createI18nextServerInstance(selectedLocale);

  return {
    t: i18n.t.bind(i18n),
    locale: selectedLocale,
  };
}

/**
 * Get page title with locale support
 * Uses i18next instead of custom implementation
 */
export async function getPageTitle(
  titleKey: string,
  locale?: Locale
): Promise<string> {
  const { t } = await getServerTranslation(locale);
  return t(`pageTitle.${titleKey}`);
}

/**
 * Get page description with locale support
 * Uses i18next instead of custom implementation
 */
export async function getPageDescription(
  descriptionKey: string,
  locale?: Locale
): Promise<string> {
  const { t } = await getServerTranslation(locale);
  return t(descriptionKey);
}
