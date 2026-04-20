import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { RoleActionEnum, RoleModuleEnum } from "@/roles/roles.dto";

@Injectable()
export class TrackerDiscoveriesAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { userId?: string } }>();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException("AUTH_FORBIDDEN");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });

    if (user?.isSuperAdmin) {
      return true;
    }

    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        role: {
          permissions: {
            some: {
              module: RoleModuleEnum.TRACKER_DISCOVERIES,
              actions: { has: RoleActionEnum.VIEW },
            },
          },
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException("AUTH_FORBIDDEN");
    }

    return true;
  }
}
