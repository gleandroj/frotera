import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import type {
  ListCustomerFleetSettingsResponseDto,
  OrganizationFleetDefaultDto,
  UpdateCustomerFleetSettingsDto,
} from "./customer-fleet-settings.dto";

export type FleetRequestActor = {
  userId: string;
  isSuperAdmin?: boolean;
  allowedCustomerIds: string[] | null;
};

@Injectable()
export class CustomerFleetSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista IDs de customers que o utilizador pode gerir nesta organização. */
  async listAccessibleCustomerIds(
    organizationId: string,
    actor: FleetRequestActor,
  ): Promise<string[]> {
    if (actor.isSuperAdmin === true) {
      const rows = await this.prisma.customer.findMany({
        where: { organizationId },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    if (actor.allowedCustomerIds === null) {
      const rows = await this.prisma.customer.findMany({
        where: { organizationId },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    return actor.allowedCustomerIds.filter(Boolean);
  }

  private async getOrgWideRow(organizationId: string) {
    return this.prisma.customerFleetSetting.findFirst({
      where: { organizationId, customerId: null },
    });
  }

  /**
   * Efetivo: linha da empresa (customer) ou, em falta, padrão org-wide (customerId null).
   */
  async resolveEffective(
    organizationId: string,
    customerId: string | null,
  ): Promise<{
    deviceOfflineThresholdMinutes: number | null;
    defaultSpeedLimitKmh: number | null;
  }> {
    const orgWide = await this.getOrgWideRow(organizationId);
    if (!customerId) {
      return {
        deviceOfflineThresholdMinutes: orgWide?.deviceOfflineThresholdMinutes ?? null,
        defaultSpeedLimitKmh: orgWide?.defaultSpeedLimitKmh ?? null,
      };
    }
    const row = await this.prisma.customerFleetSetting.findFirst({
      where: { organizationId, customerId },
    });
    return {
      deviceOfflineThresholdMinutes:
        row != null
          ? (row.deviceOfflineThresholdMinutes ??
            orgWide?.deviceOfflineThresholdMinutes ??
            null)
          : (orgWide?.deviceOfflineThresholdMinutes ?? null),
      defaultSpeedLimitKmh:
        row != null
          ? (row.defaultSpeedLimitKmh ?? orgWide?.defaultSpeedLimitKmh ?? null)
          : (orgWide?.defaultSpeedLimitKmh ?? null),
    };
  }

  /** Apenas superadmin vê/edita o padrão organization-wide (customerId null). */
  private showOrganizationDefaultPanel(actor: FleetRequestActor): boolean {
    return actor.isSuperAdmin === true;
  }

  async getList(
    organizationId: string,
    actor: FleetRequestActor,
  ): Promise<ListCustomerFleetSettingsResponseDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const orgWide = await this.getOrgWideRow(organizationId);
    const orgDefaultDto: OrganizationFleetDefaultDto | null =
      this.showOrganizationDefaultPanel(actor) && orgWide
        ? {
            deviceOfflineThresholdMinutes: orgWide.deviceOfflineThresholdMinutes,
            defaultSpeedLimitKmh: orgWide.defaultSpeedLimitKmh,
          }
        : this.showOrganizationDefaultPanel(actor)
          ? {
              deviceOfflineThresholdMinutes: null,
              defaultSpeedLimitKmh: null,
            }
          : null;

    const customerIds = await this.listAccessibleCustomerIds(organizationId, actor);
    if (customerIds.length === 0) {
      return { organizationDefault: orgDefaultDto, customers: [] };
    }

    const perCustomerRows = await this.prisma.customerFleetSetting.findMany({
      where: { organizationId, customerId: { in: customerIds } },
    });
    const byCustomer = new Map(
      perCustomerRows.filter((r) => r.customerId != null).map((r) => [r.customerId!, r]),
    );

    const customers = await this.prisma.customer.findMany({
      where: { organizationId, id: { in: customerIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const customersResolved = customers.map((c) => {
      const row = byCustomer.get(c.id);
      return {
        customerId: c.id,
        customerName: c.name,
        deviceOfflineThresholdMinutes:
          row != null
            ? (row.deviceOfflineThresholdMinutes ??
              orgWide?.deviceOfflineThresholdMinutes ??
              null)
            : (orgWide?.deviceOfflineThresholdMinutes ?? null),
        defaultSpeedLimitKmh:
          row != null
            ? (row.defaultSpeedLimitKmh ?? orgWide?.defaultSpeedLimitKmh ?? null)
            : (orgWide?.defaultSpeedLimitKmh ?? null),
      };
    });

    return {
      organizationDefault: orgDefaultDto,
      customers: customersResolved,
    };
  }

  private normalizeSpeed(
    v: number | null | undefined,
  ): number | null | undefined {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (!Number.isFinite(v) || v <= 0) return null;
    return v;
  }

  private async assertCustomerInOrg(
    organizationId: string,
    customerId: string,
  ): Promise<void> {
    const c = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      select: { id: true },
    });
    if (!c) throw new NotFoundException("Customer not found");
  }

  private assertCustomerAccess(
    organizationId: string,
    customerId: string,
    actor: FleetRequestActor,
  ): void {
    void organizationId;
    if (actor.isSuperAdmin === true) return;
    const allowed = actor.allowedCustomerIds;
    if (allowed === null) return;
    if (!allowed.includes(customerId)) {
      throw new ForbiddenException();
    }
  }

  private async upsertRow(
    organizationId: string,
    customerId: string | null,
    patch: {
      deviceOfflineThresholdMinutes?: number | null;
      defaultSpeedLimitKmh?: number | null;
    },
  ): Promise<void> {
    const existing = await this.prisma.customerFleetSetting.findFirst({
      where: {
        organizationId,
        customerId: customerId === null ? { equals: null } : customerId,
      },
    });
    const data: {
      deviceOfflineThresholdMinutes?: number | null;
      defaultSpeedLimitKmh?: number | null;
    } = {};
    if (patch.deviceOfflineThresholdMinutes !== undefined) {
      data.deviceOfflineThresholdMinutes = patch.deviceOfflineThresholdMinutes;
    }
    if (patch.defaultSpeedLimitKmh !== undefined) {
      const s = this.normalizeSpeed(patch.defaultSpeedLimitKmh);
      data.defaultSpeedLimitKmh = s === undefined ? null : s;
    }
    if (Object.keys(data).length === 0) return;

    if (existing) {
      await this.prisma.customerFleetSetting.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.customerFleetSetting.create({
        data: {
          organizationId,
          customerId,
          deviceOfflineThresholdMinutes:
            patch.deviceOfflineThresholdMinutes !== undefined
              ? patch.deviceOfflineThresholdMinutes
              : null,
          defaultSpeedLimitKmh:
            patch.defaultSpeedLimitKmh !== undefined
              ? (this.normalizeSpeed(patch.defaultSpeedLimitKmh) ?? null)
              : null,
        },
      });
    }
  }

  async patch(
    organizationId: string,
    dto: UpdateCustomerFleetSettingsDto,
    actor: FleetRequestActor,
  ): Promise<ListCustomerFleetSettingsResponseDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const patch: {
      deviceOfflineThresholdMinutes?: number | null;
      defaultSpeedLimitKmh?: number | null;
    } = {};
    if (dto.deviceOfflineThresholdMinutes !== undefined) {
      patch.deviceOfflineThresholdMinutes = dto.deviceOfflineThresholdMinutes;
    }
    if (dto.defaultSpeedLimitKmh !== undefined) {
      patch.defaultSpeedLimitKmh =
        this.normalizeSpeed(dto.defaultSpeedLimitKmh) ?? null;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(
        "Provide deviceOfflineThresholdMinutes and/or defaultSpeedLimitKmh",
      );
    }

    if (dto.applyMode === "organization_default") {
      if (actor.isSuperAdmin !== true) {
        throw new ForbiddenException("Only superadmin can set organization-wide defaults");
      }
      await this.upsertRow(organizationId, null, patch);
      return this.getList(organizationId, actor);
    }

    if (dto.applyMode === "all_accessible") {
      const ids = await this.listAccessibleCustomerIds(organizationId, actor);
      for (const cid of ids) {
        await this.assertCustomerInOrg(organizationId, cid);
        await this.upsertRow(organizationId, cid, patch);
      }
      return this.getList(organizationId, actor);
    }

    if (dto.applyMode === "single") {
      const cid = dto.customerId;
      if (!cid) {
        throw new BadRequestException("customerId is required when applyMode is single");
      }
      await this.assertCustomerInOrg(organizationId, cid);
      this.assertCustomerAccess(organizationId, cid, actor);
      await this.upsertRow(organizationId, cid, patch);
      return this.getList(organizationId, actor);
    }

    throw new BadRequestException("Invalid applyMode");
  }
}
