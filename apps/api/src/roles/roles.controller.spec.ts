import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateRoleDto,
  RoleActionEnum,
  RoleModuleEnum,
  RoleScopeEnum,
  UpdateRoleDto,
} from './roles.dto';

describe('RolesController', () => {
  let controller: RolesController;
  let service: RolesService;

  const mockRolesService = {
    getRoles: jest.fn(),
    getRole: jest.fn(),
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
  };

  const userId = 'user-1';
  const orgId = 'org-1';
  const roleId = 'role-1';

  const mockRoleResponse = {
    id: roleId,
    name: 'Custom Role',
    description: 'Custom description',
    isSystem: false,
    color: '#ff0000',
    organizationId: orgId,
    permissions: [
      {
        id: 'perm-1',
        module: RoleModuleEnum.VEHICLES,
        actions: [RoleActionEnum.VIEW, RoleActionEnum.CREATE],
        scope: RoleScopeEnum.ALL,
      },
    ],
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RolesController>(RolesController);
    service = module.get<RolesService>(RolesService);
  });

  describe('getRoles', () => {
    it('should call rolesService.getRoles with userId and organizationId', async () => {
      const mockResponse = {
        roles: [mockRoleResponse],
      };
      mockRolesService.getRoles.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.getRoles(req, orgId);

      expect(mockRolesService.getRoles).toHaveBeenCalledWith(userId, orgId);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getRole', () => {
    it('should call rolesService.getRole with userId, organizationId, and roleId', async () => {
      mockRolesService.getRole.mockResolvedValueOnce(mockRoleResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.getRole(req, orgId, roleId);

      expect(mockRolesService.getRole).toHaveBeenCalledWith(userId, orgId, roleId);
      expect(result).toEqual(mockRoleResponse);
    });
  });

  describe('createRole', () => {
    it('should call rolesService.createRole with userId, organizationId, and body', async () => {
      const createRoleDto: CreateRoleDto = {
        name: 'New Role',
        description: 'New description',
        color: '#00ff00',
        permissions: [
          {
            module: RoleModuleEnum.USERS,
            actions: [RoleActionEnum.VIEW],
            scope: RoleScopeEnum.ALL,
          },
        ],
      };

      const mockResponse = {
        message: 'ROLE_CREATED_SUCCESSFULLY',
        role: mockRoleResponse,
      };
      mockRolesService.createRole.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.createRole(req, orgId, createRoleDto);

      expect(mockRolesService.createRole).toHaveBeenCalledWith(
        userId,
        orgId,
        createRoleDto,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateRole', () => {
    it('should call rolesService.updateRole with userId, organizationId, roleId, and body', async () => {
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

      const mockResponse = {
        message: 'ROLE_UPDATED_SUCCESSFULLY',
        role: {
          ...mockRoleResponse,
          ...updateRoleDto,
        },
      };
      mockRolesService.updateRole.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.updateRole(req, orgId, roleId, updateRoleDto);

      expect(mockRolesService.updateRole).toHaveBeenCalledWith(
        userId,
        orgId,
        roleId,
        updateRoleDto,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteRole', () => {
    it('should call rolesService.deleteRole with userId, organizationId, and roleId', async () => {
      const mockResponse = {
        message: 'ROLE_DELETED_SUCCESSFULLY',
      };
      mockRolesService.deleteRole.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.deleteRole(req, orgId, roleId);

      expect(mockRolesService.deleteRole).toHaveBeenCalledWith(
        userId,
        orgId,
        roleId,
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
