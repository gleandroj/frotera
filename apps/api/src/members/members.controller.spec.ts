import { Test, TestingModule } from '@nestjs/testing';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMemberDto, UpdateMemberDto } from './members.dto';

describe('MembersController', () => {
  let controller: MembersController;
  let service: MembersService;

  const mockMembersService = {
    getMembers: jest.fn(),
    createMember: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn(),
  };

  const userId = 'user-1';
  const orgId = 'org-1';
  const memberId = 'member-1';

  const mockMemberResponse = {
    id: memberId,
    role: {
      id: 'role-1',
      name: 'Custom Role',
      description: 'Custom description',
      isSystem: false,
      color: '#ff0000',
      organizationId: orgId,
      permissions: [
        {
          id: 'perm-1',
          module: 'VEHICLES',
          actions: ['VIEW', 'CREATE'],
          scope: 'ALL',
        },
      ],
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
    joinedAt: new Date('2024-01-02'),
    customerRestricted: false,
    customers: [],
    user: {
      id: memberId,
      email: 'user@example.com',
      name: 'User Name',
      createdAt: new Date('2024-01-02'),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembersController],
      providers: [
        {
          provide: MembersService,
          useValue: mockMembersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MembersController>(MembersController);
    service = module.get<MembersService>(MembersService);
  });

  describe('getMembers', () => {
    it('should call membersService.getMembers with userId and organizationId', async () => {
      const mockResponse = {
        memberships: [mockMemberResponse],
      };
      mockMembersService.getMembers.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.getMembers(req, orgId);

      expect(mockMembersService.getMembers).toHaveBeenCalledWith(
        userId,
        orgId,
        undefined,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should pass customerId filter to service when provided', async () => {
      const customerId = 'customer-1';
      const mockResponse = {
        memberships: [mockMemberResponse],
      };
      mockMembersService.getMembers.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.getMembers(req, orgId, customerId);

      expect(mockMembersService.getMembers).toHaveBeenCalledWith(
        userId,
        orgId,
        customerId,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle undefined customerId as undefined', async () => {
      const mockResponse = {
        memberships: [mockMemberResponse],
      };
      mockMembersService.getMembers.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      await controller.getMembers(req, orgId, undefined);

      expect(mockMembersService.getMembers).toHaveBeenCalledWith(
        userId,
        orgId,
        undefined,
      );
    });
  });

  describe('createMember', () => {
    it('should call membersService.createMember with userId, organizationId, and body', async () => {
      const createMemberDto: CreateMemberDto = {
        email: 'newuser@example.com',
        password: 'SecurePassword123',
        name: 'New User',
        roleId: 'role-1',
      };

      const mockResponse = {
        message: 'MEMBER_CREATED_SUCCESSFULLY',
        member: mockMemberResponse,
      };
      mockMembersService.createMember.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.createMember(req, orgId, createMemberDto);

      expect(mockMembersService.createMember).toHaveBeenCalledWith(
        userId,
        orgId,
        createMemberDto,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle all optional fields in createMemberDto', async () => {
      const createMemberDto: CreateMemberDto = {
        email: 'newuser@example.com',
        password: 'SecurePassword123',
        roleId: 'role-1',
        name: 'New User',
        customerRestricted: true,
        customerIds: ['customer-1', 'customer-2'],
      };

      const mockResponse = {
        message: 'MEMBER_CREATED_SUCCESSFULLY',
        member: {
          ...mockMemberResponse,
          customerRestricted: true,
          customers: [
            { id: 'customer-1', name: 'Customer 1' },
            { id: 'customer-2', name: 'Customer 2' },
          ],
        },
      };
      mockMembersService.createMember.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.createMember(req, orgId, createMemberDto);

      expect(mockMembersService.createMember).toHaveBeenCalledWith(
        userId,
        orgId,
        createMemberDto,
      );
      expect(result.member.customerRestricted).toBe(true);
    });
  });

  describe('updateMember', () => {
    it('should call membersService.updateMember with userId, organizationId, memberId, and body', async () => {
      const updateMemberDto: UpdateMemberDto = {
        roleId: 'role-2',
      };

      const mockResponse = {
        message: 'MEMBER_ROLE_UPDATED_SUCCESSFULLY',
        member: {
          ...mockMemberResponse,
          role: {
            ...mockMemberResponse.role,
            id: 'role-2',
            name: 'New Role',
          },
        },
      };
      mockMembersService.updateMember.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.updateMember(req, orgId, memberId, updateMemberDto);

      expect(mockMembersService.updateMember).toHaveBeenCalledWith(
        userId,
        orgId,
        memberId,
        updateMemberDto,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle all optional fields in updateMemberDto', async () => {
      const updateMemberDto: UpdateMemberDto = {
        roleId: 'role-2',
        name: 'Updated Name',
        email: 'updated@example.com',
        newPassword: 'NewPassword123',
        customerRestricted: true,
        customerIds: ['customer-1'],
      };

      const mockResponse = {
        message: 'MEMBER_ROLE_UPDATED_SUCCESSFULLY',
        member: {
          ...mockMemberResponse,
          user: {
            ...mockMemberResponse.user,
            name: updateMemberDto.name,
            email: updateMemberDto.email,
          },
          customerRestricted: true,
          customers: [{ id: 'customer-1', name: 'Customer 1' }],
        },
      };
      mockMembersService.updateMember.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.updateMember(req, orgId, memberId, updateMemberDto);

      expect(mockMembersService.updateMember).toHaveBeenCalledWith(
        userId,
        orgId,
        memberId,
        updateMemberDto,
      );
      expect(result.member.user.email).toBe(updateMemberDto.email);
    });

    it('should handle partial updates', async () => {
      const updateMemberDto: UpdateMemberDto = {
        name: 'Updated Name',
      };

      const mockResponse = {
        message: 'MEMBER_ROLE_UPDATED_SUCCESSFULLY',
        member: {
          ...mockMemberResponse,
          user: {
            ...mockMemberResponse.user,
            name: updateMemberDto.name,
          },
        },
      };
      mockMembersService.updateMember.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.updateMember(req, orgId, memberId, updateMemberDto);

      expect(mockMembersService.updateMember).toHaveBeenCalledWith(
        userId,
        orgId,
        memberId,
        updateMemberDto,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('removeMember', () => {
    it('should call membersService.removeMember with userId, organizationId, and memberId', async () => {
      const mockResponse = {
        message: 'MEMBER_REMOVED_SUCCESSFULLY',
      };
      mockMembersService.removeMember.mockResolvedValueOnce(mockResponse);

      const req = {
        user: { userId },
      } as any;

      const result = await controller.removeMember(req, orgId, memberId);

      expect(mockMembersService.removeMember).toHaveBeenCalledWith(
        userId,
        orgId,
        memberId,
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
