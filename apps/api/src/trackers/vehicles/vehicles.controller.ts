import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { OrganizationMemberGuard } from "@/organizations/guards/organization-member.guard";
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleResponseDto,
} from "../dto/index";
import { VehiclesService } from "./vehicles.service";

@ApiTags("vehicles")
@Controller("organizations/:organizationId/vehicles")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@ApiBearerAuth()
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({ summary: "Create a vehicle" })
  @ApiResponse({ status: 201, type: VehicleResponseDto })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateVehicleDto,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.create(organizationId, body);
  }

  @Get()
  @ApiOperation({ summary: "List vehicles for the organization" })
  @ApiResponse({ status: 200, type: [VehicleResponseDto] })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async list(
    @Param("organizationId") organizationId: string,
  ): Promise<VehicleResponseDto[]> {
    return this.vehiclesService.listByOrganization(organizationId);
  }

  @Get(":vehicleId")
  @ApiOperation({ summary: "Get vehicle by id" })
  @ApiResponse({ status: 200, type: VehicleResponseDto })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async get(
    @Param("organizationId") organizationId: string,
    @Param("vehicleId") vehicleId: string,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.findByOrganizationAndId(
      organizationId,
      vehicleId,
    );
  }

  @Patch(":vehicleId")
  @ApiOperation({ summary: "Update vehicle" })
  @ApiResponse({ status: 200, type: VehicleResponseDto })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async update(
    @Param("organizationId") organizationId: string,
    @Param("vehicleId") vehicleId: string,
    @Body() body: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    await this.vehiclesService.findByOrganizationAndId(
      organizationId,
      vehicleId,
    );
    return this.vehiclesService.update(vehicleId, body);
  }

  @Delete(":vehicleId")
  @ApiOperation({ summary: "Delete vehicle" })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async delete(
    @Param("organizationId") organizationId: string,
    @Param("vehicleId") vehicleId: string,
  ): Promise<void> {
    await this.vehiclesService.findByOrganizationAndId(
      organizationId,
      vehicleId,
    );
    return this.vehiclesService.delete(vehicleId);
  }
}
