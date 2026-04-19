import { Controller, Get, Param, Patch, Body, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { OrgScopedRequest } from "@/auth/types/authenticated-request.types";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { PermissionGuard } from "@/auth/guards/permission.guard";
import { Permission } from "@/auth/decorators/permission.decorator";
import { CustomerFleetSettingsService } from "@/customers/customer-fleet-settings.service";
import {
  ListCustomerFleetSettingsResponseDto,
  UpdateCustomerFleetSettingsDto,
} from "@/customers/customer-fleet-settings.dto";
import { OrganizationMemberGuard } from "@/organizations/guards/organization-member.guard";
import { RoleActionEnum, RoleModuleEnum } from "@/roles/roles.dto";

@ApiTags("organizations")
@Controller("organizations/:organizationId/customer-fleet-settings")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class CustomerFleetSettingsController {
  constructor(private readonly fleetSettings: CustomerFleetSettingsService) {}

  @Get()
  @Permission(RoleModuleEnum.COMPANIES, RoleActionEnum.EDIT)
  @ApiOperation({
    summary: "List fleet/telemetry settings per customer (empresa), com herança na árvore",
  })
  @ApiResponse({ status: 200, type: ListCustomerFleetSettingsResponseDto })
  async list(
    @Param("organizationId") organizationId: string,
    @Request() req: OrgScopedRequest,
  ): Promise<ListCustomerFleetSettingsResponseDto> {
    return this.fleetSettings.getList(organizationId, {
      userId: req.user.userId,
      isSuperAdmin: req.user.isSuperAdmin === true,
      allowedCustomerIds: req.allowedCustomerIds,
    });
  }

  @Patch()
  @Permission(RoleModuleEnum.COMPANIES, RoleActionEnum.EDIT)
  @ApiOperation({ summary: "Update fleet settings (single customer or all accessible)" })
  @ApiResponse({ status: 200, type: ListCustomerFleetSettingsResponseDto })
  async patch(
    @Param("organizationId") organizationId: string,
    @Body() body: UpdateCustomerFleetSettingsDto,
    @Request() req: OrgScopedRequest,
  ): Promise<ListCustomerFleetSettingsResponseDto> {
    return this.fleetSettings.patch(organizationId, body, {
      userId: req.user.userId,
      isSuperAdmin: req.user.isSuperAdmin === true,
      allowedCustomerIds: req.allowedCustomerIds,
    });
  }
}
