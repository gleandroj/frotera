import { ApiCode } from "@/common/api-codes.enum";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CustomersService } from "@/customers/customers.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SystemRoleKey } from "@/roles/roles.dto";

@Injectable()
export class OrganizationMemberGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private customersService: CustomersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const organizationId = request.params.organizationId;
    const userId = request.user?.userId;

    if (!userId) {
      return false;
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      include: {
        role: { include: { permissions: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    }

    request.organizationMember = membership;
    request.isOrganizationOwner = membership.role.key === SystemRoleKey.ORGANIZATION_OWNER;

    if (request.user?.isSuperAdmin || request.isOrganizationOwner) {
      request.allowedCustomerIds = null;
      request.allowedVehicleIds = null;
      request.allowedDriverIds = null;
      return true;
    }

    request.allowedCustomerIds =
      await this.customersService.getAllowedCustomerIds(
        membership,
        organizationId,
      );

    const hasAssignedScope = membership.role.permissions.some(
      (p) => (p as any).scope === 'ASSIGNED',
    );

    if (!hasAssignedScope) {
      request.allowedVehicleIds = null;
      request.allowedDriverIds = null;
      return true;
    }

    // Direct vehicle assignments
    const directVehicles = await this.prisma.organizationMemberVehicle.findMany({
      where: { organizationMemberId: membership.id },
      select: { vehicleId: true },
    });

    // Driver assignments
    const memberDrivers = await this.prisma.organizationMemberDriver.findMany({
      where: { organizationMemberId: membership.id },
      select: { driverId: true },
    });
    const driverIds = memberDrivers.map((d) => d.driverId);

    // Vehicles from driver assignments (active only)
    let driverVehicleIds: string[] = [];
    if (driverIds.length > 0) {
      const assignments = await this.prisma.driverVehicleAssignment.findMany({
        where: { driverId: { in: driverIds }, endDate: null },
        select: { vehicleId: true },
      });
      driverVehicleIds = assignments.map((a) => a.vehicleId);
    }

    const allVehicleIds = [
      ...directVehicles.map((v) => v.vehicleId),
      ...driverVehicleIds,
    ];

    // null = no assignments in this dimension (don't restrict by it)
    // []  = has assignments but 0 active vehicles → restrict to empty set
    request.allowedVehicleIds =
      directVehicles.length === 0 && memberDrivers.length === 0
        ? null
        : allVehicleIds.length > 0
        ? [...new Set(allVehicleIds)]
        : [];

    request.allowedDriverIds =
      driverIds.length > 0 ? driverIds : memberDrivers.length === 0 ? null : [];

    return true;
  }
}
