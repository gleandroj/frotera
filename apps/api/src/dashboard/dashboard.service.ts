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
   * Same visibility rules as {@link MembersService.getMembers}: excludes super-admin /
   * system users; empresa scope via {@link CustomersService.getAllowedCustomerIds};
   * optional company filter (ancestor chain for org-wide viewers, expanded scope when restricted).
   */
  private async countVisibleTeamMembers(
    organizationId: string,
    allowedCustomerIds: string[] | null,
    filterCustomerId?: string,
  ): Promise<number> {
    const hasCompanyFilter = Boolean(filterCustomerId?.trim());
    if (allowedCustomerIds === null && !hasCompanyFilter) {
      return this.prisma.organizationMember.count({
        where: {
          organizationId,
          user: { isSuperAdmin: false, isSystemUser: false },
        },
      });
    }

    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        user: { isSuperAdmin: false, isSystemUser: false },
      },
      select: {
        id: true,
        customerRestricted: true,
        customers: { select: { customerId: true } },
      },
    });

    let filtered = members;

    if (allowedCustomerIds !== null) {
      const overlapped = await Promise.all(
        filtered.map(async (m) =>
          (await this.customersService.memberOverlapsViewerCustomerIds(
            { id: m.id, customerRestricted: m.customerRestricted },
            organizationId,
            allowedCustomerIds,
          ))
            ? m
            : null,
        ),
      );
      filtered = overlapped.filter((m): m is NonNullable<typeof m> => m !== null);
    }

    const f = filterCustomerId?.trim();
    if (f) {
      const customerIdAndAncestors =
        await this.customersService.getCustomerIdAndAncestorIds(f, organizationId);
      if (customerIdAndAncestors.length > 0) {
        const ancestorSet = new Set(customerIdAndAncestors);
        if (allowedCustomerIds === null) {
          filtered = filtered.filter((m) => {
            if (!m.customerRestricted) return true;
            const ids = m.customers.map((c) => c.customerId);
            return ids.some((id) => ancestorSet.has(id));
          });
        } else {
          const pass = await Promise.all(
            filtered.map(async (m) => {
              const mAllowed = await this.customersService.getAllowedCustomerIds(
                { id: m.id, customerRestricted: m.customerRestricted },
                organizationId,
              );
              if (mAllowed === null || mAllowed.length === 0) return null;
              return mAllowed.some((id) => ancestorSet.has(id)) ? m : null;
            }),
          );
          filtered = pass.filter((m): m is NonNullable<typeof m> => m !== null);
        }
      }
    }

    return filtered.length;
  }

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
      this.countVisibleTeamMembers(
        organizationId,
        allowedCustomerIds,
        filterCustomerId,
      ),
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
