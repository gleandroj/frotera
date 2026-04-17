import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_KEY } from '../decorators/permission.decorator';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: any;
  let prismaService: any;

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
      organizationMember: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
    reflector = module.get(Reflector);
    prismaService = module.get(PrismaService);
  });

  function createMockContext(overrides?: {
    user?: any;
    params?: any;
    headers?: any;
    path?: string;
    organizationMember?: any;
  }): ExecutionContext {
    const request = {
      user: overrides && 'user' in overrides ? overrides.user : { userId: 'user-1', isSuperAdmin: false },
      params: overrides?.params ?? { organizationId: 'org-1' },
      headers: overrides?.headers ?? { authorization: 'Bearer valid_token' },
      path: overrides?.path ?? '/api/test',
      ...(overrides?.organizationMember !== undefined
        ? { organizationMember: overrides.organizationMember }
        : {}),
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
    it('should return true when no @RequiredPermission decorator is present', async () => {
      const context = createMockContext();
      reflector.getAllAndOverride.mockReturnValueOnce(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when userId is missing from request', async () => {
      const context = createMockContext({
        user: {},
      });
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'FUEL',
        action: 'VIEW',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('AUTH_FORBIDDEN'),
      );
    });

    it('should throw ForbiddenException when organizationId is missing from params', async () => {
      const context = createMockContext({
        params: {},
      });
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'FUEL',
        action: 'VIEW',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('AUTH_FORBIDDEN'),
      );
    });

    it('should return true when user is superAdmin regardless of permissions', async () => {
      const context = createMockContext({
        user: { userId: 'user-1', isSuperAdmin: true },
      });
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'FUEL',
        action: 'VIEW',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: true,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.organizationMember.findFirst).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not a member of the organization', async () => {
      const context = createMockContext();
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'FUEL',
        action: 'VIEW',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });
      (prismaService.organizationMember.findFirst as any).mockResolvedValueOnce(
        null,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('AUTH_FORBIDDEN'),
      );
    });

    it('should throw ForbiddenException when member does not have the required permission', async () => {
      const context = createMockContext();
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'FUEL',
        action: 'DELETE',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });
      (prismaService.organizationMember.findFirst as any).mockResolvedValueOnce({
        userId: 'user-1',
        organizationId: 'org-1',
        role: {
          permissions: [
            {
              module: 'FUEL',
              actions: ['VIEW', 'CREATE'],
            },
          ],
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('AUTH_FORBIDDEN'),
      );
    });

    it('should return true when member has the required permission', async () => {
      const context = createMockContext();
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'FUEL',
        action: 'VIEW',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });
      (prismaService.organizationMember.findFirst as any).mockResolvedValueOnce({
        userId: 'user-1',
        organizationId: 'org-1',
        role: {
          permissions: [
            {
              module: 'FUEL',
              actions: ['VIEW', 'CREATE'],
            },
          ],
        },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should reuse request.organizationMember when it matches user, org, and has role.permissions', async () => {
      const context = createMockContext({
        organizationMember: {
          userId: 'user-1',
          organizationId: 'org-1',
          role: {
            permissions: [{ module: 'FUEL', actions: ['VIEW'] }],
          },
        },
      });
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'FUEL',
        action: 'VIEW',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.organizationMember.findFirst).not.toHaveBeenCalled();
    });

    it('should query DB when cached organizationMember organizationId does not match params', async () => {
      const context = createMockContext({
        params: { organizationId: 'org-1' },
        organizationMember: {
          userId: 'user-1',
          organizationId: 'org-other',
          role: {
            permissions: [{ module: 'FUEL', actions: ['VIEW'] }],
          },
        },
      });
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'FUEL',
        action: 'VIEW',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });
      (prismaService.organizationMember.findFirst as any).mockResolvedValueOnce({
        userId: 'user-1',
        organizationId: 'org-1',
        role: {
          permissions: [{ module: 'FUEL', actions: ['VIEW'] }],
        },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.organizationMember.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should check permissions for the correct organization', async () => {
      const orgId = 'org-123';
      const context = createMockContext({
        params: { organizationId: orgId },
      });
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'FUEL',
        action: 'VIEW',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });
      (prismaService.organizationMember.findFirst as any).mockResolvedValueOnce({
        userId: 'user-1',
        organizationId: orgId,
        role: {
          permissions: [
            {
              module: 'FUEL',
              actions: ['VIEW'],
            },
          ],
        },
      });

      await guard.canActivate(context);

      expect(prismaService.organizationMember.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', organizationId: orgId },
        include: { role: { include: { permissions: true } } },
      });
    });

    it('should handle multiple permissions in role', async () => {
      const context = createMockContext();
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'CUSTOMERS',
        action: 'EDIT',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });
      (prismaService.organizationMember.findFirst as any).mockResolvedValueOnce({
        userId: 'user-1',
        organizationId: 'org-1',
        role: {
          permissions: [
            {
              module: 'FUEL',
              actions: ['VIEW', 'CREATE'],
            },
            {
              module: 'CUSTOMERS',
              actions: ['VIEW', 'EDIT', 'DELETE'],
            },
          ],
        },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return false when permission action does not match', async () => {
      const context = createMockContext();
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'FUEL',
        action: 'DELETE',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });
      (prismaService.organizationMember.findFirst as any).mockResolvedValueOnce({
        userId: 'user-1',
        organizationId: 'org-1',
        role: {
          permissions: [
            {
              module: 'FUEL',
              actions: ['VIEW'],
            },
          ],
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should require the exact module match', async () => {
      const context = createMockContext();
      reflector.getAllAndOverride.mockReturnValueOnce({
        module: 'VEHICLES',
        action: 'VIEW',
      });
      (prismaService.user.findUnique as any).mockResolvedValueOnce({
        isSuperAdmin: false,
      });
      (prismaService.organizationMember.findFirst as any).mockResolvedValueOnce({
        userId: 'user-1',
        organizationId: 'org-1',
        role: {
          permissions: [
            {
              module: 'FUEL',
              actions: ['VIEW', 'CREATE'],
            },
          ],
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
