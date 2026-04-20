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
      return true;
    }

    request.allowedCustomerIds =
      await this.customersService.getAllowedCustomerIds(
        membership,
        organizationId,
      );

    return true;
  }
}
