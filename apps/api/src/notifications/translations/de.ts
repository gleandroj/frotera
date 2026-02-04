export const notificationTranslations = {
  rechargeSuccess: {
    title: "Aufladung erfolgreich",
    message: (amount: string) => `Ihr Konto wurde mit ${amount} aufgeladen.`,
  },
  rechargeFailure: {
    title: "Aufladung fehlgeschlagen",
    message: "Die Aufladung Ihres Kontos ist fehlgeschlagen. Bitte überprüfen Sie Ihre Zahlungsmethode und versuchen Sie es erneut.",
  },
  lowCredits: {
    title: "Niedriges Guthaben",
    message: (balance: string) => `Ihr Guthabensaldo ist niedrig (${balance}). Erwägen Sie eine Aufladung, um eine Dienstunterbrechung zu vermeiden.`,
  },
  freeMinutesLow: {
    title: "Kostenlose Minuten gehen zur Neige",
    message: (remaining: number) => `Sie haben noch ${remaining} kostenlose Minuten in diesem Monat.`,
  },
  freeMinutesEnded: {
    title: "Kostenlose Minuten beendet",
    message: "Ihre kostenlosen Minuten für diesen Monat sind aufgebraucht. Anrufe werden nun von Ihrem Guthabensaldo abgebucht.",
  },
  subscriptionPastDue: {
    title: "Abonnementzahlung überfällig",
    message: "Ihre Abonnementzahlung ist überfällig. Bitte aktualisieren Sie Ihre Zahlungsmethode, um unsere Dienste weiter nutzen zu können.",
  },
  paymentFailure: {
    title: "Zahlung fehlgeschlagen",
    message: (amount: string) => `Eine Zahlung von ${amount} ist fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode.`,
  },
  paymentSuccess: {
    title: "Zahlung erfolgreich",
    message: (amount: string) => `Ihre Zahlung von ${amount} wurde erfolgreich verarbeitet.`,
  },
  planLimitExceeded: {
    title: "Plangrenze überschritten",
    message: (resource: string, additionalMessage?: string) =>
      `Sie haben das Limit für ${resource} in Ihrem aktuellen Plan erreicht.${additionalMessage ? ` ${additionalMessage}` : ""}`,
  },
  whatsappDisconnected: {
    title: "WhatsApp-Instanz getrennt",
    message: (phoneNumber: string) =>
      `Ihre WhatsApp-Instanz (${phoneNumber}) wurde getrennt. Bitte verbinden Sie sie erneut, um weiterhin Nachrichten zu empfangen.`,
  },
  default: {
    title: "Benachrichtigung",
    message: "Sie haben eine neue Benachrichtigung.",
  },
};
