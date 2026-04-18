import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import type {
  ListCustomerFleetSettingsResponseDto,
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

  /**
   * Efetivo por empresa: valores da própria linha ou, em falta, do primeiro ancestral com valor.
   */
  async resolveEffective(
    organizationId: string,
    customerId: string | null,
  ): Promise<{
    deviceOfflineThresholdMinutes: number | null;
    defaultSpeedLimitKmh: number | null;
  }> {
    if (!customerId) {
      return {
        deviceOfflineThresholdMinutes: null,
        defaultSpeedLimitKmh: null,
      };
    }

    const [customers, settings] = await Promise.all([
      this.prisma.customer.findMany({
        where: { organizationId },
        select: { id: true, parentId: true },
      }),
      this.prisma.customerFleetSetting.findMany({
        where: { organizationId },
      }),
    ]);

    const parentOf = new Map(
      customers.map((c) => [c.id, c.parentId] as const),
    );
    const settingByCustomer = new Map(
      settings.map((s) => [s.customerId, s] as const),
    );

    let deviceOfflineThresholdMinutes: number | null = null;
    let defaultSpeedLimitKmh: number | null = null;
    let cur: string | null = customerId;
    while (
      cur &&
      (deviceOfflineThresholdMinutes === null || defaultSpeedLimitKmh === null)
    ) {
      const row = settingByCustomer.get(cur);
      if (row) {
        if (
          deviceOfflineThresholdMinutes === null &&
          row.deviceOfflineThresholdMinutes != null
        ) {
          deviceOfflineThresholdMinutes = row.deviceOfflineThresholdMinutes;
        }
        if (defaultSpeedLimitKmh === null && row.defaultSpeedLimitKmh != null) {
          defaultSpeedLimitKmh = row.defaultSpeedLimitKmh;
        }
      }
      cur = parentOf.get(cur) ?? null;
    }

    return { deviceOfflineThresholdMinutes, defaultSpeedLimitKmh };
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

    const customerIds = await this.listAccessibleCustomerIds(organizationId, actor);
    if (customerIds.length === 0) {
      return { customers: [] };
    }

    const customers = await this.prisma.customer.findMany({
      where: { organizationId, id: { in: customerIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const [allCust, allSettings] = await Promise.all([
      this.prisma.customer.findMany({
        where: { organizationId },
        select: { id: true, parentId: true },
      }),
      this.prisma.customerFleetSetting.findMany({ where: { organizationId } }),
    ]);
    const parentOf = new Map(allCust.map((c) => [c.id, c.parentId] as const));
    const settingByCustomer = new Map(
      allSettings.map((s) => [s.customerId, s] as const),
    );

    const effectiveFor = (customerId: string) => {
      let deviceOfflineThresholdMinutes: number | null = null;
      let defaultSpeedLimitKmh: number | null = null;
      let cur: string | null = customerId;
      while (
        cur &&
        (deviceOfflineThresholdMinutes === null || defaultSpeedLimitKmh === null)
      ) {
        const row = settingByCustomer.get(cur);
        if (row) {
          if (
            deviceOfflineThresholdMinutes === null &&
            row.deviceOfflineThresholdMinutes != null
          ) {
            deviceOfflineThresholdMinutes = row.deviceOfflineThresholdMinutes;
          }
          if (defaultSpeedLimitKmh === null && row.defaultSpeedLimitKmh != null) {
            defaultSpeedLimitKmh = row.defaultSpeedLimitKmh;
          }
        }
        cur = parentOf.get(cur) ?? null;
      }
      return { deviceOfflineThresholdMinutes, defaultSpeedLimitKmh };
    };

    const customersResolved = customers.map((c) => {
      const eff = effectiveFor(c.id);
      return {
        customerId: c.id,
        customerName: c.name,
        deviceOfflineThresholdMinutes: eff.deviceOfflineThresholdMinutes,
        defaultSpeedLimitKmh: eff.defaultSpeedLimitKmh,
      };
    });

    return { customers: customersResolved };
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
    customerId: string,
    patch: {
      deviceOfflineThresholdMinutes?: number | null;
      defaultSpeedLimitKmh?: number | null;
    },
  ): Promise<void> {
    const existing = await this.prisma.customerFleetSetting.findFirst({
      where: { organizationId, customerId },
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
        throw new BadRequestException(
          "customerId is required when applyMode is single",
        );
      }
      await this.assertCustomerInOrg(organizationId, cid);
      this.assertCustomerAccess(organizationId, cid, actor);
      await this.upsertRow(organizationId, cid, patch);
      return this.getList(organizationId, actor);
    }

    throw new BadRequestException("Invalid applyMode");
  }
}
