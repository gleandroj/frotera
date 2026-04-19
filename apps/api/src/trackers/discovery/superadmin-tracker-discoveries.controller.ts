import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  BadRequestException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { TrackerModel } from "@prisma/client";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "@/auth/guards/super-admin.guard";
import { TrackerDiscoveryService } from "./tracker-discovery.service";
import {
  IMEI_PARAM_REGEX,
  RegisterDiscoveryToVehicleDto,
  RegisterDiscoveryToVehicleResponseDto,
  SuperadminOrganizationSummaryDto,
  SuperadminVehicleWithoutTrackerDto,
  TrackerDiscoveryLoginResponseDto,
} from "./superadmin-tracker-discovery.dto";

@ApiTags("superadmin-tracker-discoveries")
@Controller("superadmin/tracker-discoveries")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@ApiBearerAuth()
export class SuperadminTrackerDiscoveriesController {
  constructor(private readonly discovery: TrackerDiscoveryService) {}

  @Get()
  @ApiOperation({ summary: "List IMEIs that logged in via TCP before registration" })
  @ApiResponse({ status: 200, type: [TrackerDiscoveryLoginResponseDto] })
  async list(): Promise<TrackerDiscoveryLoginResponseDto[]> {
    const rows = await this.discovery.listRecent();
    return rows.map((r) => ({
      id: r.id,
      imei: r.imei,
      protocol: r.protocol,
      firstSeenAt: r.firstSeenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      loginCount: r.loginCount,
      lastRemoteAddress: r.lastRemoteAddress,
    }));
  }

  @Get("lookup/organizations")
  @ApiOperation({ summary: "List all organizations (superadmin)" })
  @ApiResponse({ status: 200, type: [SuperadminOrganizationSummaryDto] })
  async listOrganizations(): Promise<SuperadminOrganizationSummaryDto[]> {
    return this.discovery.listAllOrganizations();
  }

  @Get("lookup/organizations/:organizationId/vehicles-without-tracker")
  @ApiOperation({ summary: "Vehicles in org that have no tracker linked" })
  @ApiResponse({ status: 200, type: [SuperadminVehicleWithoutTrackerDto] })
  async listVehiclesWithoutTracker(
    @Param("organizationId") organizationId: string,
  ): Promise<SuperadminVehicleWithoutTrackerDto[]> {
    return this.discovery.listVehiclesWithoutTracker(organizationId);
  }

  @Post(":imei/register-to-vehicle")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create TrackerDevice for IMEI and link to vehicle" })
  @ApiParam({ name: "imei", description: "15-digit IMEI" })
  @ApiResponse({ status: 201, type: RegisterDiscoveryToVehicleResponseDto })
  @ApiResponse({ status: 400, description: "Vehicle already has a tracker" })
  @ApiResponse({ status: 404, description: "Discovery or vehicle not found" })
  @ApiResponse({ status: 409, description: "IMEI already registered" })
  async registerToVehicle(
    @Param("imei") imeiRaw: string,
    @Body() body: RegisterDiscoveryToVehicleDto,
  ): Promise<RegisterDiscoveryToVehicleResponseDto> {
    const imei = decodeURIComponent(imeiRaw);
    if (!IMEI_PARAM_REGEX.test(imei)) {
      throw new BadRequestException("IMEI must be 15 digits");
    }
    return this.discovery.registerToVehicle(
      imei,
      body.vehicleId,
      body.model ?? TrackerModel.X12_GT06,
    );
  }
}
