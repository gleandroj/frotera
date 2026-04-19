import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, Require2FA } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { VerifyTwoFactorDto, DisableTwoFactorDto } from './dto/two-factor.dto';
import { ApiCode } from '../common/api-codes.enum';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    login: jest.fn(),
    signup: jest.fn(),
    verifyEmail: jest.fn(),
    refreshToken: jest.fn(),
    getProfile: jest.fn(),
    updateLanguage: jest.fn(),
    setupTwoFactor: jest.fn(),
    verifyTwoFactor: jest.fn(),
    disableTwoFactor: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    logout: jest.fn(),
  };

  const mockUser = {
    userId: 'user-id-1',
    email: 'test@example.com',
    twoFactorEnabled: false,
    twoFactorVerified: false,
    emailVerified: new Date(),
  };

  const mockRequest = {
    user: mockUser,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService) as jest.Mocked<AuthService>;
  });

  describe('POST /auth/login', () => {
    it('should call authService.login with correct parameters', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockResponse = {
        message: 'Login successful',
        user: {
          id: 'user-id-1',
          email: 'test@example.com',
          name: 'Test User',
          phoneNumber: null,
          language: 'pt',
          twoFactorEnabled: false,
          emailVerified: new Date(),
          isSuperAdmin: false,
          twoFactorVerified: false,
        },
        tokens: {
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
        },
      };

      authService.login.mockResolvedValue(mockResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(authService.login).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/signup', () => {
    it('should call authService.signup with correct parameters', async () => {
      const signupDto: SignupDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        language: 'pt',
      };

      const mockResponse = {
        message: ApiCode.AUTH_ACCOUNT_CREATED,
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
          name: 'New User',
          phoneNumber: null,
          language: 'pt',
          twoFactorEnabled: false,
          emailVerified: null,
        },
        organization: undefined,
      };

      authService.signup.mockResolvedValue(mockResponse);

      const result = await controller.signup(signupDto);

      expect(result).toEqual(mockResponse);
      expect(authService.signup).toHaveBeenCalledWith(signupDto);
      expect(authService.signup).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/verify-email', () => {
    it('should call authService.verifyEmail with correct parameters', async () => {
      const verifyEmailDto: VerifyEmailDto = {
        token: 'valid_token',
      };

      const mockResponse = {
        message: ApiCode.AUTH_EMAIL_VERIFIED,
        user: {
          id: 'user-id-1',
          email: 'test@example.com',
          emailVerified: new Date(),
        },
      };

      authService.verifyEmail.mockResolvedValue(mockResponse);

      const result = await controller.verifyEmail(verifyEmailDto);

      expect(result).toEqual(mockResponse);
      expect(authService.verifyEmail).toHaveBeenCalledWith(verifyEmailDto);
      expect(authService.verifyEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should call authService.refreshToken with correct parameters', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'valid_refresh_token',
      };

      const mockResponse = {
        message: ApiCode.AUTH_TOKEN_REFRESHED,
        tokens: {
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
        },
      };

      authService.refreshToken.mockResolvedValue(mockResponse);

      const result = await controller.refreshToken(refreshTokenDto);

      expect(result).toEqual(mockResponse);
      expect(authService.refreshToken).toHaveBeenCalledWith(refreshTokenDto);
      expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /auth/me', () => {
    it('should call authService.getProfile with user from request', async () => {
      const mockResponse = {
        user: {
          id: 'user-id-1',
          email: 'test@example.com',
          name: 'Test User',
          phoneNumber: null,
          language: 'pt',
          twoFactorEnabled: false,
          emailVerified: new Date(),
          isSuperAdmin: false,
        },
      };

      authService.getProfile.mockResolvedValue(mockResponse);

      const result = await controller.getProfile(mockRequest as any);

      expect(result).toEqual(mockResponse);
      expect(authService.getProfile).toHaveBeenCalledWith(mockUser);
      expect(authService.getProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /auth/language', () => {
    it('should call authService.updateLanguage with correct parameters', async () => {
      const updateLanguageDto: UpdateLanguageDto = {
        language: 'en',
      };

      const mockResponse = {
        message: 'Language preference updated successfully',
        user: {
          id: 'user-id-1',
          email: 'test@example.com',
          name: 'Test User',
          phoneNumber: null,
          language: 'en',
          twoFactorEnabled: false,
          emailVerified: new Date(),
        },
      };

      authService.updateLanguage.mockResolvedValue(mockResponse);

      const result = await controller.updateLanguage(mockRequest as any, updateLanguageDto);

      expect(result).toEqual(mockResponse);
      expect(authService.updateLanguage).toHaveBeenCalledWith(mockUser, 'en');
      expect(authService.updateLanguage).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/2fa/setup', () => {
    it('should call authService.setupTwoFactor with user from request', async () => {
      const mockResponse = {
        secret: 'MOCKED_SECRET',
        otpauthUrl: 'otpauth://totp/test',
        qrCode: 'data:image/png;base64,mock',
        manualEntryKey: 'MOCKED_SECRET',
      };

      authService.setupTwoFactor.mockResolvedValue(mockResponse);

      const result = await controller.setupTwoFactor(mockRequest as any);

      expect(result).toEqual(mockResponse);
      expect(authService.setupTwoFactor).toHaveBeenCalledWith(mockUser);
      expect(authService.setupTwoFactor).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/2fa/verify', () => {
    it('should call authService.verifyTwoFactor with correct parameters and enable=true', async () => {
      const verifyTwoFactorDto: VerifyTwoFactorDto = {
        token: '123456',
        enable: true,
      };

      const mockResponse = {
        message: ApiCode.AUTH_2FA_ENABLED_SUCCESSFULLY,
        tokens: {
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
        },
      };

      authService.verifyTwoFactor.mockResolvedValue(mockResponse);

      const result = await controller.verifyTwoFactor(mockRequest as any, verifyTwoFactorDto);

      expect(result).toEqual(mockResponse);
      expect(authService.verifyTwoFactor).toHaveBeenCalledWith(mockUser, '123456', true);
      expect(authService.verifyTwoFactor).toHaveBeenCalledTimes(1);
    });

    it('should call authService.verifyTwoFactor with enable=false', async () => {
      const verifyTwoFactorDto: VerifyTwoFactorDto = {
        token: '123456',
        enable: false,
      };

      const mockResponse = {
        message: ApiCode.AUTH_2FA_VERIFIED,
        tokens: {
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
        },
      };

      authService.verifyTwoFactor.mockResolvedValue(mockResponse);

      const result = await controller.verifyTwoFactor(mockRequest as any, verifyTwoFactorDto);

      expect(result).toEqual(mockResponse);
      expect(authService.verifyTwoFactor).toHaveBeenCalledWith(mockUser, '123456', false);
      expect(authService.verifyTwoFactor).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/2fa/disable', () => {
    it('should call authService.disableTwoFactor with correct parameters', async () => {
      const disableTwoFactorDto: DisableTwoFactorDto = {
        token: '123456',
      };

      const mockResponse = {
        message: ApiCode.AUTH_2FA_DISABLED_SUCCESSFULLY,
      };

      authService.disableTwoFactor.mockResolvedValue(mockResponse);

      const result = await controller.disableTwoFactor(mockRequest as any, disableTwoFactorDto);

      expect(result).toEqual(mockResponse);
      expect(authService.disableTwoFactor).toHaveBeenCalledWith(mockUser, '123456');
      expect(authService.disableTwoFactor).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should call authService.forgotPassword with correct parameters', async () => {
      const forgotPasswordDto: ForgotPasswordDto = {
        email: 'test@example.com',
        language: 'pt',
      };

      const mockResponse = {
        message: "If an account with that email exists, we'll send you a password reset link.",
      };

      authService.forgotPassword.mockResolvedValue(mockResponse);

      const result = await controller.forgotPassword(forgotPasswordDto);

      expect(result).toEqual(mockResponse);
      expect(authService.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto);
      expect(authService.forgotPassword).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should call authService.resetPassword with correct parameters', async () => {
      const resetPasswordDto: ResetPasswordDto = {
        token: 'valid_reset_token',
        password: 'newpassword123',
      };

      const mockResponse = {
        message: 'Password has been reset successfully. You can now login with your new password.',
      };

      authService.resetPassword.mockResolvedValue(mockResponse);

      const result = await controller.resetPassword(resetPasswordDto);

      expect(result).toEqual(mockResponse);
      expect(authService.resetPassword).toHaveBeenCalledWith(resetPasswordDto);
      expect(authService.resetPassword).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/logout', () => {
    it('should call authService.logout with user from request', async () => {
      const mockResponse = {
        message: 'Logout successful',
      };

      authService.logout.mockResolvedValue(mockResponse);

      const result = await controller.logout(mockRequest as any);

      expect(result).toEqual(mockResponse);
      expect(authService.logout).toHaveBeenCalledWith(mockUser);
      expect(authService.logout).toHaveBeenCalledTimes(1);
    });
  });
});
