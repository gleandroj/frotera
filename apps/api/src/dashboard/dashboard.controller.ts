import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganizationMemberGuard } from "../organizations/guards/organization-member.guard";
import { DashboardService } from "./dashboard.service";
import { DashboardResponseDto } from "./dto/dashboard-stats.dto";

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@Controller("organizations/:organizationId/dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: "Get dashboard statistics for an organization" })
  @ApiResponse({
    status: 200,
    type: DashboardResponseDto,
    description: "Dashboard statistics retrieved successfully",
  })
  async getDashboardStats(
    @Param("organizationId") organizationId: string
  ): Promise<DashboardResponseDto> {
    const data = await this.dashboardService.getDashboardStats(organizationId);

    return {
      message: "Dashboard statistics retrieved successfully",
      data,
    };
  }
}
