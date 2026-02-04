import { notificationTranslations as enTranslations } from "./en";
import { notificationTranslations as ptTranslations } from "./pt";
import { notificationTranslations as deTranslations } from "./de";
import { notificationTranslations as esTranslations } from "./es";

export const notificationTranslations = {
  en: enTranslations,
  pt: ptTranslations,
  de: deTranslations,
  es: esTranslations,
};

export function getNotificationTranslation(language: string = "pt") {
  if (language === "pt") return notificationTranslations.pt;
  if (language === "de") return notificationTranslations.de;
  if (language === "es") return notificationTranslations.es;
  return notificationTranslations.en;
}
