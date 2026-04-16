import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';

describe('MembersService - Dependency Resolution', () => {
  let service: MembersService;

  const mockPrisma = {
    organizationMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    customer: {
      findMany: jest.fn(),
    },
    organizationMemberCustomer: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCustomersService = {
    getAllowedCustomerIds: jest.fn(),
    getCustomerIdAndAncestorIds: jest.fn(),
    getRootCustomerIds: jest.fn(),
  };

  const mockAuthService = {
    createUserWithPassword: jest.fn(),
    createUser: jest.fn(),
    validatePassword: jest.fn(),
    hashPassword: jest.fn(),
  };

  const mockEmailService = {
    sendAccountCreatedEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CustomersService,
          useValue: mockCustomersService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMembers', () => {
    it('should throw ForbiddenException when user is not a member', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';

      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(null);

      const result = service.getMembers(userId, orgId);

      await expect(result).rejects.toThrow(ForbiddenException);
    });

    it('should call findMany with correct parameters', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';

      const mockMembership = {
        id: 'member-1',
        userId,
        organizationId: orgId,
        roleId: 'role-1',
        customerRestricted: false,
        createdAt: new Date(),
        role: {
          id: 'role-1',
          name: 'User',
          isSystem: false,
          organizationId: orgId,
          color: '#000',
          description: null,
          permissions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        user: {
          id: userId,
          email: 'test@test.com',
          name: 'Test',
          createdAt: new Date(),
        },
        customers: [],
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(mockMembership);
      mockPrisma.organizationMember.findMany.mockResolvedValueOnce([mockMembership]);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValueOnce(null);

      await service.getMembers(userId, orgId);

      expect(mockPrisma.organizationMember.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          user: { isSuperAdmin: false, isSystemUser: false },
        },
        include: {
          user: { select: { id: true, email: true, name: true, createdAt: true } },
          role: { include: { permissions: true } },
          customers: { include: { customer: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('removeMember', () => {
    it('should throw ForbiddenException when user is not a member', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';
      const memberId = 'member-1';

      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(null);

      const result = service.removeMember(userId, orgId, memberId);

      await expect(result).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user lacks DELETE permission', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';
      const memberId = 'member-2';

      const membershipWithoutDelete = {
        id: 'member-1',
        userId,
        organizationId: orgId,
        roleId: 'role-1',
        role: {
          permissions: [
            {
              id: 'perm-1',
              module: 'USERS',
              actions: ['VIEW'],
              scope: 'ALL',
            },
          ],
        },
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        membershipWithoutDelete,
      );

      const result = service.removeMember(userId, orgId, memberId);

      await expect(result).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when member does not exist', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';
      const memberId = 'member-2';

      const membershipWithDelete = {
        id: 'member-1',
        userId,
        organizationId: orgId,
        roleId: 'role-1',
        role: {
          permissions: [
            {
              id: 'perm-1',
              module: 'USERS',
              actions: ['VIEW', 'EDIT', 'CREATE', 'DELETE'],
              scope: 'ALL',
            },
          ],
        },
      };

      mockPrisma.organizationMember.findFirst
        .mockResolvedValueOnce(membershipWithDelete)
        .mockResolvedValueOnce(null);

      const result = service.removeMember(userId, orgId, memberId);

      await expect(result).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when trying to remove self', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';
      const memberId = 'member-1';

      const membershipWithDelete = {
        id: memberId,
        userId,
        organizationId: orgId,
        roleId: 'role-1',
        role: {
          permissions: [
            {
              id: 'perm-1',
              module: 'USERS',
              actions: ['VIEW', 'EDIT', 'CREATE', 'DELETE'],
              scope: 'ALL',
            },
          ],
        },
      };

      mockPrisma.organizationMember.findFirst
        .mockResolvedValueOnce(membershipWithDelete)
        .mockResolvedValueOnce(membershipWithDelete);

      const result = service.removeMember(userId, orgId, memberId);

      await expect(result).rejects.toThrow(BadRequestException);
    });

    it('should delete member when all conditions are met', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';
      const memberId = 'member-2';

      const membershipWithDelete = {
        id: 'member-1',
        userId,
        organizationId: orgId,
        roleId: 'role-1',
        role: {
          permissions: [
            {
              id: 'perm-1',
              module: 'USERS',
              actions: ['VIEW', 'EDIT', 'CREATE', 'DELETE'],
              scope: 'ALL',
            },
          ],
        },
      };

      const memberToDelete = {
        id: memberId,
        userId: 'user-2',
        organizationId: orgId,
        roleId: 'role-1',
      };

      mockPrisma.organizationMember.findFirst
        .mockResolvedValueOnce(membershipWithDelete)
        .mockResolvedValueOnce(memberToDelete);
      mockPrisma.organizationMember.delete.mockResolvedValueOnce(memberToDelete);

      const result = await service.removeMember(userId, orgId, memberId);

      expect(result).toEqual({ message: 'MEMBER_REMOVED_SUCCESSFULLY' });
      expect(mockPrisma.organizationMember.delete).toHaveBeenCalledWith({
        where: { id: memberId },
      });
    });
  });
});
