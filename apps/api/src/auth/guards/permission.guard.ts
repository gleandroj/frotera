import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrganizationMemberContext } from '@/organizations/organization-member-context.type';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger('PermissionGuard');

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (!user?.userId) throw new ForbiddenException('AUTH_FORBIDDEN');

    const organizationId = request.params?.organizationId;
    if (!organizationId) {
      this.logger.warn('PermissionGuard: organizationId not found in route params');
      throw new ForbiddenException('AUTH_FORBIDDEN');
    }

    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { isSuperAdmin: true },
    });
    if (userRecord?.isSuperAdmin) return true;

    const reqAny = request as Request & { organizationMember?: OrganizationMemberContext };
    const cached = reqAny.organizationMember;
    const cachedPerms = cached?.role?.permissions;
    const reuseMembership =
      cached?.userId === user.userId &&
      cached?.organizationId === organizationId &&
      Array.isArray(cachedPerms);

    const membership: OrganizationMemberContext | null = reuseMembership
      ? cached!
      : await this.prisma.organizationMember.findFirst({
          where: { userId: user.userId, organizationId },
          include: { role: { include: { permissions: true } } },
        });

    if (!membership) throw new ForbiddenException('AUTH_FORBIDDEN');

    const perm = membership.role.permissions.find((p) => p.module === required.module);
    const hasPermission = perm?.actions?.includes(required.action as any) ?? false;

    if (!hasPermission) {
      this.logger.warn(
        `Permission denied: user ${user.userId} needs ${required.module}:${required.action} in org ${organizationId}`,
      );
      throw new ForbiddenException('AUTH_FORBIDDEN');
    }

    return true;
  }
}
