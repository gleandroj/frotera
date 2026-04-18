import { Injectable, Logger } from "@nestjs/common";
import { IncidentStatus, Prisma } from "@prisma/client";
import { CustomersService } from "../customers/customers.service";
import { PrismaService } from "../prisma/prisma.service";
import { DashboardStatsDto } from "./dto/dashboard-stats.dto";

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  /**
   * Get dashboard statistics for an organization, scoped by member companies
   * and optional `customerId` (subtree within allowed access).
   */
  async getDashboardStats(
    organizationId: string,
    allowedCustomerIds: string[] | null,
    filterCustomerId?: string,
  ): Promise<DashboardStatsDto> {
    this.logger.log(
      `[getDashboardStats] organization=${organizationId} filter=${filterCustomerId ?? ""}`,
    );

    const scopedCustomers = await this.customersService.resolveResourceCustomerFilter(
      organizationId,
      allowedCustomerIds,
      filterCustomerId,
    );

    const vehicleWhere: Prisma.VehicleWhereInput = {
      organizationId,
      inactive: false,
      ...(scopedCustomers !== null ? { customerId: { in: scopedCustomers } } : {}),
    };

    const driverWhere: Prisma.DriverWhereInput = {
      organizationId,
      active: true,
      ...(scopedCustomers !== null ? { customerId: { in: scopedCustomers } } : {}),
    };

    const customerCountWhere: Prisma.CustomerWhereInput = {
      organizationId,
      ...(scopedCustomers !== null ? { id: { in: scopedCustomers } } : {}),
    };

    const incidentWhere: Prisma.IncidentWhereInput = {
      organizationId,
      status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS] },
      ...(scopedCustomers !== null
        ? { customerId: { in: scopedCustomers } }
        : {}),
    };

    const scopedVehicles =
      scopedCustomers === null
        ? null
        : await this.prisma.vehicle.findMany({
            where: { organizationId, customerId: { in: scopedCustomers } },
            select: { id: true },
          });
    const scopedVehicleIds = scopedVehicles?.map((v) => v.id) ?? null;

    const trackerWhere: Prisma.TrackerDeviceWhereInput = { organizationId };
    if (scopedVehicleIds !== null) {
      trackerWhere.vehicle = {
        is: { id: { in: scopedVehicleIds.length > 0 ? scopedVehicleIds : [] } },
      };
    }

    const [
      teamMembers,
      vehiclesActive,
      driversActive,
      trackers,
      customers,
      openIncidents,
    ] = await Promise.all([
      this.prisma.organizationMember.count({ where: { organizationId } }),
      this.prisma.vehicle.count({ where: vehicleWhere }),
      this.prisma.driver.count({ where: driverWhere }),
      this.prisma.trackerDevice.count({ where: trackerWhere }),
      this.prisma.customer.count({ where: customerCountWhere }),
      this.prisma.incident.count({ where: incidentWhere }),
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
      `[getDashboardStats] Stats for ${organizationId}: ${JSON.stringify(payload)}`,
    );

    return payload;
  }
}
