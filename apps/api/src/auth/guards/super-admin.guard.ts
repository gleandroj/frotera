import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SuperAdminGuard implements CanActivate {
  private readonly logger = new Logger(SuperAdminGuard.name);

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      this.logger.log("[SuperAdmin Guard] No user found in request");
      throw new ForbiddenException("Unauthorized");
    }

    // Check if user is super admin
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { isSuperAdmin: true },
    });

    if (!dbUser || !dbUser.isSuperAdmin) {
      this.logger.log(
        `[SuperAdmin Guard] User ${user.userId} is not a super admin`
      );
      throw new ForbiddenException("Admin access required");
    }

    this.logger.log(
      `[SuperAdmin Guard] Super admin access granted for user ${user.userId}`
    );
    return true;
  }
}
