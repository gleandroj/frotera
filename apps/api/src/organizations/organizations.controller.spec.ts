import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '@/auth/guards/super-admin.guard';
import {
  CreateOrganizationDto,
  CreateOrganizationResponseDto,
  OrganizationResponseDto,
  OrganizationsListResponseDto,
  UpdateOrganizationDto,
  UpdateOrganizationResponseDto,
} from './organizations.dto';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let service: OrganizationsService;

  const mockOrganizationsService = {
    createOrganization: jest.fn(),
    getUserOrganizations: jest.fn(),
    getOrganizationDetails: jest.fn(),
    updateOrganization: jest.fn(),
  };

  // Test data
  const userId = 'user-1';
  const orgId = 'org-1';

  const mockRole = {
    id: 'role-owner',
    name: 'Dono da Organização',
    description: 'Owner role',
    isSystem: true,
    color: '#FF0000',
    permissions: [
      {
        id: 'perm-1',
        module: 'USERS',
        actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EDIT'],
        scope: 'ORGANIZATION',
      },
    ],
  };

  const mockOrganizationDto: OrganizationResponseDto = {
    id: orgId,
    name: 'Test Organization',
    description: 'A test organization',
    currency: 'BRL',
    createdAt: new Date(),
    role: mockRole,
    joinedAt: new Date(),
  };

  const mockRequest = {
    user: {
      userId,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        {
          provide: OrganizationsService,
          useValue: mockOrganizationsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(SuperAdminGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
    service = module.get<OrganizationsService>(OrganizationsService);
  });

  describe('createOrganization', () => {
    it('should call organizationsService.createOrganization with user context', async () => {
      const response: CreateOrganizationResponseDto = {
        message: 'Organization created successfully',
        organization: mockOrganizationDto,
      };

      mockOrganizationsService.createOrganization.mockResolvedValue(response);

      const dto: CreateOrganizationDto = {
        name: 'Test Organization',
        description: 'A test organization',
      };

      const result = await controller.createOrganization(
        mockRequest as any,
        dto,
      );

      expect(mockOrganizationsService.createOrganization).toHaveBeenCalledWith(
        userId,
        dto,
      );
      expect(result.message).toBe('Organization created successfully');
      expect(result.organization.id).toBe(orgId);
    });

    it('should pass only name when description is not provided', async () => {
      const response: CreateOrganizationResponseDto = {
        message: 'Organization created successfully',
        organization: {
          ...mockOrganizationDto,
          description: null,
        },
      };

      mockOrganizationsService.createOrganization.mockResolvedValue(response);

      const dto: CreateOrganizationDto = {
        name: 'Test Organization',
      };

      await controller.createOrganization(mockRequest as any, dto);

      expect(mockOrganizationsService.createOrganization).toHaveBeenCalledWith(
        userId,
        dto,
      );
    });

    it('should require SuperAdminGuard', async () => {
      const response: CreateOrganizationResponseDto = {
        message: 'Organization created successfully',
        organization: mockOrganizationDto,
      };

      mockOrganizationsService.createOrganization.mockResolvedValue(response);

      const dto: CreateOrganizationDto = {
        name: 'Test Organization',
      };

      const result = await controller.createOrganization(
        mockRequest as any,
        dto,
      );

      expect(result).toBeDefined();
    });
  });

  describe('getUserOrganizations', () => {
    it('should call organizationsService.getUserOrganizations with user context', async () => {
      const response: OrganizationsListResponseDto = {
        organizations: [mockOrganizationDto],
      };

      mockOrganizationsService.getUserOrganizations.mockResolvedValue(response);

      const result = await controller.getUserOrganizations(mockRequest as any);

      expect(
        mockOrganizationsService.getUserOrganizations,
      ).toHaveBeenCalledWith(userId);
      expect(result.organizations).toHaveLength(1);
      expect(result.organizations[0].id).toBe(orgId);
    });

    it('should return empty list when user has no organizations', async () => {
      const response: OrganizationsListResponseDto = {
        organizations: [],
      };

      mockOrganizationsService.getUserOrganizations.mockResolvedValue(response);

      const result = await controller.getUserOrganizations(mockRequest as any);

      expect(result.organizations).toHaveLength(0);
    });

    it('should return multiple organizations', async () => {
      const response: OrganizationsListResponseDto = {
        organizations: [
          mockOrganizationDto,
          {
            ...mockOrganizationDto,
            id: 'org-2',
            name: 'Another Organization',
            currency: 'USD',
          },
        ],
      };

      mockOrganizationsService.getUserOrganizations.mockResolvedValue(response);

      const result = await controller.getUserOrganizations(mockRequest as any);

      expect(result.organizations).toHaveLength(2);
    });
  });

  describe('getOrganizationDetails', () => {
    it('should call organizationsService.getOrganizationDetails with user and org context', async () => {
      mockOrganizationsService.getOrganizationDetails.mockResolvedValue(
        mockOrganizationDto,
      );

      const result = await controller.getOrganizationDetails(
        mockRequest as any,
        orgId,
      );

      expect(
        mockOrganizationsService.getOrganizationDetails,
      ).toHaveBeenCalledWith(userId, orgId);
      expect(result.id).toBe(orgId);
      expect(result.name).toBe('Test Organization');
    });

    it('should include user role in response', async () => {
      mockOrganizationsService.getOrganizationDetails.mockResolvedValue(
        mockOrganizationDto,
      );

      const result = await controller.getOrganizationDetails(
        mockRequest as any,
        orgId,
      );

      expect(result.role).toBeDefined();
      expect(result.role.name).toBe('Dono da Organização');
      expect(result.joinedAt).toBeDefined();
    });

    it('should include organization permissions in role', async () => {
      mockOrganizationsService.getOrganizationDetails.mockResolvedValue(
        mockOrganizationDto,
      );

      const result = await controller.getOrganizationDetails(
        mockRequest as any,
        orgId,
      );

      expect(result.role.permissions).toBeDefined();
      expect(result.role.permissions).toHaveLength(1);
      expect(result.role.permissions[0].module).toBe('USERS');
    });
  });

  describe('updateOrganization', () => {
    it('should call organizationsService.updateOrganization with user and org context', async () => {
      const response: UpdateOrganizationResponseDto = {
        message: 'Organization updated successfully',
        organization: {
          ...mockOrganizationDto,
          name: 'Updated Organization',
        },
      };

      mockOrganizationsService.updateOrganization.mockResolvedValue(response);

      const dto: UpdateOrganizationDto = {
        name: 'Updated Organization',
      };

      const result = await controller.updateOrganization(
        mockRequest as any,
        orgId,
        dto,
      );

      expect(
        mockOrganizationsService.updateOrganization,
      ).toHaveBeenCalledWith(userId, orgId, dto);
      expect(result.message).toBe('Organization updated successfully');
      expect(result.organization.name).toBe('Updated Organization');
    });

    it('should update only name when only name is provided', async () => {
      const response: UpdateOrganizationResponseDto = {
        message: 'Organization updated successfully',
        organization: {
          ...mockOrganizationDto,
          name: 'New Name',
        },
      };

      mockOrganizationsService.updateOrganization.mockResolvedValue(response);

      const dto: UpdateOrganizationDto = {
        name: 'New Name',
      };

      await controller.updateOrganization(mockRequest as any, orgId, dto);

      expect(
        mockOrganizationsService.updateOrganization,
      ).toHaveBeenCalledWith(userId, orgId, dto);
    });

    it('should update only description when only description is provided', async () => {
      const response: UpdateOrganizationResponseDto = {
        message: 'Organization updated successfully',
        organization: {
          ...mockOrganizationDto,
          description: 'New Description',
        },
      };

      mockOrganizationsService.updateOrganization.mockResolvedValue(response);

      const dto: UpdateOrganizationDto = {
        description: 'New Description',
      };

      await controller.updateOrganization(mockRequest as any, orgId, dto);

      expect(
        mockOrganizationsService.updateOrganization,
      ).toHaveBeenCalledWith(userId, orgId, dto);
    });

    it('should update both name and description when both are provided', async () => {
      const response: UpdateOrganizationResponseDto = {
        message: 'Organization updated successfully',
        organization: {
          ...mockOrganizationDto,
          name: 'Updated Name',
          description: 'Updated Description',
        },
      };

      mockOrganizationsService.updateOrganization.mockResolvedValue(response);

      const dto: UpdateOrganizationDto = {
        name: 'Updated Name',
        description: 'Updated Description',
      };

      await controller.updateOrganization(mockRequest as any, orgId, dto);

      expect(
        mockOrganizationsService.updateOrganization,
      ).toHaveBeenCalledWith(userId, orgId, dto);
    });

    it('should return updated organization in response', async () => {
      const updated = {
        ...mockOrganizationDto,
        name: 'Updated Organization',
      };

      const response: UpdateOrganizationResponseDto = {
        message: 'Organization updated successfully',
        organization: updated,
      };

      mockOrganizationsService.updateOrganization.mockResolvedValue(response);

      const dto: UpdateOrganizationDto = {
        name: 'Updated Organization',
      };

      const result = await controller.updateOrganization(
        mockRequest as any,
        orgId,
        dto,
      );

      expect(result.organization.name).toBe('Updated Organization');
      expect(result.organization.id).toBe(orgId);
    });
  });
});
