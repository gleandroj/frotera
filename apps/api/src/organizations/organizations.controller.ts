import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { CreateOrganizationDto, CreateOrganizationResponseDto, OrganizationResponseDto, OrganizationsListResponseDto, UpdateOrganizationDto, UpdateOrganizationResponseDto } from './organizations.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Create a new organization (superadmin only)' })
  @ApiResponse({ status: 201, type: CreateOrganizationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Superadmin only' })
  async createOrganization(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() body: CreateOrganizationDto,
  ): Promise<CreateOrganizationResponseDto> {
    return this.organizationsService.createOrganization(req.user.userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organizations for the current user' })
  @ApiResponse({ status: 200, type: OrganizationsListResponseDto })
  async getUserOrganizations(
    @Request() req: ExpressRequest & { user: { userId: string } },
  ): Promise<OrganizationsListResponseDto> {
    return this.organizationsService.getUserOrganizations(req.user.userId);
  }

  @Get(':organizationId')
  @ApiOperation({ summary: 'Get organization details' })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getOrganizationDetails(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Param('organizationId') organizationId: string,
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.getOrganizationDetails(req.user.userId, organizationId);
  }

  @Patch(':organizationId')
  @ApiOperation({ summary: 'Update organization details' })
  @ApiResponse({ status: 200, type: UpdateOrganizationResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden - Only OWNER and ADMIN can update organization' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updateOrganization(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateOrganizationDto,
  ): Promise<UpdateOrganizationResponseDto> {
    return this.organizationsService.updateOrganization(req.user.userId, organizationId, body);
  }
}