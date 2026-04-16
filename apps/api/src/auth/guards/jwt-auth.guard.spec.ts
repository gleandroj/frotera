import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, REQUIRE_2FA_KEY } from './jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiCode } from '@/common/api-codes.enum';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: any;
  let configService: any;
  let prismaService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '123456789',
    twoFactorEnabled: false,
    emailVerified: true,
    isSuperAdmin: false,
  };

  beforeEach(async () => {
    const mockJwtService = {
      verifyAsync: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    prismaService = module.get(PrismaService);

    configService.get.mockReturnValue('test-secret-key');
  });

  function createMockContext(overrides?: {
    user?: any;
    headers?: any;
    path?: string;
  }): ExecutionContext {
    const request = {
      user: overrides && 'user' in overrides ? overrides.user : { userId: 'user-1', isSuperAdmin: false },
      headers: overrides?.headers ?? { authorization: 'Bearer valid_token' },
      path: overrides?.path ?? '/api/test',
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  describe('canActivate', () => {
    it('should throw UnauthorizedException AUTH_UNAUTHORIZED when no Authorization header', async () => {
      const context = createMockContext({
        headers: {},
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException(ApiCode.AUTH_UNAUTHORIZED),
      );
    });

    it('should throw UnauthorizedException when Authorization header does not start with Bearer', async () => {
      const context = createMockContext({
        headers: { authorization: 'Basic valid_token' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException(ApiCode.AUTH_UNAUTHORIZED),
      );
    });

    it('should throw UnauthorizedException AUTH_INVALID_TOKEN when jwtService.verifyAsync rejects', async () => {
      const context = createMockContext();
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('Invalid token'));

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException(ApiCode.AUTH_INVALID_TOKEN),
      );
    });

    it('should throw UnauthorizedException USER_NOT_FOUND when user does not exist in database', async () => {
      const context = createMockContext();
      jwtService.verifyAsync.mockResolvedValueOnce({
        userId: 'non-existent-user',
        email: 'test@example.com',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException(ApiCode.USER_NOT_FOUND),
      );
    });

    it('should throw UnauthorizedException AUTH_ACCOUNT_NOT_VERIFIED when email is not verified', async () => {
      const context = createMockContext();
      jwtService.verifyAsync.mockResolvedValueOnce({
        userId: 'user-1',
        email: 'test@example.com',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        ...mockUser,
        emailVerified: false,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException(ApiCode.AUTH_ACCOUNT_NOT_VERIFIED),
      );
    });

    it('should throw UnauthorizedException AUTH_2FA_REQUIRED when 2FA is enabled and twoFactorVerified is false', async () => {
      const context = createMockContext();
      jest.spyOn(Reflect, 'getMetadata').mockReturnValueOnce(true);

      jwtService.verifyAsync.mockResolvedValueOnce({
        userId: 'user-1',
        email: 'test@example.com',
        twoFactorVerified: false,
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        ...mockUser,
        twoFactorEnabled: true,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException(ApiCode.AUTH_2FA_REQUIRED),
      );
    });

    it('should return true and populate request.user when token is valid and email is verified', async () => {
      const context = createMockContext();
      jest.spyOn(Reflect, 'getMetadata').mockReturnValueOnce(true);

      jwtService.verifyAsync.mockResolvedValueOnce({
        userId: 'user-1',
        email: 'test@example.com',
        twoFactorVerified: false,
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual({
        userId: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        phoneNumber: '123456789',
        twoFactorEnabled: false,
        twoFactorVerified: false,
        isSuperAdmin: false,
      });
    });

    it('should return true when Require2FA(false) is set and 2FA is not verified', async () => {
      const context = createMockContext();
      jest.spyOn(Reflect, 'getMetadata').mockReturnValueOnce(false);

      jwtService.verifyAsync.mockResolvedValueOnce({
        userId: 'user-1',
        email: 'test@example.com',
        twoFactorVerified: false,
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        ...mockUser,
        twoFactorEnabled: true,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when 2FA is enabled and twoFactorVerified is true', async () => {
      const context = createMockContext();
      jest.spyOn(Reflect, 'getMetadata').mockReturnValueOnce(true);

      jwtService.verifyAsync.mockResolvedValueOnce({
        userId: 'user-1',
        email: 'test@example.com',
        twoFactorVerified: true,
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        ...mockUser,
        twoFactorEnabled: true,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should include isSuperAdmin in user context', async () => {
      const context = createMockContext();
      jest.spyOn(Reflect, 'getMetadata').mockReturnValueOnce(true);

      jwtService.verifyAsync.mockResolvedValueOnce({
        userId: 'user-1',
        email: 'admin@example.com',
        twoFactorVerified: false,
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        ...mockUser,
        isSuperAdmin: true,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user.isSuperAdmin).toBe(true);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer Authorization header', async () => {
      const context = createMockContext({
        headers: { authorization: 'Bearer my-token-123' },
      });
      jest.spyOn(Reflect, 'getMetadata').mockReturnValueOnce(true);

      jwtService.verifyAsync.mockResolvedValueOnce({
        userId: 'user-1',
        email: 'test@example.com',
        twoFactorVerified: false,
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce(mockUser);

      await guard.canActivate(context);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'my-token-123',
        expect.any(Object),
      );
    });

    it('should return undefined when Authorization header is missing', async () => {
      const context = createMockContext({
        headers: {},
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
