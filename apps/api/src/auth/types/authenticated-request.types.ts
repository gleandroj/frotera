import type { Request as ExpressRequest } from "express";
import type { OrganizationMemberContext } from "@/organizations/organization-member-context.type";

/** Fields present on `req.user` after JwtAuthGuard (JWT strategy). */
export type JwtRequestUser = {
  userId: string;
  isSuperAdmin?: boolean;
  email?: string;
};

export type JwtAuthenticatedRequest = ExpressRequest & {
  user: JwtRequestUser;
};

/** After JwtAuthGuard + OrganizationMemberGuard (+ optional PermissionGuard). */
export type OrgScopedRequest = ExpressRequest & {
  user: JwtRequestUser;
  organizationMember: OrganizationMemberContext;
  allowedCustomerIds: string[] | null;
};
