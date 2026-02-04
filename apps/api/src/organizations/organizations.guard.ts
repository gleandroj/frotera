import { ApiCode } from "@/common/api-codes.enum";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrganizationsGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const organizationId = request.params.organizationId;
    const userId = request.user.id;

    // Check if user is a member of the organization
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

    // Add organization and membership to request for use in controllers
    request.organization = { id: organizationId };
    request.membership = membership;

    return true;
  }
}
