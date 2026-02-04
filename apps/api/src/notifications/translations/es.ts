export const notificationTranslations = {
  rechargeSuccess: {
    title: "Recarga exitosa",
    message: (amount: string) => `Su cuenta ha sido recargada con ${amount}.`,
  },
  rechargeFailure: {
    title: "Recarga fallida",
    message: "No se pudo recargar su cuenta. Por favor, verifique su método de pago e intente nuevamente.",
  },
  lowCredits: {
    title: "Saldo de crédito bajo",
    message: (balance: string) => `Su saldo de crédito está bajo (${balance}). Considere recargar para evitar interrupciones del servicio.`,
  },
  freeMinutesLow: {
    title: "Minutos gratuitos agotándose",
    message: (remaining: number) => `Le quedan ${remaining} minutos gratuitos este mes.`,
  },
  freeMinutesEnded: {
    title: "Minutos gratuitos finalizados",
    message: "Sus minutos gratuitos para este mes se han agotado. Las llamadas ahora se cobrarán de su saldo de crédito.",
  },
  subscriptionPastDue: {
    title: "Pago de suscripción vencido",
    message: "El pago de su suscripción está vencido. Por favor, actualice su método de pago para continuar usando nuestros servicios.",
  },
  paymentFailure: {
    title: "Pago fallido",
    message: (amount: string) => `Un pago de ${amount} falló. Por favor, actualice su método de pago.`,
  },
  paymentSuccess: {
    title: "Pago exitoso",
    message: (amount: string) => `Su pago de ${amount} fue procesado exitosamente.`,
  },
  planLimitExceeded: {
    title: "Límite del plan excedido",
    message: (resource: string, additionalMessage?: string) =>
      `Ha alcanzado el límite para ${resource} en su plan actual.${additionalMessage ? ` ${additionalMessage}` : ""}`,
  },
  whatsappDisconnected: {
    title: "Instancia de WhatsApp desconectada",
    message: (phoneNumber: string) =>
      `Su instancia de WhatsApp (${phoneNumber}) ha sido desconectada. Por favor, reconéctela para continuar recibiendo mensajes.`,
  },
  default: {
    title: "Notificación",
    message: "Tiene una nueva notificación.",
  },
};
