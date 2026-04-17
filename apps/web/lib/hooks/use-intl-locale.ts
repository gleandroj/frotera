"use client";

import { useMemo } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { i18nLanguageToIntlLocale } from "@/lib/locale-decimal";

/** BCP 47 locale derived from the active i18n language (for Intl.NumberFormat, dates, etc.). */
export function useIntlLocale(): string {
  const { currentLanguage, i18n } = useTranslation();
  return useMemo(
    () => i18nLanguageToIntlLocale(currentLanguage ?? i18n.language),
    [currentLanguage, i18n.language],
  );
}
