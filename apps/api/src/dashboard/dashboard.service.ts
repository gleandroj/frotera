import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DashboardStatsDto } from "./dto/dashboard-stats.dto";

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService
  ) {}

  /**
   * Get dashboard statistics for an organization
   */
  async getDashboardStats(organizationId: string): Promise<DashboardStatsDto> {
    this.logger.log(
      `[getDashboardStats] Getting stats for organization: ${organizationId}`
    );

    const teamMembers = await this.prisma.organizationMember.count({
      where: { organizationId },
    });

    this.logger.log(
      `[getDashboardStats] Stats for ${organizationId}: ${JSON.stringify({
        teamMembers,
      })}`
    );

    return {
      teamMembers,
    };
  }
}
