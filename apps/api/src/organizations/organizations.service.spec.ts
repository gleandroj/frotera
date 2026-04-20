import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ApiCode } from '@/common/api-codes.enum';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './organizations.dto';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prismaService: PrismaService;
  let configService: ConfigService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    role: { findFirst: jest.fn() },
    organization: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    organizationMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  // Test data
  const userId = 'user-1';
  const orgId = 'org-1';
  const memberId = 'member-1';

  const mockUser = {
    id: userId,
    language: 'pt',
  };

  const mockOwnerRole = {
    id: 'role-owner',
    key: 'ORGANIZATION_OWNER',
    name: 'Dono da Organização',
    description: 'Owner role',
    isSystem: true,
    color: '#FF0000',
    organizationId: null,
    permissions: [
      {
        id: 'perm-1',
        module: 'USERS',
        actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EDIT'],
        scope: 'ORGANIZATION',
      },
    ],
  };

  const mockOrganization = {
    id: orgId,
    name: 'Test Organization',
    description: 'A test organization',
    currency: 'BRL',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberships: [
      {
        id: memberId,
        userId,
        roleId: mockOwnerRole.id,
        createdAt: new Date(),
        role: mockOwnerRole,
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('createOrganization', () => {
    it('should create organization with user as OWNER', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findFirst.mockResolvedValue(mockOwnerRole);
      mockPrisma.organization.create.mockResolvedValue(mockOrganization);

      const dto: CreateOrganizationDto = {
        name: 'Test Organization',
        description: 'A test organization',
      };

      const result = await service.createOrganization(userId, dto);

      expect(result.message).toBe('Organization created successfully');
      expect(result.organization.id).toBe(orgId);
      expect(result.organization.name).toBe('Test Organization');
    });

    it('should set currency to BRL for Portuguese users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, language: 'pt' });
      mockPrisma.role.findFirst.mockResolvedValue(mockOwnerRole);
      mockPrisma.organization.create.mockResolvedValue({
        ...mockOrganization,
        currency: 'BRL',
      });

      const dto: CreateOrganizationDto = {
        name: 'Test Organization',
      };

      const result = await service.createOrganization(userId, dto);

      expect(result.organization.currency).toBe('BRL');
    });

    it('should set currency to USD for non-Portuguese users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        language: 'en',
      });
      mockPrisma.role.findFirst.mockResolvedValue(mockOwnerRole);
      mockPrisma.organization.create.mockResolvedValue({
        ...mockOrganization,
        currency: 'USD',
      });

      const dto: CreateOrganizationDto = {
        name: 'Test Organization',
      };

      const result = await service.createOrganization(userId, dto);

      expect(result.organization.currency).toBe('USD');
    });

    it('should throw error when owner role not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findFirst.mockResolvedValue(null);

      const dto: CreateOrganizationDto = {
        name: 'Test Organization',
      };

      await expect(service.createOrganization(userId, dto)).rejects.toThrow(
        'System role ORGANIZATION_OWNER not found. Run seed first.',
      );
    });

    it('should create organization membership with OWNER role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findFirst.mockResolvedValue(mockOwnerRole);
      mockPrisma.organization.create.mockResolvedValue(mockOrganization);

      const dto: CreateOrganizationDto = {
        name: 'Test Organization',
      };

      await service.createOrganization(userId, dto);

      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Organization',
          description: undefined,
          currency: 'BRL',
          memberships: {
            create: { userId, roleId: mockOwnerRole.id },
          },
        },
        include: {
          memberships: {
            where: { userId },
            include: { role: { include: { permissions: true } } },
          },
        },
      });
    });
  });

  describe('getUserOrganizations', () => {
    it('should return list of user organizations', async () => {
      const mockMembers = [
        {
          id: memberId,
          userId,
          organizationId: orgId,
          createdAt: new Date(),
          organization: mockOrganization,
          role: mockOwnerRole,
        },
        {
          id: 'member-2',
          userId,
          organizationId: 'org-2',
          createdAt: new Date(),
          organization: {
            id: 'org-2',
            name: 'Another Organization',
            description: null,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          role: {
            id: 'role-admin',
            name: 'Admin',
            description: 'Admin role',
            isSystem: false,
            color: '#0000FF',
            organizationId: 'org-2',
            permissions: [],
          },
        },
      ];

      mockPrisma.organizationMember.findMany.mockResolvedValue(mockMembers);

      const result = await service.getUserOrganizations(userId);

      expect(result.organizations).toHaveLength(2);
      expect(result.organizations[0].id).toBe(orgId);
      expect(result.organizations[1].id).toBe('org-2');
    });

    it('should return empty list when user has no organizations', async () => {
      mockPrisma.organizationMember.findMany.mockResolvedValue([]);

      const result = await service.getUserOrganizations(userId);

      expect(result.organizations).toHaveLength(0);
    });
  });

  describe('getOrganizationDetails', () => {
    it('should return organization details when user is member', async () => {
      const mockMember = {
        id: memberId,
        userId,
        organizationId: orgId,
        createdAt: new Date('2026-04-01'),
        organization: mockOrganization,
        role: mockOwnerRole,
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);

      const result = await service.getOrganizationDetails(userId, orgId);

      expect(result.id).toBe(orgId);
      expect(result.name).toBe('Test Organization');
      expect(result.role.name).toBe('Dono da Organização');
      expect(result.joinedAt).toEqual(mockMember.createdAt);
    });

    it('should throw ForbiddenException when user is not member', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      await expect(
        service.getOrganizationDetails(userId, orgId),
      ).rejects.toThrow(new ForbiddenException(ApiCode.ORGANIZATION_NOT_FOUND));
    });
  });

  describe('updateOrganization', () => {
    it('should update organization name and description', async () => {
      const mockMember = {
        id: memberId,
        userId,
        organizationId: orgId,
        createdAt: new Date(),
        role: mockOwnerRole,
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.organization.update.mockResolvedValue({
        id: orgId,
        name: 'Updated Organization',
        description: 'Updated description',
        currency: 'BRL',
        createdAt: new Date(),
      });

      const dto: UpdateOrganizationDto = {
        name: 'Updated Organization',
        description: 'Updated description',
      };

      const result = await service.updateOrganization(userId, orgId, dto);

      expect(result.message).toBe('Organization updated successfully');
      expect(result.organization.name).toBe('Updated Organization');
    });

    it('should throw ForbiddenException when user is not member', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      const dto: UpdateOrganizationDto = {
        name: 'Updated Organization',
      };

      await expect(
        service.updateOrganization(userId, orgId, dto),
      ).rejects.toThrow(new ForbiddenException(ApiCode.ORGANIZATION_NOT_FOUND));
    });

    it('should throw ForbiddenException when user does not have USERS.EDIT permission', async () => {
      const mockMember = {
        id: memberId,
        userId,
        organizationId: orgId,
        createdAt: new Date(),
        role: {
          id: 'role-viewer',
          name: 'Viewer',
          description: 'View only',
          isSystem: false,
          color: '#00FF00',
          organizationId: orgId,
          permissions: [
            {
              id: 'perm-1',
              module: 'USERS',
              actions: ['READ'],
              scope: 'ORGANIZATION',
            },
          ],
        },
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);

      const dto: UpdateOrganizationDto = {
        name: 'Updated Organization',
      };

      await expect(
        service.updateOrganization(userId, orgId, dto),
      ).rejects.toThrow(new ForbiddenException(ApiCode.ORGANIZATION_NOT_FOUND));
    });

    it('should only update fields that are provided', async () => {
      const mockMember = {
        id: memberId,
        userId,
        organizationId: orgId,
        createdAt: new Date(),
        role: mockOwnerRole,
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.organization.update.mockResolvedValue({
        id: orgId,
        name: 'Updated Name Only',
        description: 'Original description',
        currency: 'BRL',
        createdAt: new Date(),
      });

      const dto: UpdateOrganizationDto = {
        name: 'Updated Name Only',
      };

      await service.updateOrganization(userId, orgId, dto);

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: orgId },
        data: {
          name: 'Updated Name Only',
        },
        select: {
          id: true,
          name: true,
          description: true,
          currency: true,
          createdAt: true,
        },
      });
    });

    it('should allow updating only description when provided', async () => {
      const mockMember = {
        id: memberId,
        userId,
        organizationId: orgId,
        createdAt: new Date(),
        role: mockOwnerRole,
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.organization.update.mockResolvedValue({
        id: orgId,
        name: 'Original Name',
        description: 'Updated description',
        currency: 'BRL',
        createdAt: new Date(),
      });

      const dto: UpdateOrganizationDto = {
        description: 'Updated description',
      };

      await service.updateOrganization(userId, orgId, dto);

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: orgId },
        data: {
          description: 'Updated description',
        },
        select: {
          id: true,
          name: true,
          description: true,
          currency: true,
          createdAt: true,
        },
      });
    });

    it('should allow clearing description by setting it to undefined', async () => {
      const mockMember = {
        id: memberId,
        userId,
        organizationId: orgId,
        createdAt: new Date(),
        role: mockOwnerRole,
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.organization.update.mockResolvedValue({
        id: orgId,
        name: 'Test Organization',
        description: null,
        currency: 'BRL',
        createdAt: new Date(),
      });

      const dto: UpdateOrganizationDto = {
        description: undefined,
      };

      await service.updateOrganization(userId, orgId, dto);

      expect(mockPrisma.organization.update).toHaveBeenCalled();
    });
  });
});
