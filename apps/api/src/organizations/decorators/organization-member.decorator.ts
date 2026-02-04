import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { OrganizationMember as OrganizationMemberType } from "@prisma/client";

export const OrganizationMember = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): OrganizationMemberType => {
    const request = ctx.switchToHttp().getRequest();
    return request.organizationMember;
  }
);
