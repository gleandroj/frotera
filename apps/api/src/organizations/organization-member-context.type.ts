import type { Prisma } from "@prisma/client";

/** Payload attached to `req.organizationMember` by OrganizationMemberGuard (and reused by PermissionGuard). */
export type OrganizationMemberContext = Prisma.OrganizationMemberGetPayload<{
  include: { role: { include: { permissions: true } } };
}>;
