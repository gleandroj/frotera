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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { OrgScopedRequest } from "@/auth/types/authenticated-request.types";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { PermissionGuard } from "@/auth/guards/permission.guard";
import { Permission } from "@/auth/decorators/permission.decorator";
import { CustomersService } from "@/customers/customers.service";
import { OrganizationMemberGuard } from "@/organizations/guards/organization-member.guard";
import { RoleActionEnum, RoleModuleEnum } from "@/roles/roles.dto";
import {
  CreateVehicleDto,
  FleetVehicleStatusDto,
  UpdateVehicleDto,
  VehicleResponseDto,
} from "../dto/index";
import { VehiclesService } from "./vehicles.service";

@ApiTags("vehicles")
@Controller("organizations/:organizationId/vehicles")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly customersService: CustomersService,
  ) {}

  @Post()
  @Permission(RoleModuleEnum.VEHICLES, RoleActionEnum.CREATE)
  @ApiOperation({ summary: "Create a vehicle" })
  @ApiResponse({ status: 201, type: VehicleResponseDto })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateVehicleDto,
    @Request() req: OrgScopedRequest,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.create(
      organizationId,
      body,
      req.allowedCustomerIds,
    );
  }

  @Get()
  @Permission(RoleModuleEnum.VEHICLES, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "List vehicles for the organization" })
  @ApiResponse({ status: 200, type: () => [VehicleResponseDto] })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async list(
    @Param("organizationId") organizationId: string,
    @Query("customerId") filterCustomerId: string | undefined,
    @Query("activeOnly") activeOnlyRaw: string | undefined,
    @Query("inactiveOnly") inactiveOnlyRaw: string | undefined,
    @Request() req: OrgScopedRequest,
  ): Promise<VehicleResponseDto[]> {
    const activeOnly = activeOnlyRaw === "true" || activeOnlyRaw === "1";
    const inactiveOnly = inactiveOnlyRaw === "true" || inactiveOnlyRaw === "1";
    let filterIds: string[] | null | undefined;
    if (filterCustomerId) {
      const descendantIds = await this.customersService.getDescendantCustomerIds(
        [filterCustomerId],
        organizationId,
      );
      const filterSet = [filterCustomerId, ...descendantIds];
      filterIds =
        req.allowedCustomerIds === null
          ? filterSet
          : filterSet.filter((id) => req.allowedCustomerIds!.includes(id));
    }
    return this.vehiclesService.listByOrganization(
      organizationId,
      req.allowedCustomerIds,
      filterIds,
      activeOnly,
      inactiveOnly,
    );
  }

  @Get("fleet-status")
  @Permission(RoleModuleEnum.VEHICLES, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "List all vehicles with their last known position" })
  @ApiResponse({ status: 200, type: () => [FleetVehicleStatusDto] })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async fleetStatus(
    @Param("organizationId") organizationId: string,
    @Request() req: OrgScopedRequest,
  ): Promise<FleetVehicleStatusDto[]> {
    return this.vehiclesService.listFleetStatus(organizationId, req.allowedCustomerIds);
  }

  @Get(":vehicleId")
  @Permission(RoleModuleEnum.VEHICLES, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Get vehicle by id" })
  @ApiResponse({ status: 200, type: VehicleResponseDto })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async get(
    @Param("organizationId") organizationId: string,
    @Param("vehicleId") vehicleId: string,
    @Request() req: OrgScopedRequest,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.findByOrganizationAndId(
      organizationId,
      vehicleId,
      req.allowedCustomerIds,
    );
  }

  @Patch(":vehicleId")
  @Permission(RoleModuleEnum.VEHICLES, RoleActionEnum.EDIT)
  @ApiOperation({ summary: "Update vehicle" })
  @ApiResponse({ status: 200, type: VehicleResponseDto })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async update(
    @Param("organizationId") organizationId: string,
    @Param("vehicleId") vehicleId: string,
    @Body() body: UpdateVehicleDto,
    @Request() req: OrgScopedRequest,
  ): Promise<VehicleResponseDto> {
    await this.vehiclesService.findByOrganizationAndId(
      organizationId,
      vehicleId,
      req.allowedCustomerIds,
    );
    return this.vehiclesService.update(
      organizationId,
      vehicleId,
      body,
      req.allowedCustomerIds,
    );
  }

  @Delete(":vehicleId")
  @Permission(RoleModuleEnum.VEHICLES, RoleActionEnum.DELETE)
  @ApiOperation({ summary: "Delete vehicle" })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async delete(
    @Param("organizationId") organizationId: string,
    @Param("vehicleId") vehicleId: string,
    @Request() req: OrgScopedRequest,
  ): Promise<void> {
    await this.vehiclesService.findByOrganizationAndId(
      organizationId,
      vehicleId,
      req.allowedCustomerIds,
    );
    await this.vehiclesService.delete(vehicleId, req.allowedCustomerIds);
  }
}
