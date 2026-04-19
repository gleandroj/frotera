import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { JwtAuthenticatedRequest } from '@/auth/types/authenticated-request.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateRoleDto,
  RoleCreatedResponseDto,
  RoleDeletedResponseDto,
  RoleResponseDto,
  RolesListResponseDto,
  RoleUpdatedResponseDto,
  UpdateRoleDto,
} from './roles.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@Controller('organizations/:organizationId/roles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles for an organization (system + custom)' })
  @ApiResponse({ status: 200, type: RolesListResponseDto })
  async getRoles(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
  ): Promise<RolesListResponseDto> {
    return this.rolesService.getRoles(req.user.userId, organizationId);
  }

  @Get(':roleId')
  @ApiOperation({ summary: 'Get a specific role' })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  async getRole(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('roleId') roleId: string,
  ): Promise<RoleResponseDto> {
    return this.rolesService.getRole(req.user.userId, organizationId, roleId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom role for the organization' })
  @ApiResponse({ status: 201, type: RoleCreatedResponseDto })
  async createRole(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Body() body: CreateRoleDto,
  ): Promise<RoleCreatedResponseDto> {
    return this.rolesService.createRole(req.user.userId, organizationId, body);
  }

  @Patch(':roleId')
  @ApiOperation({ summary: 'Update a custom role' })
  @ApiResponse({ status: 200, type: RoleUpdatedResponseDto })
  async updateRole(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('roleId') roleId: string,
    @Body() body: UpdateRoleDto,
  ): Promise<RoleUpdatedResponseDto> {
    return this.rolesService.updateRole(req.user.userId, organizationId, roleId, body);
  }

  @Delete(':roleId')
  @ApiOperation({ summary: 'Delete a custom role (cannot delete system roles)' })
  @ApiResponse({ status: 200, type: RoleDeletedResponseDto })
  async deleteRole(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('roleId') roleId: string,
  ): Promise<RoleDeletedResponseDto> {
    return this.rolesService.deleteRole(req.user.userId, organizationId, roleId);
  }
}
