import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { OrganizationMemberGuard } from "@/organizations/guards/organization-member.guard";
import {
  CreateTrackerDeviceDto,
  TrackerDeviceResponseDto,
  UpdateTrackerDeviceDto,
  PositionResponseDto,
  PositionHistoryQueryDto,
} from "../dto/index";
import { TrackerDevicesService } from "./tracker-devices.service";

@ApiTags("tracker-devices")
@Controller("organizations/:organizationId/tracker-devices")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@ApiBearerAuth()
export class TrackerDevicesController {
  constructor(private readonly devicesService: TrackerDevicesService) {}

  @Post()
  @ApiOperation({ summary: "Create a tracker device" })
  @ApiResponse({ status: 201, type: TrackerDeviceResponseDto })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 409, description: "IMEI already exists" })
  async create(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateTrackerDeviceDto,
  ): Promise<TrackerDeviceResponseDto> {
    return this.devicesService.create(organizationId, body);
  }

  @Get()
  @ApiOperation({ summary: "List tracker devices for the organization" })
  @ApiResponse({ status: 200, type: () => [TrackerDeviceResponseDto] })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async list(
    @Param("organizationId") organizationId: string,
  ): Promise<TrackerDeviceResponseDto[]> {
    return this.devicesService.listByOrganization(organizationId);
  }

  @Get(":deviceId")
  @ApiOperation({ summary: "Get tracker device by id" })
  @ApiResponse({ status: 200, type: TrackerDeviceResponseDto })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async get(
    @Param("organizationId") organizationId: string,
    @Param("deviceId") deviceId: string,
  ): Promise<TrackerDeviceResponseDto> {
    return this.devicesService.findByOrganizationAndId(organizationId, deviceId);
  }

  @Patch(":deviceId")
  @ApiOperation({ summary: "Update tracker device" })
  @ApiResponse({ status: 200, type: TrackerDeviceResponseDto })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async update(
    @Param("organizationId") organizationId: string,
    @Param("deviceId") deviceId: string,
    @Body() body: UpdateTrackerDeviceDto,
  ): Promise<TrackerDeviceResponseDto> {
    await this.devicesService.findByOrganizationAndId(organizationId, deviceId);
    return this.devicesService.update(deviceId, body);
  }

  @Delete(":deviceId")
  @ApiOperation({ summary: "Delete tracker device" })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async delete(
    @Param("organizationId") organizationId: string,
    @Param("deviceId") deviceId: string,
  ): Promise<void> {
    await this.devicesService.findByOrganizationAndId(organizationId, deviceId);
    return this.devicesService.delete(deviceId);
  }

  @Post(":deviceId/odometer/reset")
  @HttpCode(200)
  @ApiOperation({ summary: "Reset device odometer in Redis to zero" })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async resetOdometer(
    @Param("organizationId") organizationId: string,
    @Param("deviceId") deviceId: string,
  ): Promise<void> {
    await this.devicesService.findByOrganizationAndId(organizationId, deviceId);
    return this.devicesService.resetOdometer(deviceId);
  }

  @Get(":deviceId/positions/last")
  @ApiOperation({ summary: "Get last position (Redis or Postgres)" })
  @ApiResponse({ status: 200, type: PositionResponseDto })
  @ApiResponse({ status: 404, description: "No position found" })
  async getLastPosition(
    @Param("organizationId") organizationId: string,
    @Param("deviceId") deviceId: string,
  ): Promise<PositionResponseDto | null> {
    await this.devicesService.findByOrganizationAndId(organizationId, deviceId);
    return this.devicesService.getLastPosition(deviceId);
  }

  @Get(":deviceId/positions")
  @ApiOperation({ summary: "Get position history" })
  @ApiResponse({ status: 200, type: () => [PositionResponseDto] })
  async getPositionHistory(
    @Param("organizationId") organizationId: string,
    @Param("deviceId") deviceId: string,
    @Query() query: PositionHistoryQueryDto,
  ): Promise<PositionResponseDto[]> {
    await this.devicesService.findByOrganizationAndId(organizationId, deviceId);
    return this.devicesService.getPositionHistory(deviceId, query);
  }
}
