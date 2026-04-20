import { Controller, Get, Param, Query, Request, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganizationMemberGuard } from "../organizations/guards/organization-member.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { Permission } from "../auth/decorators/permission.decorator";
import { RoleActionEnum, RoleModuleEnum } from "../roles/roles.dto";
import { DashboardService } from "./dashboard.service";
import type { OrgScopedRequest } from "@/auth/types/authenticated-request.types";
import { DashboardResponseDto } from "./dto/dashboard-stats.dto";

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@Controller("organizations/:organizationId/dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Permission(RoleModuleEnum.DASHBOARD, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Get dashboard statistics for an organization" })
  @ApiResponse({
    status: 200,
    type: DashboardResponseDto,
    description: "Dashboard statistics retrieved successfully",
  })
  async getDashboardStats(
    @Param("organizationId") organizationId: string,
    @Query("customerId") customerId: string | undefined,
    @Request() req: OrgScopedRequest,
  ): Promise<DashboardResponseDto> {
    const data = await this.dashboardService.getDashboardStats(
      organizationId,
      req.allowedCustomerIds ?? null,
      customerId,
    );

    return {
      message: "Dashboard statistics retrieved successfully",
      data,
    };
  }
}
