import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { OrganizationMemberContext } from "@/organizations/organization-member-context.type";

export const OrganizationMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrganizationMemberContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.organizationMember;
  }
);
