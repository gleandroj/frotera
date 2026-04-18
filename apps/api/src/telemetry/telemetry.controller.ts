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
import { Request as ExpressRequest } from "express";
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

interface TelemetryRequest extends ExpressRequest {
  user: { userId: string; isSuperAdmin?: boolean };
  organizationMember: { id: string; organizationId: string };
  allowedCustomerIds: string[] | null;
}

@ApiTags("telemetry")
@Controller("organizations/:organizationId/telemetry")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  private ackMemberId(req: TelemetryRequest): string | null {
    const id = req.organizationMember?.id;
    if (!id || id === "superadmin") return null;
    return id;
  }

  @Get("alerts")
  @Permission(RoleModuleEnum.TELEMETRY, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Listar alertas de telemetria" })
  @ApiResponse({ status: 200 })
  listAlerts(
    @Param("organizationId") organizationId: string,
    @Query() query: ListAlertsQueryDto,
    @Request() req: TelemetryRequest,
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
    @Request() req: TelemetryRequest,
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
    @Request() req: TelemetryRequest,
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
    @Request() req: TelemetryRequest,
  ) {
    return this.telemetryService.listGeofences(
      organizationId,
      req.allowedCustomerIds ?? null,
      filterCustomerId,
    );
  }

  @Post("geofences")
  @Permission(RoleModuleEnum.TELEMETRY, RoleActionEnum.EDIT)
  @ApiOperation({ summary: "Criar zona de geofence" })
  @ApiResponse({ status: 201, type: GeofenceResponseDto })
  createGeofence(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateGeofenceDto,
    @Request() req: TelemetryRequest,
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
    @Request() req: TelemetryRequest,
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
    @Request() req: TelemetryRequest,
  ) {
    return this.telemetryService.deleteGeofence(
      organizationId,
      id,
      req.allowedCustomerIds ?? null,
    );
  }
}
