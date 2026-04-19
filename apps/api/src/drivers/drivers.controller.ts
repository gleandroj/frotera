import {
  Body, Controller, Delete, Get, Param, Patch, Post,
  Query, Request, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DriversService } from './drivers.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignVehicleDto,
  CreateDriverDto,
  DriverResponseDto,
  DriversListResponseDto,
  UpdateDriverDto,
} from './drivers.dto';

// TODO (Wave 1 — RBAC): Descomentar quando PermissionGuard estiver implementado
// import { PermissionGuard } from '../auth/guards/permission.guard';
// import { Permission } from '../auth/decorators/permission.decorator';
// import { Module as PermModule, Action } from '../auth/enums/permission.enum';

interface RequestWithUser extends ExpressRequest {
  user: { userId: string };
}

@ApiTags('drivers')
@Controller('organizations/:organizationId/drivers')
@UseGuards(JwtAuthGuard)
// TODO (Wave 1 — RBAC): @UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List drivers in an organization' })
  @ApiResponse({ status: 200, type: DriversListResponseDto })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.VIEW)
  async list(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Query('customerId') customerId?: string,
    @Query('activeOnly') activeOnlyRaw?: string,
    @Query('inactiveOnly') inactiveOnlyRaw?: string,
  ): Promise<DriversListResponseDto> {
    const activeOnly = activeOnlyRaw === 'true' || activeOnlyRaw === '1';
    const inactiveOnly = inactiveOnlyRaw === 'true' || inactiveOnlyRaw === '1';
    const member = await this.getMember(req.user.userId, organizationId);
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
  @ApiOperation({ summary: 'Create a new driver' })
  @ApiResponse({ status: 201, type: DriverResponseDto })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.CREATE)
  async create(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateDriverDto,
  ): Promise<DriverResponseDto> {
    const member = await this.getMember(req.user.userId, organizationId);
    return this.driversService.create(organizationId, member, dto);
  }

  @Get(':driverId')
  @ApiOperation({ summary: 'Get a driver by ID' })
  @ApiResponse({ status: 200, type: DriverResponseDto })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.VIEW)
  async getById(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
  ): Promise<DriverResponseDto> {
    const member = await this.getMember(req.user.userId, organizationId);
    return this.driversService.getById(driverId, organizationId, member);
  }

  @Patch(':driverId')
  @ApiOperation({ summary: 'Update a driver' })
  @ApiResponse({ status: 200, type: DriverResponseDto })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.EDIT)
  async update(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
    @Body() dto: UpdateDriverDto,
  ): Promise<DriverResponseDto> {
    const member = await this.getMember(req.user.userId, organizationId);
    return this.driversService.update(driverId, organizationId, member, dto);
  }

  @Delete(':driverId')
  @ApiOperation({ summary: 'Soft-delete a driver (sets active = false)' })
  @ApiResponse({ status: 204, description: 'Driver deactivated' })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.DELETE)
  async delete(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
  ): Promise<void> {
    const member = await this.getMember(req.user.userId, organizationId);
    return this.driversService.delete(driverId, organizationId, member);
  }

  @Post(':driverId/assign-vehicle')
  @ApiOperation({ summary: 'Assign a vehicle to a driver' })
  @ApiResponse({ status: 201 })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.EDIT)
  async assignVehicle(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
    @Body() dto: AssignVehicleDto,
  ) {
    return this.driversService.assignVehicle(driverId, organizationId, dto);
  }

  @Delete(':driverId/assign-vehicle/:vehicleId')
  @ApiOperation({ summary: 'Remove vehicle assignment from a driver' })
  @ApiResponse({ status: 204 })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.EDIT)
  async unassignVehicle(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
  ): Promise<void> {
    return this.driversService.unassignVehicle(driverId, vehicleId, organizationId);
  }

  // ── HELPER ────────────────────────────────────────────────────────────────

  private async getMember(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      select: { id: true, customerRestricted: true },
    });
    if (!member) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('AUTH_FORBIDDEN');
    }
    return member;
  }
}
