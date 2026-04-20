import { emailTranslations as pt } from './pt';

export function getEmailTranslations(_language?: string) {
  return pt;
}

export function interpolateTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}
