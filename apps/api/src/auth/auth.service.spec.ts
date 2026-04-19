jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));
jest.mock('otplib', () => ({
  authenticator: {
    verify: jest.fn(),
    generateSecret: jest.fn().mockReturnValue('MOCKED_SECRET'),
    keyuri: jest.fn().mockReturnValue('otpauth://totp/test'),
  },
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mock'),
}));

import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { AuthService } from './auth.service';

const mockPrisma: any = {
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
};
const mockJwt: any = {
  sign: jest.fn().mockReturnValue('access_token'),
  verify: jest.fn(),
};
const mockConfig: any = {
  get: jest.fn((k: string) => ({ JWT_SECRET: 's', JWT_REFRESH_SECRET: 'r', FRONTEND_URL: 'http://localhost:3000', APP_NAME: 'App' }[k])),
};
const mockToken: any = {
  generateVerificationToken: jest.fn().mockReturnValue('vtok'),
  verifyEmailToken: jest.fn(),
  generatePasswordResetToken: jest.fn().mockReturnValue('rtok'),
  verifyPasswordResetToken: jest.fn(),
};
const mockEmail: any = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};
const mockOrgs: any = { createOrganization: jest.fn() };
const mockSettings: any = {
  isSignupEnabled: jest.fn().mockResolvedValue(true),
  isSignupCreateOrganizationEnabled: jest.fn().mockResolvedValue(false),
};

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  password: 'hashed_password',
  name: 'Test User',
  phoneNumber: null,
  language: 'pt',
  emailVerified: new Date(),
  twoFactorEnabled: false,
  twoFactorSecret: null,
  isSuperAdmin: false,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      mockPrisma,
      mockJwt,
      mockConfig,
      mockToken,
      mockEmail,
      mockOrgs,
      mockSettings,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── login ──────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'test@example.com', password: 'pass' });

      expect(result.message).toBe('Login successful');
      expect(result.tokens).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.isSuperAdmin).toBe(false);
      expect(result.user.twoFactorVerified).toBe(false);
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'x@x.com', password: 'p' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException when email not verified', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ ...mockUser, emailVerified: null })
        .mockResolvedValueOnce({ ...mockUser, emailVerified: null }); // for sendVerificationEmail
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(service.login({ email: 'test@example.com', password: 'pass' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException with requires2FA when code missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, twoFactorEnabled: true, twoFactorSecret: 'SECRET' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(service.login({ email: 'test@example.com', password: 'pass' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid 2FA code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, twoFactorEnabled: true, twoFactorSecret: 'SECRET' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (authenticator.verify as jest.Mock).mockReturnValue(false);
      await expect(service.login({ email: 'test@example.com', password: 'pass', twoFactorCode: '000000' })).rejects.toThrow(BadRequestException);
    });

    it('succeeds with valid 2FA code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, twoFactorEnabled: true, twoFactorSecret: 'SECRET' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (authenticator.verify as jest.Mock).mockReturnValue(true);
      const result = await service.login({ email: 'test@example.com', password: 'pass', twoFactorCode: '123456' });
      expect(result.tokens).toBeDefined();
      expect(result.user.twoFactorVerified).toBe(true);
    });
  });

  // ─── signup ──────────────────────────────────────────────────────────────────
  describe('signup', () => {
    it('throws ForbiddenException when signup disabled', async () => {
      mockSettings.isSignupEnabled.mockResolvedValue(false);
      await expect(service.signup({ email: 'a@b.com', password: 'pass' } as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when user already exists', async () => {
      mockSettings.isSignupEnabled.mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      await expect(service.signup({ email: 'test@example.com', password: 'pass' } as any)).rejects.toThrow(BadRequestException);
    });

    it('creates user and returns success', async () => {
      mockSettings.isSignupEnabled.mockResolvedValue(true);
      mockSettings.isSignupCreateOrganizationEnabled.mockResolvedValue(false);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(mockUser);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      const result = await service.signup({ email: 'new@example.com', password: 'pass' } as any);
      expect(result.user).toBeDefined();
    });
  });

  // ─── verifyEmail ─────────────────────────────────────────────────────────────
  describe('verifyEmail', () => {
    it('throws BadRequestException for invalid token', async () => {
      mockToken.verifyEmailToken.mockReturnValue(null);
      await expect(service.verifyEmail({ token: 'bad' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when already verified', async () => {
      mockToken.verifyEmailToken.mockReturnValue({ email: 'test@example.com' });
      mockPrisma.user.findUnique.mockReset();
      mockPrisma.user.findUnique.mockResolvedValueOnce({ emailVerified: new Date() });
      await expect(service.verifyEmail({ token: 'tok' })).rejects.toThrow(BadRequestException);
    });

    it('verifies email with valid token', async () => {
      mockToken.verifyEmailToken.mockReturnValue({ email: 'test@example.com' });
      mockPrisma.user.findUnique.mockReset();
      mockPrisma.user.findUnique.mockResolvedValueOnce({ emailVerified: null });
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, emailVerified: new Date() });
      const result = await service.verifyEmail({ token: 'valid' });
      expect(result.user.emailVerified).toBeDefined();
    });
  });

  // ─── refreshToken ─────────────────────────────────────────────────────────────
  describe('refreshToken', () => {
    it('throws UnauthorizedException for invalid refresh token', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.refreshToken({ refreshToken: 'bad' })).rejects.toThrow(UnauthorizedException);
    });

    it('returns new tokens for valid refresh token', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.refreshToken({ refreshToken: 'valid' });
      expect(result.tokens).toBeDefined();
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────────
  describe('forgotPassword', () => {
    it('returns same response even when email does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.forgotPassword({ email: 'nobody@example.com' } as any);
      expect(result.message).toBeDefined();
    });

    it('sends reset email when user exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      await service.forgotPassword({ email: 'test@example.com' } as any);
      expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    it('throws BadRequestException for invalid token', async () => {
      mockToken.verifyPasswordResetToken.mockReturnValue(null);
      await expect(service.resetPassword({ token: 'bad', password: 'new' })).rejects.toThrow(BadRequestException);
    });

    it('updates password with valid token', async () => {
      mockToken.verifyPasswordResetToken.mockReturnValue({ email: 'test@example.com', userId: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      const result = await service.resetPassword({ token: 'valid', password: 'newpass' });
      expect(result.message).toBeDefined();
    });
  });

  // ─── setupTwoFactor ───────────────────────────────────────────────────────────
  describe('setupTwoFactor', () => {
    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.setupTwoFactor({ userId: 'ghost' })).rejects.toThrow(UnauthorizedException);
    });

    it('returns secret, otpauthUrl and qrCode', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      const result = await service.setupTwoFactor({ userId: 'user-1' });
      expect(result.secret).toBe('MOCKED_SECRET');
      expect(result.qrCode).toBeDefined();
    });
  });

  // ─── verifyTwoFactor ──────────────────────────────────────────────────────────
  describe('verifyTwoFactor', () => {
    it('throws BadRequestException when 2FA not set up', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, twoFactorSecret: null });
      await expect(service.verifyTwoFactor({ userId: 'user-1', email: 'test@example.com' }, '123456')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, twoFactorSecret: 'SECRET' });
      (authenticator.verify as jest.Mock).mockReturnValue(false);
      await expect(service.verifyTwoFactor({ userId: 'user-1', email: 'test@example.com' }, '000000')).rejects.toThrow(BadRequestException);
    });

    it('enables 2FA when enable=true with valid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, twoFactorSecret: 'SECRET' });
      (authenticator.verify as jest.Mock).mockReturnValue(true);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      const result = await service.verifyTwoFactor({ userId: 'user-1', email: 'test@example.com' }, '123456', true);
      expect(result.tokens).toBeDefined();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { twoFactorEnabled: true } }));
    });
  });

  // ─── disableTwoFactor ─────────────────────────────────────────────────────────
  describe('disableTwoFactor', () => {
    it('throws BadRequestException when 2FA not enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, twoFactorEnabled: false });
      await expect(service.disableTwoFactor({ userId: 'user-1' }, '123456')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, twoFactorEnabled: true, twoFactorSecret: 'SECRET' });
      (authenticator.verify as jest.Mock).mockReturnValue(false);
      await expect(service.disableTwoFactor({ userId: 'user-1' }, '000000')).rejects.toThrow(BadRequestException);
    });

    it('disables 2FA with valid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, twoFactorEnabled: true, twoFactorSecret: 'SECRET' });
      (authenticator.verify as jest.Mock).mockReturnValue(true);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      const result = await service.disableTwoFactor({ userId: 'user-1' }, '123456');
      expect(result.message).toBeDefined();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      }));
    });
  });
});
