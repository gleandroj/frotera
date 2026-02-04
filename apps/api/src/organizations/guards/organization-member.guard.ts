import { ApiCode } from "@/common/api-codes.enum";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrganizationMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

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
    });

    if (!membership) {
      throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    }

    // Attach the membership to the request for use in controllers
    request.organizationMember = membership;

    return true;
  }
}
