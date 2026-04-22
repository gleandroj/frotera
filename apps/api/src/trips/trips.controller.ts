import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { OrganizationMemberGuard } from '@/organizations/guards/organization-member.guard';
import { PermissionGuard } from '@/auth/guards/permission.guard';
import { Permission } from '@/auth/decorators/permission.decorator';
import { RoleActionEnum, RoleModuleEnum } from '@/roles/roles.dto';
import type { OrgScopedRequest } from '@/auth/types/authenticated-request.types';
import { TripsService } from './trips.service';
import { TripDetectorService } from './trip-detector.service';
import { TripsQueryDto, StopsQueryDto, PositionsReportQueryDto, DetectTripsDto, ReferencePointsProximityQueryDto } from './dto/trips-query.dto';

@ApiTags('reports')
@Controller('organizations/:organizationId/reports')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly detector: TripDetectorService,
  ) {}

  @Get('positions')
  @Permission(RoleModuleEnum.REPORTS_TRACKING, RoleActionEnum.VIEW)
  async getPositions(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: PositionsReportQueryDto,
  ) {
    return this.tripsService.getPositions(organizationId, req.organizationMember.id, query);
  }

  @Get('trips')
  @Permission(RoleModuleEnum.REPORTS_TRACKING, RoleActionEnum.VIEW)
  async getTrips(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: TripsQueryDto,
  ) {
    return this.tripsService.getTrips(organizationId, req.organizationMember.id, query);
  }

  @Get('stops')
  @Permission(RoleModuleEnum.REPORTS_TRACKING, RoleActionEnum.VIEW)
  async getStops(
    @Param('organizationId') organizationId: string,
    @Query() query: StopsQueryDto,
  ) {
    return this.tripsService.getStops(organizationId, query);
  }

  @Post('trips/detect')
  @Permission(RoleModuleEnum.REPORTS_TRACKING, RoleActionEnum.VIEW)
  async detectTrips(
    @Param('organizationId') organizationId: string,
    @Body() body: DetectTripsDto,
  ) {
    await this.detector.detectTripsForVehicle(
      organizationId,
      body.vehicleId,
      new Date(body.from),
      new Date(body.to),
    );
    return { success: true };
  }

  @Get('reference-points-proximity')
  @Permission(RoleModuleEnum.REPORTS_TRACKING, RoleActionEnum.VIEW)
  async getReferencePointsProximity(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: ReferencePointsProximityQueryDto,
  ) {
    return this.tripsService.getReferencePointsProximityReport(
      organizationId,
      req.organizationMember.id,
      query,
    );
  }
}
