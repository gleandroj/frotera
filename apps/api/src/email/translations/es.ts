export const emailTranslations = {
  verification: {
    subject: 'Verifique su correo electrónico para {{appName}}',
    greeting: 'Hola {{name}},',
    body: '¡Gracias por registrarse! Por favor, verifique su dirección de correo electrónico haciendo clic en el botón a continuación:',
    buttonText: 'Verificar correo electrónico',
    footer: 'Si no creó una cuenta, puede ignorar este correo electrónico de forma segura.',
    alternativeText: 'Si el botón de arriba no funciona, también puede copiar y pegar este enlace en su navegador:',
    regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
  },
  passwordReset: {
    subject: 'Restablecer su contraseña para {{appName}}',
    greeting: 'Hola {{name}},',
    body: 'Hemos recibido una solicitud para restablecer su contraseña de su cuenta {{appName}}. Si no realizó esta solicitud, puede ignorar este correo electrónico de forma segura.',
    instruction: 'Para restablecer su contraseña, haga clic en el botón a continuación. Este enlace expirará en 1 hora.',
    buttonText: 'Restablecer contraseña',
    alternativeText: 'Si el botón no funciona, puede copiar y pegar este enlace en su navegador:',
    disclaimer: 'Si no solicitó este restablecimiento de contraseña, ignore este correo electrónico. Su contraseña permanecerá sin cambios.',
    regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
  },
  invitation: {
    subject: 'Está invitado a unirse a {{organizationName}} en {{appName}}',
    greeting: 'Hola,',
    body: '{{inviterName}} ({{inviterEmail}}) lo ha invitado a unirse a {{organizationName}} en {{appName}}.',
    instruction: 'Haga clic en el botón a continuación para aceptar la invitación:',
    buttonText: 'Aceptar invitación',
    footer: 'Si no esperaba esta invitación, puede ignorar este correo electrónico de forma segura.',
    alternativeText: 'Si el botón de arriba no funciona, también puede copiar y pegar este enlace en su navegador:',
    regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
  },
  calendarEvent: {
    appointment: {
      subject: 'Invitación a cita: {{eventTitle}}',
      greeting: 'Hola,',
      body: 'Ha sido invitado a una cita: {{eventTitle}} por {{organizerName}}.',
      eventDetails: 'Detalles del evento:',
      eventTitle: 'Título',
      eventDescription: 'Descripción',
      eventTime: 'Fecha y hora',
      meetingLink: 'Enlace de la reunión',
      appointmentNote: 'Por favor, marque esta hora en su calendario. Recibirá un recordatorio antes de la cita.',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    },
    appointmentReminder: {
      subject: 'Recordatorio: {{eventTitle}} comienza en 10 minutos',
      greeting: 'Hola,',
      body: 'Este es un recordatorio de que su cita: {{eventTitle}} por {{organizerName}} comienza en 10 minutos.',
      eventDetails: 'Detalles del evento:',
      eventTitle: 'Título',
      eventDescription: 'Descripción',
      eventTime: 'Fecha y hora',
      meetingLink: 'Enlace de la reunión',
      reminderNote: 'Su cita comenzará pronto. Por favor, esté listo para unirse.',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    },
    scheduledCall: {
      subject: 'Llamada programada: {{eventTitle}}',
      greeting: 'Hola,',
      body: 'Se ha programado una llamada para usted: {{eventTitle}} por {{organizerName}}.',
      eventDetails: 'Detalles de la llamada:',
      eventTitle: 'Título',
      eventDescription: 'Descripción',
      eventTime: 'Fecha y hora',
      agentName: 'Agente de IA',
      contactName: 'Contacto',
      contactPhone: 'Número de teléfono',
      meetingLink: 'Enlace de la reunión',
      scheduledCallNote: 'Recibirá una llamada a la hora programada. Por favor, esté disponible para responder.',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    }
  },
  notifications: {
    rechargeSuccess: {
      subject: 'Recarga exitosa - {{appName}}',
      greeting: 'Hola,',
      body: 'Su cuenta ha sido recargada exitosamente.',
      amount: 'Monto de recarga',
      balance: 'Saldo actual',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    },
    rechargeFailure: {
      subject: 'Recarga fallida - {{appName}}',
      greeting: 'Hola,',
      body: 'No pudimos procesar la recarga de su cuenta. Por favor, verifique su método de pago e intente nuevamente.',
      amount: 'Monto intentado',
      action: 'Actualizar método de pago',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    },
    lowCredits: {
      subject: 'Saldo de crédito bajo - {{appName}}',
      greeting: 'Hola,',
      body: 'Su saldo de crédito está bajo. Considere recargar para evitar interrupciones del servicio.',
      balance: 'Saldo actual',
      action: 'Recargar ahora',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    },
    freeMinutesLow: {
      subject: 'Minutos gratuitos agotándose - {{appName}}',
      greeting: 'Hola,',
      body: 'Se están agotando sus minutos gratuitos para este mes.',
      remaining: 'Minutos gratuitos restantes',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    },
    freeMinutesEnded: {
      subject: 'Minutos gratuitos finalizados - {{appName}}',
      greeting: 'Hola,',
      body: 'Sus minutos gratuitos para este mes se han agotado. Las llamadas ahora se cobrarán de su saldo de crédito.',
      action: 'Recargar ahora',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    },
    subscriptionPastDue: {
      subject: 'Pago de suscripción vencido - {{appName}}',
      greeting: 'Hola,',
      body: 'El pago de su suscripción está vencido. Por favor, actualice su método de pago para continuar usando nuestros servicios sin interrupciones.',
      action: 'Actualizar método de pago',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    },
    paymentFailure: {
      subject: 'Pago fallido - {{appName}}',
      greeting: 'Hola,',
      body: 'No pudimos procesar un pago para su cuenta.',
      amount: 'Monto',
      action: 'Actualizar método de pago',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    },
    paymentSuccess: {
      subject: 'Pago exitoso - {{appName}}',
      greeting: 'Hola,',
      body: 'Su pago ha sido procesado exitosamente.',
      amount: 'Monto pagado',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    },
    whatsappDisconnected: {
      subject: 'Instancia de WhatsApp desconectada - {{appName}}',
      greeting: 'Hola,',
      body: 'Su instancia de WhatsApp ha sido desconectada y ya no está recibiendo mensajes.',
      phoneNumber: 'Número de teléfono',
      action: 'Reconectar WhatsApp',
      regards: 'Saludos cordiales,\nEl equipo de {{appName}}'
    }
  }
};
