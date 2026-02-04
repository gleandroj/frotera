export const notificationTranslations = {
  rechargeSuccess: {
    title: "Recarga Bem-Sucedida",
    message: (amount: string) => `Sua conta foi recarregada com ${amount}.`,
  },
  rechargeFailure: {
    title: "Falha na Recarga",
    message: "Falha ao recarregar sua conta. Por favor, verifique seu método de pagamento e tente novamente.",
  },
  lowCredits: {
    title: "Saldo de Créditos Baixo",
    message: (balance: string) => `Seu saldo de créditos está baixo (${balance}). Considere recarregar para evitar interrupção do serviço.`,
  },
  freeMinutesLow: {
    title: "Minutos Grátis Acabando",
    message: (remaining: number) => `Você tem ${remaining} minutos grátis restantes neste mês.`,
  },
  freeMinutesEnded: {
    title: "Minutos Grátis Esgotados",
    message: "Seus minutos grátis para este mês foram esgotados. As chamadas agora serão cobradas do seu saldo de créditos.",
  },
  subscriptionPastDue: {
    title: "Pagamento da Assinatura Atrasado",
    message: "O pagamento da sua assinatura está atrasado. Por favor, atualize seu método de pagamento para continuar usando nossos serviços.",
  },
  paymentFailure: {
    title: "Pagamento Falhou",
    message: (amount: string) => `Um pagamento de ${amount} falhou. Por favor, atualize seu método de pagamento.`,
  },
  paymentSuccess: {
    title: "Pagamento Bem-Sucedido",
    message: (amount: string) => `Seu pagamento de ${amount} foi processado com sucesso.`,
  },
  planLimitExceeded: {
    title: "Limite do Plano Excedido",
    message: (resource: string, additionalMessage?: string) =>
      `Você atingiu o limite para ${resource} no seu plano atual.${additionalMessage ? ` ${additionalMessage}` : ""}`,
  },
  whatsappDisconnected: {
    title: "Instância WhatsApp Desconectada",
    message: (phoneNumber: string) =>
      `Sua instância do WhatsApp (${phoneNumber}) foi desconectada. Por favor, reconecte para continuar recebendo mensagens.`,
  },
  default: {
    title: "Notificação",
    message: "Você tem uma nova notificação.",
  },
};
