export const emailTranslations = {
  verification: {
    subject: 'Verify your email for {{appName}}',
    greeting: 'Hi {{name}},',
    body: 'Thank you for signing up! Please verify your email address by clicking the button below:',
    buttonText: 'Verify Email',
    footer: 'If you didn\'t create an account, you can safely ignore this email.',
    alternativeText: 'If the button above doesn\'t work, you can also copy and paste this link into your browser:',
    regards: 'Best regards,\nThe {{appName}} team'
  },
  accountCreated: {
    subject: 'Your account has been created on {{appName}}',
    greeting: 'Hi {{name}},',
    body: 'Your account has been created by an administrator. You can now access the system using the email address and password that were set.',
    buttonText: 'Access the System',
    footer: 'If you did not expect this account to be created, please contact your organization administrator.',
    regards: 'Best regards,\nThe {{appName}} team'
  },
  passwordReset: {
    subject: 'Reset your password for {{appName}}',
    greeting: 'Hi {{name}},',
    body: 'We received a request to reset your password for your {{appName}} account. If you didn\'t make this request, you can safely ignore this email.',
    instruction: 'To reset your password, click the button below. This link will expire in 1 hour.',
    buttonText: 'Reset Password',
    alternativeText: 'If the button doesn\'t work, you can copy and paste this link into your browser:',
    disclaimer: 'If you didn\'t request this password reset, please ignore this email. Your password will remain unchanged.',
    regards: 'Best regards,\nThe {{appName}} team'
  },
  invitation: {
    subject: 'You\'re invited to join {{organizationName}} on {{appName}}',
    greeting: 'Hi there,',
    body: '{{inviterName}} ({{inviterEmail}}) has invited you to join {{organizationName}} on {{appName}}.',
    instruction: 'Click the button below to accept the invitation:',
    buttonText: 'Accept Invitation',
    footer: 'If you didn\'t expect this invitation, you can safely ignore this email.',
    alternativeText: 'If the button above doesn\'t work, you can also copy and paste this link into your browser:',
    regards: 'Best regards,\nThe {{appName}} team'
  },
  calendarEvent: {
    appointment: {
      subject: 'Appointment Invitation: {{eventTitle}}',
      greeting: 'Hello,',
      body: 'You have been invited to an appointment: {{eventTitle}} by {{organizerName}}.',
      eventDetails: 'Event Details:',
      eventTitle: 'Title',
      eventDescription: 'Description',
      eventTime: 'Date & Time',
      meetingLink: 'Meeting Link',
      appointmentNote: 'Please mark this time in your calendar. You will receive a reminder before the appointment.',
      regards: 'Best regards,\nThe {{appName}} team'
    },
    appointmentReminder: {
      subject: 'Reminder: {{eventTitle}} starts in 10 minutes',
      greeting: 'Hello,',
      body: 'This is a reminder that your appointment: {{eventTitle}} by {{organizerName}} is starting in 10 minutes.',
      eventDetails: 'Event Details:',
      eventTitle: 'Title',
      eventDescription: 'Description',
      eventTime: 'Date & Time',
      meetingLink: 'Meeting Link',
      reminderNote: 'Your appointment is starting soon. Please be ready to join.',
      regards: 'Best regards,\nThe {{appName}} team'
    },
    scheduledCall: {
      subject: 'Scheduled Call: {{eventTitle}}',
      greeting: 'Hello,',
      body: 'A call has been scheduled for you: {{eventTitle}} by {{organizerName}}.',
      eventDetails: 'Call Details:',
      eventTitle: 'Title',
      eventDescription: 'Description',
      eventTime: 'Date & Time',
      agentName: 'AI Agent',
      contactName: 'Contact',
      contactPhone: 'Phone Number',
      meetingLink: 'Meeting Link',
      scheduledCallNote: 'You will receive a call at the scheduled time. Please be available to answer.',
      regards: 'Best regards,\nThe {{appName}} team'
    }
  },
  notifications: {
    rechargeSuccess: {
      subject: 'Recharge Successful - {{appName}}',
      greeting: 'Hello,',
      body: 'Your account has been successfully recharged.',
      amount: 'Recharge Amount',
      balance: 'Current Balance',
      regards: 'Best regards,\nThe {{appName}} team'
    },
    rechargeFailure: {
      subject: 'Recharge Failed - {{appName}}',
      greeting: 'Hello,',
      body: 'We were unable to process your account recharge. Please check your payment method and try again.',
      amount: 'Attempted Amount',
      action: 'Update Payment Method',
      regards: 'Best regards,\nThe {{appName}} team'
    },
    lowCredits: {
      subject: 'Low Credit Balance - {{appName}}',
      greeting: 'Hello,',
      body: 'Your credit balance is running low. Consider recharging to avoid service interruption.',
      balance: 'Current Balance',
      action: 'Recharge Now',
      regards: 'Best regards,\nThe {{appName}} team'
    },
    freeMinutesLow: {
      subject: 'Free Minutes Running Low - {{appName}}',
      greeting: 'Hello,',
      body: 'You are running low on free minutes for this month.',
      remaining: 'Remaining Free Minutes',
      regards: 'Best regards,\nThe {{appName}} team'
    },
    freeMinutesEnded: {
      subject: 'Free Minutes Ended - {{appName}}',
      greeting: 'Hello,',
      body: 'Your free minutes for this month have been exhausted. Calls will now be charged from your credit balance.',
      action: 'Recharge Now',
      regards: 'Best regards,\nThe {{appName}} team'
    },
    subscriptionPastDue: {
      subject: 'Subscription Payment Past Due - {{appName}}',
      greeting: 'Hello,',
      body: 'Your subscription payment is overdue. Please update your payment method to continue using our services without interruption.',
      action: 'Update Payment Method',
      regards: 'Best regards,\nThe {{appName}} team'
    },
    paymentFailure: {
      subject: 'Payment Failed - {{appName}}',
      greeting: 'Hello,',
      body: 'We were unable to process a payment for your account.',
      amount: 'Amount',
      action: 'Update Payment Method',
      regards: 'Best regards,\nThe {{appName}} team'
    },
    paymentSuccess: {
      subject: 'Payment Successful - {{appName}}',
      greeting: 'Hello,',
      body: 'Your payment has been processed successfully.',
      amount: 'Amount Paid',
      regards: 'Best regards,\nThe {{appName}} team'
    },
    whatsappDisconnected: {
      subject: 'WhatsApp Instance Disconnected - {{appName}}',
      greeting: 'Hello,',
      body: 'Your WhatsApp instance has been disconnected and is no longer receiving messages.',
      phoneNumber: 'Phone Number',
      action: 'Reconnect WhatsApp',
      regards: 'Best regards,\nThe {{appName}} team'
    }
  }
};
