import { Injectable, Logger } from "@nestjs/common";
import { IncidentStatus } from "@prisma/client";
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

    const [
      teamMembers,
      vehiclesActive,
      driversActive,
      trackers,
      customers,
      openIncidents,
    ] = await Promise.all([
      this.prisma.organizationMember.count({ where: { organizationId } }),
      this.prisma.vehicle.count({
        where: { organizationId, inactive: false },
      }),
      this.prisma.driver.count({
        where: { organizationId, active: true },
      }),
      this.prisma.trackerDevice.count({ where: { organizationId } }),
      this.prisma.customer.count({ where: { organizationId } }),
      this.prisma.incident.count({
        where: {
          organizationId,
          status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS] },
        },
      }),
    ]);

    const payload = {
      teamMembers,
      vehiclesActive,
      driversActive,
      trackers,
      customers,
      openIncidents,
    };

    this.logger.log(
      `[getDashboardStats] Stats for ${organizationId}: ${JSON.stringify(payload)}`
    );

    return payload;
  }
}
