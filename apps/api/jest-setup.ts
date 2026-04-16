// Jest setup file to handle JSX imports in tests
// This prevents Jest from trying to compile React/JSX templates

jest.mock('./src/email/email.service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendAccountCreatedEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  })),
}));

