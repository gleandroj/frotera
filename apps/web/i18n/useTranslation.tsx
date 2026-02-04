'use client'

import i18next from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import {
  initReactI18next,
  useTranslation as useTranslationLib
} from 'react-i18next'
import { getOptions, languages, fallbackLanguage } from './settings'
import { useEffect, useState } from 'react'

interface TranslationFunction {
  t: (key: string, options?: any) => string
  currentLanguage?: string
}

// Initialize with fallback language to prevent hydration issues
const initializeI18next = () => {
  // Get initial language from HTML lang attribute (set by server)
  const serverLanguage = typeof window !== 'undefined' ?
    document.documentElement.lang || fallbackLanguage :
    fallbackLanguage;

  i18next
    .use(initReactI18next)
    .use(
      resourcesToBackend(
        (language: string, _namespace: string) => {
          return import(`./locales/${language}.json`)
        }
      )
    )
    .init({
      ...getOptions(serverLanguage),
      preload: languages
    })
}

// Initialize i18next only once
if (!i18next.isInitialized) {
  initializeI18next();
}

// we use cookies to store the language preference (works on both client and server)
export function useTranslation(namespace?: any, options?: any) {
  const useTranslationResponse = useTranslationLib(namespace, options)
  const { i18n } = useTranslationResponse
  const currentLanguage = i18n.resolvedLanguage
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasDetectedLanguage, setHasDetectedLanguage] = useState(false);

  // Only run language detection once after hydration to avoid conflicts with manual changes
  useEffect(() => {
    setIsHydrated(true);

    // Only detect language once, not on every language change
    if (typeof window !== 'undefined' && !hasDetectedLanguage) {
      setHasDetectedLanguage(true);

      const htmlLang = document.documentElement.lang;
      const cookies = document.cookie.split(';');
      const languageCookie = cookies.find(cookie =>
        cookie.trim().startsWith('i18next=')
      )?.split('=')[1]?.trim();

      const preferredLanguage = languageCookie || htmlLang;

      // Validate language and fallback to "pt" if not available
      const validLanguage = preferredLanguage && languages.includes(preferredLanguage)
        ? preferredLanguage
        : fallbackLanguage;

      if (validLanguage && validLanguage !== currentLanguage) {
        i18n.changeLanguage(validLanguage);
      }
    }
  }, [i18n, hasDetectedLanguage, currentLanguage]);

  return { ...useTranslationResponse, i18n, currentLanguage, isHydrated } as typeof useTranslationResponse &
    TranslationFunction & { isHydrated: boolean }
}
