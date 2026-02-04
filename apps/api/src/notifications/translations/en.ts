export const notificationTranslations = {
  rechargeSuccess: {
    title: "Recharge Successful",
    message: (amount: string) => `Your account has been recharged with ${amount}.`,
  },
  rechargeFailure: {
    title: "Recharge Failed",
    message: "Failed to recharge your account. Please check your payment method and try again.",
  },
  lowCredits: {
    title: "Low Credit Balance",
    message: (balance: string) => `Your credit balance is low (${balance}). Consider recharging to avoid service interruption.`,
  },
  freeMinutesLow: {
    title: "Free Minutes Running Low",
    message: (remaining: number) => `You have ${remaining} free minutes remaining this month.`,
  },
  freeMinutesEnded: {
    title: "Free Minutes Ended",
    message: "Your free minutes for this month have been exhausted. Calls will now be charged from your credit balance.",
  },
  subscriptionPastDue: {
    title: "Subscription Payment Past Due",
    message: "Your subscription payment is overdue. Please update your payment method to continue using our services.",
  },
  paymentFailure: {
    title: "Payment Failed",
    message: (amount: string) => `A payment of ${amount} failed. Please update your payment method.`,
  },
  paymentSuccess: {
    title: "Payment Successful",
    message: (amount: string) => `Your payment of ${amount} was processed successfully.`,
  },
  planLimitExceeded: {
    title: "Plan Limit Exceeded",
    message: (resource: string, additionalMessage?: string) =>
      `You have reached the limit for ${resource} on your current plan.${additionalMessage ? ` ${additionalMessage}` : ""}`,
  },
  whatsappDisconnected: {
    title: "WhatsApp Instance Disconnected",
    message: (phoneNumber: string) =>
      `Your WhatsApp instance (${phoneNumber}) has been disconnected. Please reconnect to continue receiving messages.`,
  },
  default: {
    title: "Notification",
    message: "You have a new notification.",
  },
};
