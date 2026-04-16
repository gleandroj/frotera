import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuspensionGuard } from './suspension.guard';

describe('SuspensionGuard', () => {
  let guard: SuspensionGuard;
  let configService: any;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuspensionGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<SuspensionGuard>(SuspensionGuard);
    configService = module.get(ConfigService);
  });

  function createMockContext(overrides?: {
    user?: any;
    params?: any;
    headers?: any;
    path?: string;
  }): ExecutionContext {
    const request = {
      user: overrides && 'user' in overrides ? overrides.user : { userId: 'user-1', isSuperAdmin: false },
      params: overrides?.params ?? { organizationId: 'org-1' },
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
    it('should return true when SERVICE_SUSPENDED is not defined', () => {
      configService.get.mockReturnValueOnce(undefined);
      const context = createMockContext({
        path: '/api/users',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when SERVICE_SUSPENDED is "false"', () => {
      configService.get.mockReturnValueOnce('false');
      const context = createMockContext({
        path: '/api/users',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when SERVICE_SUSPENDED is "False" (case-insensitive)', () => {
      configService.get.mockReturnValueOnce('False');
      const context = createMockContext({
        path: '/api/users',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when service is suspended but path is /api/health', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/api/health',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when service is suspended but path is /health', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/health',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true for /api/health/live when suspended', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/api/health/live',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true for /api/health/ready when suspended', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/api/health/ready',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ServiceUnavailableException when SERVICE_SUSPENDED="true" and path is /api/users', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/api/users',
      });

      expect(() => guard.canActivate(context)).toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw ServiceUnavailableException when SERVICE_SUSPENDED="true" and path is /api/organizations/org-1', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/api/organizations/org-1',
      });

      expect(() => guard.canActivate(context)).toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw ServiceUnavailableException with 503 status code', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/api/users',
      });

      try {
        guard.canActivate(context);
        fail('Should have thrown exception');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.getStatus()).toBe(503);
      }
    });

    it('should throw ServiceUnavailableException with appropriate error message', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/api/users',
      });

      try {
        guard.canActivate(context);
        fail('Should have thrown exception');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        const response = error.getResponse();
        expect(response).toEqual(
          expect.objectContaining({
            statusCode: 503,
            message: 'Service is currently suspended',
            error: 'Service Unavailable',
          }),
        );
      }
    });

    it('should handle SERVICE_SUSPENDED="TRUE" (uppercase) as suspended', () => {
      configService.get.mockReturnValueOnce('TRUE');
      const context = createMockContext({
        path: '/api/users',
      });

      expect(() => guard.canActivate(context)).toThrow(
        ServiceUnavailableException,
      );
    });

    it('should handle SERVICE_SUSPENDED="True" (mixed case) as suspended', () => {
      configService.get.mockReturnValueOnce('True');
      const context = createMockContext({
        path: '/api/users',
      });

      expect(() => guard.canActivate(context)).toThrow(
        ServiceUnavailableException,
      );
    });

    it('should be case-insensitive for true check', () => {
      const paths = ['/api/users', '/api/test', '/api/something'];

      for (const path of paths) {
        configService.get.mockReturnValueOnce('TRUE');
        const context = createMockContext({ path });

        expect(() => guard.canActivate(context)).toThrow(
          ServiceUnavailableException,
        );
      }
    });

    it('should allow /health without /api prefix when suspended', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/health',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should block /healthz even when suspended', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/healthz',
      });

      expect(() => guard.canActivate(context)).toThrow(
        ServiceUnavailableException,
      );
    });

    it('should allow multiple health endpoints', () => {
      const healthPaths = [
        '/health',
        '/api/health',
        '/api/health/live',
        '/api/health/ready',
        '/api/health/startup',
      ];

      for (const path of healthPaths) {
        configService.get.mockReturnValueOnce('true');
        const context = createMockContext({ path });

        const result = guard.canActivate(context);
        expect(result).toBe(true);
      }
    });

    it('should block API endpoints other than health when suspended', () => {
      const blockedPaths = [
        '/api/auth/login',
        '/api/users/me',
        '/api/organizations',
        '/api/customers',
      ];

      for (const path of blockedPaths) {
        configService.get.mockReturnValueOnce('true');
        const context = createMockContext({ path });

        expect(() => guard.canActivate(context)).toThrow(
          ServiceUnavailableException,
        );
      }
    });

    it('should return true when SERVICE_SUSPENDED is "false" (lowercase)', () => {
      configService.get.mockReturnValueOnce('false');
      const context = createMockContext({
        path: '/api/users',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when SERVICE_SUSPENDED is empty string', () => {
      configService.get.mockReturnValueOnce('');
      const context = createMockContext({
        path: '/api/users',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when SERVICE_SUSPENDED is "0"', () => {
      configService.get.mockReturnValueOnce('0');
      const context = createMockContext({
        path: '/api/users',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw when SERVICE_SUSPENDED is "1"', () => {
      configService.get.mockReturnValueOnce('1');
      const context = createMockContext({
        path: '/api/users',
      });

      // "1".toLowerCase() !== "true", so it should pass
      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should query ConfigService for SERVICE_SUSPENDED value', () => {
      configService.get.mockReturnValueOnce(undefined);
      const context = createMockContext();

      guard.canActivate(context);

      expect(configService.get).toHaveBeenCalledWith('SERVICE_SUSPENDED');
    });
  });

  describe('edge cases', () => {
    it('should handle request with multiple query parameters', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/api/users?page=1&limit=10',
      });

      expect(() => guard.canActivate(context)).toThrow(
        ServiceUnavailableException,
      );
    });

    it('should correctly identify /api/health even with trailing content', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/api/health/something',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow paths that start with /api/health', () => {
      configService.get.mockReturnValueOnce('true');
      const context = createMockContext({
        path: '/api/health-check',
      });

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });
  });
});
