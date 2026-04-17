import type { Locale } from "date-fns";
import { ptBR } from "date-fns/locale";

const locales: Record<string, Locale> = {
  pt: ptBR,
};

/**
 * Maps i18next language codes to date-fns locales for calendars and formatted dates.
 */
export function dateFnsLocaleFor(language: string | undefined): Locale {
  if (!language) return ptBR;
  const base = language.split("-")[0]?.toLowerCase();
  if (base && locales[base]) return locales[base];
  if (locales[language]) return locales[language];
  return ptBR;
}
