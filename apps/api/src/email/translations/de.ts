export const emailTranslations = {
  verification: {
    subject: 'Bestätigen Sie Ihre E-Mail für {{appName}}',
    greeting: 'Hallo {{name}},',
    body: 'Vielen Dank für Ihre Anmeldung! Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf die Schaltfläche unten klicken:',
    buttonText: 'E-Mail bestätigen',
    footer: 'Wenn Sie kein Konto erstellt haben, können Sie diese E-Mail sicher ignorieren.',
    alternativeText: 'Wenn die Schaltfläche oben nicht funktioniert, können Sie diesen Link auch in Ihren Browser kopieren und einfügen:',
    regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
  },
  passwordReset: {
    subject: 'Setzen Sie Ihr Passwort für {{appName}} zurück',
    greeting: 'Hallo {{name}},',
    body: 'Wir haben eine Anfrage erhalten, Ihr Passwort für Ihr {{appName}} Konto zurückzusetzen. Wenn Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail sicher ignorieren.',
    instruction: 'Um Ihr Passwort zurückzusetzen, klicken Sie auf die Schaltfläche unten. Dieser Link läuft in 1 Stunde ab.',
    buttonText: 'Passwort zurücksetzen',
    alternativeText: 'Wenn die Schaltfläche nicht funktioniert, können Sie diesen Link in Ihren Browser kopieren und einfügen:',
    disclaimer: 'Wenn Sie diese Passwort-Zurücksetzung nicht angefordert haben, ignorieren Sie bitte diese E-Mail. Ihr Passwort bleibt unverändert.',
    regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
  },
  invitation: {
    subject: 'Sie sind eingeladen, {{organizationName}} auf {{appName}} beizutreten',
    greeting: 'Hallo,',
    body: '{{inviterName}} ({{inviterEmail}}) hat Sie eingeladen, {{organizationName}} auf {{appName}} beizutreten.',
    instruction: 'Klicken Sie auf die Schaltfläche unten, um die Einladung anzunehmen:',
    buttonText: 'Einladung annehmen',
    footer: 'Wenn Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail sicher ignorieren.',
    alternativeText: 'Wenn die Schaltfläche oben nicht funktioniert, können Sie diesen Link auch in Ihren Browser kopieren und einfügen:',
    regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
  },
  calendarEvent: {
    appointment: {
      subject: 'Termineinladung: {{eventTitle}}',
      greeting: 'Hallo,',
      body: 'Sie wurden zu einem Termin eingeladen: {{eventTitle}} von {{organizerName}}.',
      eventDetails: 'Termindetails:',
      eventTitle: 'Titel',
      eventDescription: 'Beschreibung',
      eventTime: 'Datum & Uhrzeit',
      meetingLink: 'Meeting-Link',
      appointmentNote: 'Bitte markieren Sie diese Zeit in Ihrem Kalender. Sie erhalten eine Erinnerung vor dem Termin.',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    },
    appointmentReminder: {
      subject: 'Erinnerung: {{eventTitle}} beginnt in 10 Minuten',
      greeting: 'Hallo,',
      body: 'Dies ist eine Erinnerung, dass Ihr Termin: {{eventTitle}} von {{organizerName}} in 10 Minuten beginnt.',
      eventDetails: 'Termindetails:',
      eventTitle: 'Titel',
      eventDescription: 'Beschreibung',
      eventTime: 'Datum & Uhrzeit',
      meetingLink: 'Meeting-Link',
      reminderNote: 'Ihr Termin beginnt bald. Bitte seien Sie bereit, teilzunehmen.',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    },
    scheduledCall: {
      subject: 'Geplanter Anruf: {{eventTitle}}',
      greeting: 'Hallo,',
      body: 'Ein Anruf wurde für Sie geplant: {{eventTitle}} von {{organizerName}}.',
      eventDetails: 'Anrufdetails:',
      eventTitle: 'Titel',
      eventDescription: 'Beschreibung',
      eventTime: 'Datum & Uhrzeit',
      agentName: 'KI-Agent',
      contactName: 'Kontakt',
      contactPhone: 'Telefonnummer',
      meetingLink: 'Meeting-Link',
      scheduledCallNote: 'Sie erhalten einen Anruf zur geplanten Zeit. Bitte seien Sie verfügbar, um zu antworten.',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    }
  },
  notifications: {
    rechargeSuccess: {
      subject: 'Aufladung erfolgreich - {{appName}}',
      greeting: 'Hallo,',
      body: 'Ihr Konto wurde erfolgreich aufgeladen.',
      amount: 'Aufladebetrag',
      balance: 'Aktueller Saldo',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    },
    rechargeFailure: {
      subject: 'Aufladung fehlgeschlagen - {{appName}}',
      greeting: 'Hallo,',
      body: 'Wir konnten Ihre Kontenaufladung nicht verarbeiten. Bitte überprüfen Sie Ihre Zahlungsmethode und versuchen Sie es erneut.',
      amount: 'Versuchter Betrag',
      action: 'Zahlungsmethode aktualisieren',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    },
    lowCredits: {
      subject: 'Niedriges Guthaben - {{appName}}',
      greeting: 'Hallo,',
      body: 'Ihr Guthabensaldo ist niedrig. Erwägen Sie eine Aufladung, um eine Dienstunterbrechung zu vermeiden.',
      balance: 'Aktueller Saldo',
      action: 'Jetzt aufladen',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    },
    freeMinutesLow: {
      subject: 'Kostenlose Minuten gehen zur Neige - {{appName}}',
      greeting: 'Hallo,',
      body: 'Ihre kostenlosen Minuten für diesen Monat gehen zur Neige.',
      remaining: 'Verbleibende kostenlose Minuten',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    },
    freeMinutesEnded: {
      subject: 'Kostenlose Minuten beendet - {{appName}}',
      greeting: 'Hallo,',
      body: 'Ihre kostenlosen Minuten für diesen Monat sind aufgebraucht. Anrufe werden nun von Ihrem Guthabensaldo abgebucht.',
      action: 'Jetzt aufladen',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    },
    subscriptionPastDue: {
      subject: 'Abonnementzahlung überfällig - {{appName}}',
      greeting: 'Hallo,',
      body: 'Ihre Abonnementzahlung ist überfällig. Bitte aktualisieren Sie Ihre Zahlungsmethode, um unsere Dienste ohne Unterbrechung weiter nutzen zu können.',
      action: 'Zahlungsmethode aktualisieren',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    },
    paymentFailure: {
      subject: 'Zahlung fehlgeschlagen - {{appName}}',
      greeting: 'Hallo,',
      body: 'Wir konnten eine Zahlung für Ihr Konto nicht verarbeiten.',
      amount: 'Betrag',
      action: 'Zahlungsmethode aktualisieren',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    },
    paymentSuccess: {
      subject: 'Zahlung erfolgreich - {{appName}}',
      greeting: 'Hallo,',
      body: 'Ihre Zahlung wurde erfolgreich verarbeitet.',
      amount: 'Gezahlter Betrag',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    },
    whatsappDisconnected: {
      subject: 'WhatsApp-Instanz getrennt - {{appName}}',
      greeting: 'Hallo,',
      body: 'Ihre WhatsApp-Instanz wurde getrennt und empfängt keine Nachrichten mehr.',
      phoneNumber: 'Telefonnummer',
      action: 'WhatsApp wieder verbinden',
      regards: 'Mit freundlichen Grüßen,\nDas {{appName}} Team'
    }
  }
};
