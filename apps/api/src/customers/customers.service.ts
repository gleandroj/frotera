import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ApiCode } from "@/common/api-codes.enum";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import type { OrganizationMember } from "@prisma/client";
import {
  CreateCustomerDto,
  CustomerResponseDto,
  UpdateCustomerDto,
} from "./customers.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns allowed customer IDs for a member: null = full org access,
   * string[] = restricted to those customers and all their descendants.
   * Only includes customers that belong to the given organizationId.
   * If the member has any organizationMemberCustomer rows, they are treated as restricted
   * (even if customerRestricted is false) so that list only returns those customers in this org.
   */
  async getAllowedCustomerIds(
    member: Pick<OrganizationMember, "id" | "customerRestricted">,
    organizationId: string,
  ): Promise<string[] | null> {
    const assigned = await this.prisma.organizationMemberCustomer.findMany({
      where: { organizationMemberId: member.id },
      select: { customerId: true },
    });
    const rawAssignedIds = assigned.map((a) => a.customerId);

    // Full access only when not restricted AND no explicit customer assignments
    if (!member.customerRestricted && rawAssignedIds.length === 0) {
      return null;
    }

    if (rawAssignedIds.length === 0) {
      return [];
    }

    // Only include customers that belong to this organization (guard against cross-org data)
    const customersInOrg = await this.prisma.customer.findMany({
      where: { id: { in: rawAssignedIds }, organizationId },
      select: { id: true },
    });
    const assignedIds = customersInOrg.map((c) => c.id);
    if (assignedIds.length === 0) {
      return [];
    }
    const descendantIds = await this.getDescendantCustomerIds(
      assignedIds,
      organizationId,
    );
    return [...new Set([...assignedIds, ...descendantIds])];
  }

  /**
   * Returns the given customer ID and all its ancestor IDs (walking parentId up).
   * Used to check "member has access to this customer" (member's assigned set may include an ancestor).
   */
  async getCustomerIdAndAncestorIds(
    customerId: string,
    organizationId: string,
  ): Promise<string[]> {
    const result: string[] = [];
    let currentId: string | null = customerId;
    while (currentId) {
      const row: { id: string; parentId: string | null } | null =
        await this.prisma.customer.findFirst({
          where: { id: currentId, organizationId },
          select: { id: true, parentId: true },
        });
      if (!row) break;
      result.push(row.id);
      currentId = row.parentId;
    }
    return result;
  }

  /** Get all descendant IDs for given customer IDs in the same org (recursive). */
  async getDescendantCustomerIds(
    customerIds: string[],
    organizationId: string,
  ): Promise<string[]> {
    if (customerIds.length === 0) return [];
    const result = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE descendants AS (
        SELECT id FROM "customers"
        WHERE "organizationId" = ${organizationId}
          AND "parentId" IN (${Prisma.join(customerIds)})
        UNION ALL
        SELECT c.id FROM "customers" c
        INNER JOIN descendants d ON c."parentId" = d.id
        WHERE c."organizationId" = ${organizationId}
      )
      SELECT id FROM descendants
    `;
    return result.map((r) => r.id);
  }

  /**
   * Reduce customer IDs to the minimal "root" set: only IDs that have no parent
   * in the given set (or have no parent at all). Storing only roots means
   * "access to parent" automatically includes all descendants at read time.
   */
  async getRootCustomerIds(
    organizationId: string,
    customerIds: string[],
  ): Promise<string[]> {
    if (customerIds.length === 0) return [];
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds }, organizationId },
      select: { id: true, parentId: true },
    });
    const idSet = new Set(customerIds);
    return customers
      .filter((c) => !c.parentId || !idSet.has(c.parentId))
      .map((c) => c.id);
  }

  async list(
    organizationId: string,
    allowedCustomerIds: string[] | null,
  ): Promise<CustomerResponseDto[]> {
    const where: { organizationId: string; id?: { in: string[] } } = {
      organizationId,
    };
    if (allowedCustomerIds !== null) {
      if (allowedCustomerIds.length === 0) return [];
      where.id = { in: allowedCustomerIds };
    }
    const rows = await this.prisma.customer.findMany({
      where,
      orderBy: [{ name: "asc" }],
    });
    const byId = new Map(rows.map((c) => [c.id, c]));
    // Depth 0 when parent is missing from set (no access to parent); otherwise 1 + parent depth
    const depth = (id: string): number => {
      const c = byId.get(id);
      if (!c?.parentId) return 0;
      if (!byId.has(c.parentId)) return 0;
      return 1 + depth(c.parentId);
    };
    const dtos = rows.map((c) => ({
      id: c.id,
      organizationId: c.organizationId,
      parentId: c.parentId ?? undefined,
      name: c.name,
      depth: depth(c.id),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
    const childrenByParent = new Map<string | null, typeof dtos>();
    for (const d of dtos) {
      const key = d.parentId ?? null;
      if (!childrenByParent.has(key)) childrenByParent.set(key, []);
      childrenByParent.get(key)!.push(d);
    }
    for (const arr of childrenByParent.values()) {
      arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }
    // Visible roots: nodes with no parent in the fetched set (top-level or parent not accessible)
    const visibleRoots = dtos.filter(
      (d) => d.parentId == null || !byId.has(d.parentId),
    );
    visibleRoots.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    const ordered: typeof dtos = [];
    const appendDescendants = (parentId: string | null) => {
      const children = childrenByParent.get(parentId) ?? [];
      for (const d of children) {
        ordered.push(d);
        appendDescendants(d.id);
      }
    };
    for (const root of visibleRoots) {
      ordered.push(root);
      appendDescendants(root.id);
    }
    return ordered;
  }

  async create(
    organizationId: string,
    dto: CreateCustomerDto,
    allowedCustomerIds: string[] | null,
  ): Promise<CustomerResponseDto> {
    const parentId = dto.parentId?.trim() || null;
    if (allowedCustomerIds !== null && !parentId) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
    if (parentId) {
      const parent = await this.prisma.customer.findFirst({
        where: { id: parentId, organizationId },
      });
      if (!parent) {
        throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
      }
      if (allowedCustomerIds !== null && !allowedCustomerIds.includes(parentId)) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }
    const customer = await this.prisma.customer.create({
      data: {
        organizationId,
        name: dto.name,
        parentId,
      },
    });
    return this.toResponse(customer);
  }

  async getById(
    customerId: string,
    organizationId: string,
    allowedCustomerIds: string[] | null,
  ): Promise<CustomerResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer) {
      throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    }
    if (allowedCustomerIds !== null && !allowedCustomerIds.includes(customer.id)) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
    const depth = customer.parentId
      ? await this.getDepth(customer.parentId, organizationId) + 1
      : 0;
    return {
      ...this.toResponse(customer),
      depth,
    };
  }

  private async getDepth(customerId: string, organizationId: string): Promise<number> {
    const c = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!c?.parentId) return 0;
    return 1 + (await this.getDepth(c.parentId, organizationId));
  }

  async update(
    customerId: string,
    organizationId: string,
    dto: UpdateCustomerDto,
    allowedCustomerIds: string[] | null,
  ): Promise<CustomerResponseDto> {
    const existing = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    }
    if (allowedCustomerIds !== null && !allowedCustomerIds.includes(customerId)) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
    if (dto.parentId !== undefined) {
      if (dto.parentId !== null) {
        const parent = await this.prisma.customer.findFirst({
          where: { id: dto.parentId, organizationId },
        });
        if (!parent) {
          throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
        }
        if (dto.parentId === customerId) {
          throw new BadRequestException(ApiCode.COMMON_INVALID_INPUT);
        }
        const descendantIds = await this.getDescendantCustomerIds(
          [customerId],
          organizationId,
        );
        if (descendantIds.includes(dto.parentId)) {
          throw new BadRequestException(ApiCode.COMMON_INVALID_INPUT);
        }
      }
    }
    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
    });
    return this.toResponse(customer);
  }

  async delete(
    customerId: string,
    organizationId: string,
    allowedCustomerIds: string[] | null,
  ): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      include: { children: true, vehicles: true },
    });
    if (!customer) {
      throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    }
    if (allowedCustomerIds !== null && !allowedCustomerIds.includes(customerId)) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
    if (customer.children.length > 0) {
      throw new BadRequestException(ApiCode.COMMON_INVALID_INPUT);
    }
    if (customer.vehicles.length > 0) {
      throw new BadRequestException(ApiCode.COMMON_INVALID_INPUT);
    }
    await this.prisma.customer.delete({ where: { id: customerId } });
  }

  private toResponse(c: { id: string; organizationId: string; parentId: string | null; name: string; createdAt: Date; updatedAt: Date }): CustomerResponseDto {
    return {
      id: c.id,
      organizationId: c.organizationId,
      parentId: c.parentId ?? undefined,
      name: c.name,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}
