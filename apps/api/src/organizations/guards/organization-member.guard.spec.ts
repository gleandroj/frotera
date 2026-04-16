import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { OrganizationMemberGuard } from './organization-member.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '@/customers/customers.service';
import { ApiCode } from '@/common/api-codes.enum';

describe('OrganizationMemberGuard', () => {
  let guard: OrganizationMemberGuard;
  let prismaService: any;
  let customersService: any;

  beforeEach(async () => {
    const mockPrismaService = {
      organizationMember: {
        findUnique: jest.fn(),
      },
    };

    const mockCustomersService = {
      getAllowedCustomerIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationMemberGuard,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CustomersService,
          useValue: mockCustomersService,
        },
      ],
    }).compile();

    guard = module.get<OrganizationMemberGuard>(OrganizationMemberGuard);
    prismaService = module.get(PrismaService);
    customersService = module.get(CustomersService);
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
    it('should return false when userId is missing from request.user', async () => {
      const context = createMockContext({
        user: {},
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(prismaService.organizationMember.findUnique).not.toHaveBeenCalled();
    });

    it('should return false when request.user is undefined', async () => {
      const context = createMockContext({
        user: undefined,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return true and populate organizationMember when superAdmin is true', async () => {
      const context = createMockContext({
        user: { userId: 'user-1', isSuperAdmin: true },
        params: { organizationId: 'org-1' },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.organizationMember).toEqual({
        id: 'superadmin',
        organizationId: 'org-1',
        userId: 'user-1',
        role: 'OWNER',
        customerRestricted: false,
      });
    });

    it('should set allowedCustomerIds to null for superAdmin', async () => {
      const context = createMockContext({
        user: { userId: 'user-1', isSuperAdmin: true },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.allowedCustomerIds).toBeNull();
    });

    it('should not call customersService for superAdmin', async () => {
      const context = createMockContext({
        user: { userId: 'user-1', isSuperAdmin: true },
      });

      await guard.canActivate(context);

      expect(customersService.getAllowedCustomerIds).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException ORGANIZATION_NOT_FOUND when user is not a member', async () => {
      const context = createMockContext({
        user: { userId: 'user-1', isSuperAdmin: false },
      });
      (prismaService.organizationMember.findUnique as any).mockResolvedValueOnce(
        null,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND),
      );
    });

    it('should query database with correct userId and organizationId', async () => {
      const userId = 'user-123';
      const organizationId = 'org-456';
      const context = createMockContext({
        user: { userId, isSuperAdmin: false },
        params: { organizationId },
      });
      (prismaService.organizationMember.findUnique as any).mockResolvedValueOnce({
        id: 'member-1',
        userId,
        organizationId,
        role: 'MEMBER',
        customerRestricted: false,
      });
      customersService.getAllowedCustomerIds.mockResolvedValueOnce(null);

      await guard.canActivate(context);

      expect(prismaService.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
      });
    });

    it('should return true and populate organizationMember when user is a member', async () => {
      const membership = {
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'MEMBER',
        customerRestricted: false,
      };
      const context = createMockContext();
      (prismaService.organizationMember.findUnique as any).mockResolvedValueOnce(
        membership,
      );
      customersService.getAllowedCustomerIds.mockResolvedValueOnce(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.organizationMember).toEqual(membership);
    });

    it('should call customersService.getAllowedCustomerIds for regular members', async () => {
      const membership = {
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'MEMBER',
        customerRestricted: true,
      };
      const context = createMockContext();
      (prismaService.organizationMember.findUnique as any).mockResolvedValueOnce(
        membership,
      );
      customersService.getAllowedCustomerIds.mockResolvedValueOnce(null);

      await guard.canActivate(context);

      expect(customersService.getAllowedCustomerIds).toHaveBeenCalledWith(
        membership,
        'org-1',
      );
    });

    it('should set allowedCustomerIds from customersService response', async () => {
      const membership = {
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'MEMBER',
        customerRestricted: true,
      };
      const allowedIds = ['customer-1', 'customer-2'];
      const context = createMockContext();
      (prismaService.organizationMember.findUnique as any).mockResolvedValueOnce(
        membership,
      );
      customersService.getAllowedCustomerIds.mockResolvedValueOnce(allowedIds);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.allowedCustomerIds).toEqual(allowedIds);
    });

    it('should set allowedCustomerIds to null when customersService returns null', async () => {
      const membership = {
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'MEMBER',
        customerRestricted: false,
      };
      const context = createMockContext();
      (prismaService.organizationMember.findUnique as any).mockResolvedValueOnce(
        membership,
      );
      customersService.getAllowedCustomerIds.mockResolvedValueOnce(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.allowedCustomerIds).toBeNull();
    });

    it('should handle different organization IDs correctly', async () => {
      const orgId1 = 'org-1';
      const orgId2 = 'org-2';
      const membership1 = {
        id: 'member-1',
        userId: 'user-1',
        organizationId: orgId1,
        role: 'MEMBER',
        customerRestricted: false,
      };

      const context1 = createMockContext({
        params: { organizationId: orgId1 },
      });
      const context2 = createMockContext({
        params: { organizationId: orgId2 },
      });

      (prismaService.organizationMember.findUnique as any).mockResolvedValueOnce(
        membership1,
      );
      (prismaService.organizationMember.findUnique as any).mockResolvedValueOnce(
        null,
      );
      customersService.getAllowedCustomerIds.mockResolvedValueOnce(null);

      const result1 = await guard.canActivate(context1);
      expect(result1).toBe(true);

      await expect(guard.canActivate(context2)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve organizationMember data in request', async () => {
      const membership = {
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'ADMIN',
        customerRestricted: false,
        permissions: ['read', 'write'],
      };
      const context = createMockContext();
      (prismaService.organizationMember.findUnique as any).mockResolvedValueOnce(
        membership,
      );
      customersService.getAllowedCustomerIds.mockResolvedValueOnce(null);

      await guard.canActivate(context);

      const request = context.switchToHttp().getRequest();
      expect(request.organizationMember).toEqual(membership);
    });

    it('should return true after all operations complete successfully', async () => {
      const membership = {
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'MEMBER',
        customerRestricted: true,
      };
      const context = createMockContext();
      (prismaService.organizationMember.findUnique as any).mockResolvedValueOnce(
        membership,
      );
      customersService.getAllowedCustomerIds.mockResolvedValueOnce([
        'customer-1',
      ]);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
