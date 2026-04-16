import { ApiCode } from "@/common/api-codes.enum";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CustomersService } from "@/customers/customers.service";
import { PrismaService } from "../../prisma/prisma.service";

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

    if (request.user?.isSuperAdmin) {
      request.organizationMember = {
        id: "superadmin",
        organizationId,
        userId,
        role: "OWNER",
        customerRestricted: false,
      };
      request.allowedCustomerIds = null;
      return true;
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    }

    request.organizationMember = membership;
    request.allowedCustomerIds =
      await this.customersService.getAllowedCustomerIds(
        membership,
        organizationId,
      );

    return true;
  }
}
