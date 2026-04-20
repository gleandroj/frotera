export const emailTranslations = {
  verification: {
    subject: 'Verifique seu e-mail para {{appName}}',
    greeting: 'Olá {{name}},',
    body: 'Obrigado por se cadastrar! Verifique seu endereço de e-mail clicando no botão abaixo:',
    buttonText: 'Verificar E-mail',
    footer: 'Se você não criou uma conta, pode ignorar este e-mail com segurança.',
    alternativeText: 'Se o botão acima não funcionar, você também pode copiar e colar este link em seu navegador:',
    regards: 'Atenciosamente,\nEquipe {{appName}}'
  },
  accountCreated: {
    subject: 'Sua conta foi criada no {{appName}}',
    greeting: 'Olá {{name}},',
    body: 'Sua conta foi criada por um administrador. Você já pode acessar o sistema usando o endereço de e-mail e a senha definidos.',
    buttonText: 'Acessar o Sistema',
    footer: 'Se você não esperava esta criação de conta, entre em contato com o administrador da organização.',
    regards: 'Atenciosamente,\nEquipe {{appName}}'
  },
  welcomeCredentials: {
    subject: 'Bem-vindo ao {{appName}} — suas credenciais de acesso',
    greeting: 'Olá {{name}},',
    body: 'Sua conta foi criada no {{appName}}. Use as credenciais abaixo para fazer seu primeiro acesso:',
    loginLabel: 'E-mail de acesso',
    passwordLabel: 'Senha temporária',
    warning: 'Por segurança, você será solicitado a criar uma nova senha no primeiro login.',
    buttonText: 'Acessar o Sistema',
    footer: 'Se você não esperava esta conta, entre em contato com o administrador da organização.',
    regards: 'Atenciosamente,\nEquipe {{appName}}'
  },
  passwordReset: {
    subject: 'Redefinir sua senha para {{appName}}',
    greeting: 'Olá {{name}},',
    body: 'Recebemos uma solicitação para redefinir sua senha da sua conta {{appName}}. Se você não fez esta solicitação, pode ignorar este e-mail com segurança.',
    instruction: 'Para redefinir sua senha, clique no botão abaixo. Este link expira em 1 hora.',
    buttonText: 'Redefinir Senha',
    alternativeText: 'Se o botão não funcionar, você pode copiar e colar este link no seu navegador:',
    disclaimer: 'Se você não solicitou esta redefinição de senha, ignore este e-mail. Sua senha permanecerá inalterada.',
    regards: 'Atenciosamente,\nEquipe {{appName}}'
  },
  invitation: {
    subject: 'Você foi convidado para participar da {{organizationName}} no {{appName}}',
    greeting: 'Olá,',
    body: '{{inviterName}} ({{inviterEmail}}) convidou você para participar da {{organizationName}} no {{appName}}.',
    instruction: 'Clique no botão abaixo para aceitar o convite:',
    buttonText: 'Aceitar Convite',
    footer: 'Se você não esperava este convite, pode ignorar este e-mail com segurança.',
    alternativeText: 'Se o botão acima não funcionar, você também pode copiar e colar este link em seu navegador:',
    regards: 'Atenciosamente,\nEquipe {{appName}}'
  },
  calendarEvent: {
    appointment: {
      subject: 'Convite para Compromisso: {{eventTitle}}',
      greeting: 'Olá,',
      body: 'Você foi convidado para um compromisso: {{eventTitle}} por {{organizerName}}.',
      eventDetails: 'Detalhes do Evento:',
      eventTitle: 'Título',
      eventDescription: 'Descrição',
      eventTime: 'Data e Hora',
      meetingLink: 'Link da Reunião',
      appointmentNote: 'Por favor, marque este horário em sua agenda. Você receberá um lembrete antes do compromisso.',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    },
    appointmentReminder: {
      subject: 'Lembrete: {{eventTitle}} começa em 10 minutos',
      greeting: 'Olá,',
      body: 'Este é um lembrete de que seu compromisso: {{eventTitle}} por {{organizerName}} começa em 10 minutos.',
      eventDetails: 'Detalhes do Evento:',
      eventTitle: 'Título',
      eventDescription: 'Descrição',
      eventTime: 'Data e Hora',
      meetingLink: 'Link da Reunião',
      reminderNote: 'Seu compromisso está prestes a começar. Por favor, esteja pronto para participar.',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    },
    scheduledCall: {
      subject: 'Chamada Agendada: {{eventTitle}}',
      greeting: 'Olá,',
      body: 'Uma chamada foi agendada para você: {{eventTitle}} por {{organizerName}}.',
      eventDetails: 'Detalhes da Chamada:',
      eventTitle: 'Título',
      eventDescription: 'Descrição',
      eventTime: 'Data e Hora',
      agentName: 'Agente de IA',
      contactName: 'Contato',
      contactPhone: 'Número de Telefone',
      meetingLink: 'Link da Reunião',
      scheduledCallNote: 'Você receberá uma chamada no horário agendado. Por favor, esteja disponível para atender.',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    }
  },
  notifications: {
    rechargeSuccess: {
      subject: 'Recarga Bem-Sucedida - {{appName}}',
      greeting: 'Olá,',
      body: 'Sua conta foi recarregada com sucesso.',
      amount: 'Valor da Recarga',
      balance: 'Saldo Atual',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    },
    rechargeFailure: {
      subject: 'Falha na Recarga - {{appName}}',
      greeting: 'Olá,',
      body: 'Não foi possível processar a recarga da sua conta. Por favor, verifique seu método de pagamento e tente novamente.',
      amount: 'Valor Tentado',
      action: 'Atualizar Método de Pagamento',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    },
    lowCredits: {
      subject: 'Saldo de Créditos Baixo - {{appName}}',
      greeting: 'Olá,',
      body: 'Seu saldo de créditos está baixo. Considere recarregar para evitar interrupção do serviço.',
      balance: 'Saldo Atual',
      action: 'Recarregar Agora',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    },
    freeMinutesLow: {
      subject: 'Minutos Grátis Acabando - {{appName}}',
      greeting: 'Olá,',
      body: 'Você está com poucos minutos grátis restantes neste mês.',
      remaining: 'Minutos Grátis Restantes',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    },
    freeMinutesEnded: {
      subject: 'Minutos Grátis Esgotados - {{appName}}',
      greeting: 'Olá,',
      body: 'Seus minutos grátis para este mês foram esgotados. As chamadas agora serão cobradas do seu saldo de créditos.',
      action: 'Recarregar Agora',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    },
    subscriptionPastDue: {
      subject: 'Pagamento da Assinatura Atrasado - {{appName}}',
      greeting: 'Olá,',
      body: 'O pagamento da sua assinatura está atrasado. Por favor, atualize seu método de pagamento para continuar usando nossos serviços sem interrupção.',
      action: 'Atualizar Método de Pagamento',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    },
    paymentFailure: {
      subject: 'Pagamento Falhou - {{appName}}',
      greeting: 'Olá,',
      body: 'Não foi possível processar um pagamento da sua conta.',
      amount: 'Valor',
      action: 'Atualizar Método de Pagamento',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    },
    paymentSuccess: {
      subject: 'Pagamento Bem-Sucedido - {{appName}}',
      greeting: 'Olá,',
      body: 'Seu pagamento foi processado com sucesso.',
      amount: 'Valor Pago',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    },
    whatsappDisconnected: {
      subject: 'Instância WhatsApp Desconectada - {{appName}}',
      greeting: 'Olá,',
      body: 'Sua instância do WhatsApp foi desconectada e não está mais recebendo mensagens.',
      phoneNumber: 'Número de Telefone',
      action: 'Reconectar WhatsApp',
      regards: 'Atenciosamente,\nEquipe {{appName}}'
    }
  }
};
