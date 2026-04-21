import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { OrgScopedRequest } from '@/auth/types/authenticated-request.types';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '@/auth/guards/permission.guard';
import { Permission } from '@/auth/decorators/permission.decorator';
import { OrganizationMemberGuard } from '@/organizations/guards/organization-member.guard';
import { RoleActionEnum, RoleModuleEnum } from '@/roles/roles.dto';
import {
  CreateReferencePointDto,
  UpdateReferencePointDto,
  ReferencePointResponseDto,
} from './dto/reference-point.dto';
import { ReferencePointsService } from './reference-points.service';

@ApiTags('reference-points')
@Controller('organizations/:organizationId/reference-points')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class ReferencePointsController {
  constructor(private readonly referencePointsService: ReferencePointsService) {}

  @Get()
  @Permission(RoleModuleEnum.REFERENCE_POINTS, RoleActionEnum.VIEW)
  @ApiOperation({ summary: 'List reference points' })
  @ApiResponse({ status: 200, type: [ReferencePointResponseDto] })
  async findAll(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query('customerId') customerId?: string,
    @Query('active') activeRaw?: string,
  ) {
    const active = activeRaw === 'true' || activeRaw === '1' ? true : activeRaw === 'false' || activeRaw === '0' ? false : undefined;
    return this.referencePointsService.findAll(organizationId, {
      customerId,
      active,
    });
  }

  @Post()
  @Permission(RoleModuleEnum.REFERENCE_POINTS, RoleActionEnum.CREATE)
  @ApiOperation({ summary: 'Create reference point' })
  @ApiResponse({ status: 201, type: ReferencePointResponseDto })
  async create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateReferencePointDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.referencePointsService.create(organizationId, dto);
  }

  @Patch(':id')
  @Permission(RoleModuleEnum.REFERENCE_POINTS, RoleActionEnum.EDIT)
  @ApiOperation({ summary: 'Update reference point' })
  @ApiResponse({ status: 200, type: ReferencePointResponseDto })
  async update(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReferencePointDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.referencePointsService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @Permission(RoleModuleEnum.REFERENCE_POINTS, RoleActionEnum.DELETE)
  @ApiOperation({ summary: 'Delete reference point' })
  @ApiResponse({ status: 200 })
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Request() req: OrgScopedRequest,
  ) {
    return this.referencePointsService.remove(organizationId, id);
  }
}
