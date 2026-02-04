import { emailTranslations as en } from './en';
import { emailTranslations as pt } from './pt';
import { emailTranslations as de } from './de';
import { emailTranslations as es } from './es';

export const translations = {
  en,
  pt,
  de,
  es,
};

export type SupportedLanguage = keyof typeof translations;

export function getEmailTranslations(language?: string) {
  const lang = (language as SupportedLanguage) || 'pt';
  return translations[lang] || translations.pt;
}

export function interpolateTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}
