import {
  Body, Controller, Delete, Get, Param, Patch, Post,
  Query, Request, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import type { OrganizationMember } from '@prisma/client';
import type { OrgScopedRequest } from '@/auth/types/authenticated-request.types';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '@/auth/guards/permission.guard';
import { Permission } from '@/auth/decorators/permission.decorator';
import { OrganizationMemberGuard } from '@/organizations/guards/organization-member.guard';
import { RoleActionEnum, RoleModuleEnum } from '@/roles/roles.dto';
import { DriversService } from './drivers.service';
import {
  AssignVehicleDto,
  CreateDriverDto,
  DriverResponseDto,
  DriversListResponseDto,
  UpdateDriverDto,
} from './drivers.dto';

function memberFromRequest(req: OrgScopedRequest): Pick<OrganizationMember, 'id' | 'customerRestricted'> {
  return {
    id: req.organizationMember.id,
    customerRestricted: req.organizationMember.customerRestricted,
  };
}

@ApiTags('drivers')
@Controller('organizations/:organizationId/drivers')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @Permission(RoleModuleEnum.DRIVERS, RoleActionEnum.VIEW)
  @ApiOperation({ summary: 'List drivers in an organization' })
  @ApiResponse({ status: 200, type: DriversListResponseDto })
  async list(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query('customerId') customerId?: string,
    @Query('activeOnly') activeOnlyRaw?: string,
    @Query('inactiveOnly') inactiveOnlyRaw?: string,
  ): Promise<DriversListResponseDto> {
    const activeOnly = activeOnlyRaw === 'true' || activeOnlyRaw === '1';
    const inactiveOnly = inactiveOnlyRaw === 'true' || inactiveOnlyRaw === '1';
    const member = memberFromRequest(req);
    const drivers = await this.driversService.list(
      organizationId,
      member,
      customerId,
      activeOnly,
      inactiveOnly,
    );
    return { drivers };
  }

  @Post()
  @Permission(RoleModuleEnum.DRIVERS, RoleActionEnum.CREATE)
  @ApiOperation({ summary: 'Create a new driver' })
  @ApiResponse({ status: 201, type: DriverResponseDto })
  async create(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateDriverDto,
  ): Promise<DriverResponseDto> {
    const member = memberFromRequest(req);
    return this.driversService.create(organizationId, member, dto);
  }

  @Get(':driverId')
  @Permission(RoleModuleEnum.DRIVERS, RoleActionEnum.VIEW)
  @ApiOperation({ summary: 'Get a driver by ID' })
  @ApiResponse({ status: 200, type: DriverResponseDto })
  async getById(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
  ): Promise<DriverResponseDto> {
    const member = memberFromRequest(req);
    return this.driversService.getById(driverId, organizationId, member);
  }

  @Patch(':driverId')
  @Permission(RoleModuleEnum.DRIVERS, RoleActionEnum.EDIT)
  @ApiOperation({ summary: 'Update a driver' })
  @ApiResponse({ status: 200, type: DriverResponseDto })
  async update(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
    @Body() dto: UpdateDriverDto,
  ): Promise<DriverResponseDto> {
    const member = memberFromRequest(req);
    return this.driversService.update(driverId, organizationId, member, dto);
  }

  @Delete(':driverId')
  @Permission(RoleModuleEnum.DRIVERS, RoleActionEnum.DELETE)
  @ApiOperation({ summary: 'Soft-delete a driver (sets active = false)' })
  @ApiResponse({ status: 204, description: 'Driver deactivated' })
  async delete(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
  ): Promise<void> {
    const member = memberFromRequest(req);
    return this.driversService.delete(driverId, organizationId, member);
  }

  @Post(':driverId/assign-vehicle')
  @Permission(RoleModuleEnum.DRIVERS, RoleActionEnum.EDIT)
  @ApiOperation({ summary: 'Assign a vehicle to a driver' })
  @ApiResponse({ status: 201 })
  async assignVehicle(
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
    @Body() dto: AssignVehicleDto,
  ) {
    return this.driversService.assignVehicle(driverId, organizationId, dto);
  }

  @Delete(':driverId/assign-vehicle/:vehicleId')
  @Permission(RoleModuleEnum.DRIVERS, RoleActionEnum.EDIT)
  @ApiOperation({ summary: 'Remove vehicle assignment from a driver' })
  @ApiResponse({ status: 204 })
  async unassignVehicle(
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
  ): Promise<void> {
    return this.driversService.unassignVehicle(driverId, vehicleId, organizationId);
  }
}
