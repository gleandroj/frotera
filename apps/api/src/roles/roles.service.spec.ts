import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRoleDto,
  RoleActionEnum,
  RoleModuleEnum,
  RoleScopeEnum,
  UpdateRoleDto,
} from './roles.dto';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: PrismaService;

  const mockPrisma = {
    organizationMember: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    rolePermission: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const userId = 'user-1';
  const orgId = 'org-1';
  const roleId = 'role-1';

  const mockMembershipWithUsersEdit = {
    id: 'member-1',
    userId,
    organizationId: orgId,
    roleId: 'role-admin',
    role: {
      permissions: [
        {
          id: 'perm-1',
          module: RoleModuleEnum.USERS,
          actions: [
            RoleActionEnum.VIEW,
            RoleActionEnum.EDIT,
            RoleActionEnum.CREATE,
            RoleActionEnum.DELETE,
          ],
          scope: RoleScopeEnum.ALL,
        },
      ],
    },
  };

  const mockMembershipWithoutEdit = {
    ...mockMembershipWithUsersEdit,
    role: {
      permissions: [
        {
          id: 'perm-1',
          module: RoleModuleEnum.USERS,
          actions: [RoleActionEnum.VIEW],
          scope: RoleScopeEnum.ALL,
        },
      ],
    },
  };

  const mockSystemRole = {
    id: 'system-role-1',
    name: 'OWNER',
    isSystem: true,
    organizationId: null,
    color: '#000000',
    description: null,
    permissions: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockCustomRole = {
    id: roleId,
    name: 'Custom Role',
    isSystem: false,
    organizationId: orgId,
    color: '#ff0000',
    description: 'Custom',
    permissions: [],
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getRoles', () => {
    it('should throw ForbiddenException if user is not a member', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(null);

      await expect(service.getRoles(userId, orgId)).rejects.toThrow(
        new ForbiddenException('AUTH_FORBIDDEN'),
      );
    });

    it('should return list of roles (system + custom) formatted', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findMany.mockResolvedValueOnce([
        mockSystemRole,
        mockCustomRole,
      ]);

      const result = await service.getRoles(userId, orgId);

      expect(result).toEqual({
        roles: expect.arrayContaining([
          expect.objectContaining({
            id: mockSystemRole.id,
            name: mockSystemRole.name,
            isSystem: true,
          }),
          expect.objectContaining({
            id: mockCustomRole.id,
            name: mockCustomRole.name,
            isSystem: false,
          }),
        ]),
      });
      expect(mockPrisma.role.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ organizationId: null }, { organizationId: orgId }],
        },
        include: { permissions: true },
        orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('getRole', () => {
    it('should throw ForbiddenException if user is not a member', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(null);

      await expect(service.getRole(userId, orgId, roleId)).rejects.toThrow(
        new ForbiddenException('AUTH_FORBIDDEN'),
      );
    });

    it('should throw NotFoundException if role is not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(null);

      await expect(service.getRole(userId, orgId, roleId)).rejects.toThrow(
        new NotFoundException('ROLE_NOT_FOUND'),
      );
    });

    it('should return formatted role', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(mockCustomRole);

      const result = await service.getRole(userId, orgId, roleId);

      expect(result).toEqual(
        expect.objectContaining({
          id: mockCustomRole.id,
          name: mockCustomRole.name,
          isSystem: mockCustomRole.isSystem,
          color: mockCustomRole.color,
        }),
      );
    });
  });

  describe('createRole', () => {
    const createRoleDto: CreateRoleDto = {
      name: 'New Role',
      description: 'New role description',
      color: '#00ff00',
      permissions: [
        {
          module: RoleModuleEnum.VEHICLES,
          actions: [RoleActionEnum.VIEW, RoleActionEnum.CREATE],
          scope: RoleScopeEnum.ALL,
        },
      ],
    };

    it('should throw ForbiddenException if user does not have USERS:EDIT permission', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithoutEdit,
      );

      await expect(
        service.createRole(userId, orgId, createRoleDto),
      ).rejects.toThrow(new ForbiddenException('AUTH_FORBIDDEN'));
    });

    it('should throw BadRequestException if role name already exists', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(mockCustomRole);

      await expect(
        service.createRole(userId, orgId, createRoleDto),
      ).rejects.toThrow(
        new BadRequestException('ROLE_NAME_ALREADY_EXISTS'),
      );
    });

    it('should create role with permissions and return ROLE_CREATED_SUCCESSFULLY', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(null);
      mockPrisma.role.create.mockResolvedValueOnce({
        ...mockCustomRole,
        name: createRoleDto.name,
        description: createRoleDto.description,
        color: createRoleDto.color,
        permissions: createRoleDto.permissions,
      });

      const result = await service.createRole(userId, orgId, createRoleDto);

      expect(result.message).toBe('ROLE_CREATED_SUCCESSFULLY');
      expect(result.role).toEqual(
        expect.objectContaining({
          name: createRoleDto.name,
          description: createRoleDto.description,
        }),
      );
      expect(mockPrisma.role.create).toHaveBeenCalledWith({
        data: {
          name: createRoleDto.name,
          description: createRoleDto.description,
          color: createRoleDto.color,
          isSystem: false,
          organizationId: orgId,
          permissions: {
            create: expect.arrayContaining([
              expect.objectContaining({
                module: RoleModuleEnum.VEHICLES,
                actions: [RoleActionEnum.VIEW, RoleActionEnum.CREATE],
                scope: RoleScopeEnum.ALL,
              }),
            ]),
          },
        },
        include: { permissions: true },
      });
    });
  });

  describe('updateRole', () => {
    const updateRoleDto: UpdateRoleDto = {
      name: 'Updated Role',
      description: 'Updated description',
      color: '#0000ff',
      permissions: [
        {
          module: RoleModuleEnum.REPORTS,
          actions: [RoleActionEnum.VIEW, RoleActionEnum.EDIT],
          scope: RoleScopeEnum.ASSIGNED,
        },
      ],
    };

    it('should throw ForbiddenException if user does not have USERS:EDIT permission', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithoutEdit,
      );

      await expect(
        service.updateRole(userId, orgId, roleId, updateRoleDto),
      ).rejects.toThrow(new ForbiddenException('AUTH_FORBIDDEN'));
    });

    it('should throw NotFoundException if role is not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateRole(userId, orgId, roleId, updateRoleDto),
      ).rejects.toThrow(new NotFoundException('ROLE_NOT_FOUND'));
    });

    it('should throw ForbiddenException if role is system', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(mockSystemRole);

      await expect(
        service.updateRole(userId, orgId, roleId, updateRoleDto),
      ).rejects.toThrow(
        new ForbiddenException('ROLE_SYSTEM_CANNOT_MODIFY'),
      );
    });

    it('should update role and return ROLE_UPDATED_SUCCESSFULLY', async () => {
      const updatedRole = {
        ...mockCustomRole,
        name: updateRoleDto.name,
        description: updateRoleDto.description,
        color: updateRoleDto.color,
        permissions: updateRoleDto.permissions,
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(mockCustomRole);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        await fn(mockPrisma);
        return updatedRole;
      });
      mockPrisma.role.findUniqueOrThrow.mockResolvedValueOnce(updatedRole);

      const result = await service.updateRole(userId, orgId, roleId, updateRoleDto);

      expect(result.message).toBe('ROLE_UPDATED_SUCCESSFULLY');
      expect(result.role).toEqual(
        expect.objectContaining({
          name: updateRoleDto.name,
          description: updateRoleDto.description,
          color: updateRoleDto.color,
        }),
      );
    });

    it('should update permissions inside transaction', async () => {
      const updatedRole = {
        ...mockCustomRole,
        permissions: updateRoleDto.permissions,
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(mockCustomRole);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        await fn(mockPrisma);
        return updatedRole;
      });
      mockPrisma.role.findUniqueOrThrow.mockResolvedValueOnce(updatedRole);

      await service.updateRole(userId, orgId, roleId, updateRoleDto);

      expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId },
      });
      expect(mockPrisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            roleId,
            module: RoleModuleEnum.REPORTS,
            actions: [RoleActionEnum.VIEW, RoleActionEnum.EDIT],
            scope: RoleScopeEnum.ASSIGNED,
          }),
        ]),
      });
    });
  });

  describe('deleteRole', () => {
    it('should throw ForbiddenException if user does not have USERS:EDIT permission', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithoutEdit,
      );

      await expect(service.deleteRole(userId, orgId, roleId)).rejects.toThrow(
        new ForbiddenException('AUTH_FORBIDDEN'),
      );
    });

    it('should throw NotFoundException if role is not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(null);

      await expect(service.deleteRole(userId, orgId, roleId)).rejects.toThrow(
        new NotFoundException('ROLE_NOT_FOUND'),
      );
    });

    it('should throw ForbiddenException if role is system', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(mockSystemRole);

      await expect(service.deleteRole(userId, orgId, roleId)).rejects.toThrow(
        new ForbiddenException('ROLE_SYSTEM_CANNOT_DELETE'),
      );
    });

    it('should throw BadRequestException if role is in use', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(mockCustomRole);
      mockPrisma.organizationMember.count.mockResolvedValueOnce(2);

      await expect(service.deleteRole(userId, orgId, roleId)).rejects.toThrow(
        new BadRequestException('ROLE_IN_USE_CANNOT_DELETE'),
      );
    });

    it('should delete role and return ROLE_DELETED_SUCCESSFULLY', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(
        mockMembershipWithUsersEdit,
      );
      mockPrisma.role.findFirst.mockResolvedValueOnce(mockCustomRole);
      mockPrisma.organizationMember.count.mockResolvedValueOnce(0);
      mockPrisma.role.delete.mockResolvedValueOnce(mockCustomRole);

      const result = await service.deleteRole(userId, orgId, roleId);

      expect(result.message).toBe('ROLE_DELETED_SUCCESSFULLY');
      expect(mockPrisma.role.delete).toHaveBeenCalledWith({
        where: { id: roleId },
      });
    });
  });
});
