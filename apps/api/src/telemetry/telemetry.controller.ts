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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { OrgScopedRequest } from "@/auth/types/authenticated-request.types";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { PermissionGuard } from "@/auth/guards/permission.guard";
import { Permission } from "@/auth/decorators/permission.decorator";
import { OrganizationMemberGuard } from "@/organizations/guards/organization-member.guard";
import { RoleActionEnum, RoleModuleEnum } from "@/roles/roles.dto";
import {
  AlertStatsResponseDto,
  CreateGeofenceDto,
  GeofenceResponseDto,
  ListAlertsQueryDto,
  TelemetryAlertResponseDto,
  UpdateGeofenceDto,
} from "./telemetry.dto";
import { TelemetryService } from "./telemetry.service";

@ApiTags("telemetry")
@Controller("organizations/:organizationId/telemetry")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  private ackMemberId(req: OrgScopedRequest): string | null {
    const id = req.organizationMember?.id;
    if (!id) return null;
    return id;
  }

  @Get("alerts")
  @Permission(RoleModuleEnum.TELEMETRY, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Listar alertas de telemetria" })
  @ApiResponse({ status: 200 })
  listAlerts(
    @Param("organizationId") organizationId: string,
    @Query() query: ListAlertsQueryDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.telemetryService.listAlerts(
      organizationId,
      query,
      req.allowedCustomerIds ?? null,
    );
  }

  @Get("alerts/stats")
  @Permission(RoleModuleEnum.TELEMETRY, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Estatísticas de alertas" })
  @ApiResponse({ status: 200, type: AlertStatsResponseDto })
  getAlertStats(
    @Param("organizationId") organizationId: string,
    @Query("customerId") filterCustomerId: string | undefined,
    @Request() req: OrgScopedRequest,
  ) {
    return this.telemetryService.getAlertStats(
      organizationId,
      req.allowedCustomerIds ?? null,
      filterCustomerId,
    );
  }

  @Patch("alerts/:id/acknowledge")
  @Permission(RoleModuleEnum.TELEMETRY, RoleActionEnum.EDIT)
  @ApiOperation({ summary: "Reconhecer alerta" })
  @ApiResponse({ status: 200, type: TelemetryAlertResponseDto })
  acknowledgeAlert(
    @Param("organizationId") organizationId: string,
    @Param("id") id: string,
    @Request() req: OrgScopedRequest,
  ) {
    return this.telemetryService.acknowledgeAlert(
      organizationId,
      id,
      this.ackMemberId(req),
    );
  }

  @Get("geofences")
  @Permission(RoleModuleEnum.TELEMETRY, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Listar zonas de geofence" })
  @ApiResponse({ status: 200, type: [GeofenceResponseDto] })
  listGeofences(
    @Param("organizationId") organizationId: string,
    @Query("customerId") filterCustomerId: string | undefined,
    @Query("activeOnly") activeOnlyRaw: string | undefined,
    @Query("inactiveOnly") inactiveOnlyRaw: string | undefined,
    @Request() req: OrgScopedRequest,
  ) {
    const activeOnly = activeOnlyRaw === "true" || activeOnlyRaw === "1";
    const inactiveOnly = inactiveOnlyRaw === "true" || inactiveOnlyRaw === "1";
    return this.telemetryService.listGeofences(
      organizationId,
      req.allowedCustomerIds ?? null,
      filterCustomerId,
      activeOnly,
      inactiveOnly,
    );
  }

  @Post("geofences")
  @Permission(RoleModuleEnum.TELEMETRY, RoleActionEnum.EDIT)
  @ApiOperation({ summary: "Criar zona de geofence" })
  @ApiResponse({ status: 201, type: GeofenceResponseDto })
  createGeofence(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateGeofenceDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.telemetryService.createGeofence(
      organizationId,
      dto,
      req.allowedCustomerIds ?? null,
    );
  }

  @Patch("geofences/:id")
  @Permission(RoleModuleEnum.TELEMETRY, RoleActionEnum.EDIT)
  @ApiOperation({ summary: "Atualizar zona de geofence" })
  @ApiResponse({ status: 200, type: GeofenceResponseDto })
  updateGeofence(
    @Param("organizationId") organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateGeofenceDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.telemetryService.updateGeofence(
      organizationId,
      id,
      dto,
      req.allowedCustomerIds ?? null,
    );
  }

  @Delete("geofences/:id")
  @Permission(RoleModuleEnum.TELEMETRY, RoleActionEnum.DELETE)
  @ApiOperation({ summary: "Remover zona de geofence" })
  @ApiResponse({ status: 200 })
  deleteGeofence(
    @Param("organizationId") organizationId: string,
    @Param("id") id: string,
    @Request() req: OrgScopedRequest,
  ) {
    return this.telemetryService.deleteGeofence(
      organizationId,
      id,
      req.allowedCustomerIds ?? null,
    );
  }
}
