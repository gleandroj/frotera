import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;
  let prismaService: any;

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperAdminGuard,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    guard = module.get<SuperAdminGuard>(SuperAdminGuard);
    prismaService = module.get(PrismaService);
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
    it('should throw ForbiddenException when user is not in request', async () => {
      const context = createMockContext({
        user: undefined,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Unauthorized'),
      );
    });

    it('should throw ForbiddenException when userId is missing from user', async () => {
      const context = createMockContext({
        user: { isSuperAdmin: true },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Unauthorized'),
      );
    });

    it('should throw ForbiddenException when user is not found in database', async () => {
      const context = createMockContext({
        user: { userId: 'non-existent-user' },
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Admin access required'),
      );
    });

    it('should throw ForbiddenException with message "Admin access required" when user isSuperAdmin is false', async () => {
      const context = createMockContext({
        user: { userId: 'user-1' },
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Admin access required'),
      );
    });

    it('should return true when user has isSuperAdmin set to true', async () => {
      const context = createMockContext({
        user: { userId: 'user-1' },
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: true,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should query the database with the correct userId', async () => {
      const userId = 'admin-user-123';
      const context = createMockContext({
        user: { userId },
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: true,
      });

      await guard.canActivate(context);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { isSuperAdmin: true },
      });
    });

    it('should only select isSuperAdmin field from database', async () => {
      const context = createMockContext({
        user: { userId: 'user-1' },
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: true,
      });

      await guard.canActivate(context);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { isSuperAdmin: true },
        }),
      );
    });

    it('should throw ForbiddenException when user exists but is not a super admin', async () => {
      const context = createMockContext({
        user: { userId: 'regular-user' },
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should handle null isSuperAdmin field as false', async () => {
      const context = createMockContext({
        user: { userId: 'user-1' },
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: null,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Admin access required'),
      );
    });

    it('should handle multiple super admin checks independently', async () => {
      const context1 = createMockContext({
        user: { userId: 'admin-1' },
      });
      const context2 = createMockContext({
        user: { userId: 'user-2' },
      });

      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: true,
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });

      const result1 = await guard.canActivate(context1);
      expect(result1).toBe(true);

      await expect(guard.canActivate(context2)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
