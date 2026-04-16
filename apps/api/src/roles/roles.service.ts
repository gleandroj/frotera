import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRoleDto,
  RoleCreatedResponseDto,
  RoleDeletedResponseDto,
  RoleResponseDto,
  RolesListResponseDto,
  RoleUpdatedResponseDto,
  UpdateRoleDto,
} from './roles.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  private formatRole(role: any): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      color: role.color,
      organizationId: role.organizationId,
      permissions: role.permissions.map((p: any) => ({
        id: p.id,
        module: p.module,
        actions: p.actions,
        scope: p.scope,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async getRoles(userId: string, organizationId: string): Promise<RolesListResponseDto> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
    });
    if (!membership) throw new ForbiddenException('AUTH_FORBIDDEN');

    const roles = await this.prisma.role.findMany({
      where: {
        OR: [{ organizationId: null }, { organizationId }],
      },
      include: { permissions: true },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });

    return { roles: roles.map((r) => this.formatRole(r)) };
  }

  async getRole(userId: string, organizationId: string, roleId: string): Promise<RoleResponseDto> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
    });
    if (!membership) throw new ForbiddenException('AUTH_FORBIDDEN');

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, OR: [{ organizationId: null }, { organizationId }] },
      include: { permissions: true },
    });

    if (!role) throw new NotFoundException('ROLE_NOT_FOUND');
    return this.formatRole(role);
  }

  async createRole(userId: string, organizationId: string, data: CreateRoleDto): Promise<RoleCreatedResponseDto> {
    await this.requireUsersEditPermission(userId, organizationId);

    const existing = await this.prisma.role.findFirst({
      where: { name: data.name, organizationId },
    });
    if (existing) throw new BadRequestException('ROLE_NAME_ALREADY_EXISTS');

    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        isSystem: false,
        organizationId,
        permissions: {
          create: data.permissions.map((p) => ({
            module: p.module as any,
            actions: p.actions as any,
            scope: p.scope as any,
          })),
        },
      },
      include: { permissions: true },
    });

    return { message: 'ROLE_CREATED_SUCCESSFULLY', role: this.formatRole(role) };
  }

  async updateRole(userId: string, organizationId: string, roleId: string, data: UpdateRoleDto): Promise<RoleUpdatedResponseDto> {
    await this.requireUsersEditPermission(userId, organizationId);

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId },
      include: { permissions: true },
    });

    if (!role) throw new NotFoundException('ROLE_NOT_FOUND');
    if (role.isSystem) throw new ForbiddenException('ROLE_SYSTEM_CANNOT_MODIFY');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.color !== undefined && { color: data.color }),
        },
      });

      if (data.permissions !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        await tx.rolePermission.createMany({
          data: data.permissions.map((p) => ({
            roleId,
            module: p.module as any,
            actions: p.actions as any,
            scope: p.scope as any,
          })),
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: { permissions: true },
      });
    });

    return { message: 'ROLE_UPDATED_SUCCESSFULLY', role: this.formatRole(updated) };
  }

  async deleteRole(userId: string, organizationId: string, roleId: string): Promise<RoleDeletedResponseDto> {
    await this.requireUsersEditPermission(userId, organizationId);

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId },
    });

    if (!role) throw new NotFoundException('ROLE_NOT_FOUND');
    if (role.isSystem) throw new ForbiddenException('ROLE_SYSTEM_CANNOT_DELETE');

    const membersWithRole = await this.prisma.organizationMember.count({
      where: { roleId, organizationId },
    });
    if (membersWithRole > 0) throw new BadRequestException('ROLE_IN_USE_CANNOT_DELETE');

    await this.prisma.role.delete({ where: { id: roleId } });
    return { message: 'ROLE_DELETED_SUCCESSFULLY' };
  }

  private async requireUsersEditPermission(userId: string, organizationId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      include: { role: { include: { permissions: true } } },
    });

    if (!membership) throw new ForbiddenException('AUTH_FORBIDDEN');

    const usersPerm = membership.role.permissions.find((p) => p.module === 'USERS');
    const canEdit = usersPerm?.actions?.includes('EDIT' as any) ?? false;
    if (!canEdit) throw new ForbiddenException('AUTH_FORBIDDEN');
  }
}
