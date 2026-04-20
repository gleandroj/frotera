import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { JwtAuthenticatedRequest } from '@/auth/types/authenticated-request.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from '../auth/decorators/permission.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import { RoleActionEnum, RoleModuleEnum } from '../roles/roles.dto';
import {
  CreateMemberDto,
  CreateMemberResponseDto,
  DeleteMemberResponseDto,
  MembersListResponseDto,
  UpdateMemberDto,
  UpdateMemberResponseDto,
  AssignMemberVehiclesDto,
  AssignMemberDriversDto,
} from './members.dto';
import { MembersService } from './members.service';

@ApiTags('members')
@Controller('organizations/:organizationId/members')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @Permission(RoleModuleEnum.USERS, RoleActionEnum.VIEW)
  @ApiOperation({ summary: 'Get all members of an organization' })
  @ApiResponse({ status: 200, type: MembersListResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getMembers(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Query('customerId') customerId?: string,
    @Query('includeInactive') includeInactiveRaw?: string,
    @Query('activeOnly') activeOnlyRaw?: string,
    @Query('inactiveOnly') inactiveOnlyRaw?: string,
  ): Promise<MembersListResponseDto> {
    const activeOnly = activeOnlyRaw === 'true' || activeOnlyRaw === '1';
    const inactiveOnly = inactiveOnlyRaw === 'true' || inactiveOnlyRaw === '1';
    return this.membersService.getMembers(
      req.user.userId,
      organizationId,
      customerId ?? undefined,
      includeInactiveRaw === 'true',
      { activeOnly, inactiveOnly },
    );
  }

  @Post()
  @Permission(RoleModuleEnum.USERS, RoleActionEnum.CREATE)
  @ApiOperation({ summary: 'Create a new member (user) in the organization' })
  @ApiResponse({ status: 201, type: CreateMemberResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createMember(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Body() body: CreateMemberDto,
  ): Promise<CreateMemberResponseDto> {
    return this.membersService.createMember(req.user.userId, organizationId, body);
  }

  @Patch(':memberId')
  @Permission(RoleModuleEnum.USERS, RoleActionEnum.EDIT)
  @ApiOperation({ summary: 'Update member role and customer access' })
  @ApiResponse({ status: 200, type: UpdateMemberResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async updateMember(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Body() body: UpdateMemberDto,
  ): Promise<UpdateMemberResponseDto> {
    return this.membersService.updateMember(
      req.user.userId,
      organizationId,
      memberId,
      body,
    );
  }

  @Delete(':memberId')
  @Permission(RoleModuleEnum.USERS, RoleActionEnum.DELETE)
  @ApiOperation({ summary: 'Remove member from organization' })
  @ApiResponse({ status: 200, type: DeleteMemberResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async removeMember(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
  ): Promise<DeleteMemberResponseDto> {
    return this.membersService.removeMember(req.user.userId, organizationId, memberId);
  }

  @Patch(':memberId/enable')
  @Permission(RoleModuleEnum.USERS, RoleActionEnum.EDIT)
  @ApiOperation({ summary: 'Enable member in organization' })
  @ApiResponse({ status: 200, type: DeleteMemberResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async enableMember(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
  ): Promise<DeleteMemberResponseDto> {
    return this.membersService.enableMember(req.user.userId, organizationId, memberId);
  }

  @Patch(':memberId/vehicles')
  @Permission(RoleModuleEnum.USERS, RoleActionEnum.EDIT)
  @ApiOperation({ summary: 'Assign vehicles to a member' })
  @ApiResponse({ status: 200, description: 'Member vehicles updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async setMemberVehicles(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Body() dto: AssignMemberVehiclesDto,
  ): Promise<{ message: string }> {
    await this.membersService.setMemberVehicles(organizationId, memberId, dto.vehicleIds);
    return { message: 'Member vehicles updated' };
  }

  @Patch(':memberId/drivers')
  @Permission(RoleModuleEnum.USERS, RoleActionEnum.EDIT)
  @ApiOperation({ summary: 'Assign drivers to a member' })
  @ApiResponse({ status: 200, description: 'Member drivers updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async setMemberDrivers(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Body() dto: AssignMemberDriversDto,
  ): Promise<{ message: string }> {
    await this.membersService.setMemberDrivers(organizationId, memberId, dto.driverIds);
    return { message: 'Member drivers updated' };
  }
}