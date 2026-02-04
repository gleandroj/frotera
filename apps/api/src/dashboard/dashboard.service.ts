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

    // Get all stats in parallel for better performance
    const [currentMembers, pendingInvitations] = await Promise.all([
      // Count current team members
      this.prisma.organizationMember.count({
        where: { organizationId },
      }),

      // Count pending invitations
      this.prisma.invitation.count({
        where: {
          organizationId,
          status: 'PENDING'
        },
      }),
    ]);

    this.logger.log(
      `[getDashboardStats] Stats for ${organizationId}: ${JSON.stringify({
        teamMembers: currentMembers,
        pendingInvitations,
      })}`
    );

    return {
      teamMembers: currentMembers,
      pendingInvitations,
    };
  }
}
