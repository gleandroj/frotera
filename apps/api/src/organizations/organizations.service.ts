import { ApiCode } from "@/common/api-codes.enum";
import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateOrganizationDto,
  CreateOrganizationResponseDto,
  OrganizationResponseDto,
  OrganizationsListResponseDto,
  UpdateOrganizationDto,
  UpdateOrganizationResponseDto,
} from "./organizations.dto";

function formatRole(role: any) {
  return {
    id: role.id,
    key: role.key,
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

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async createOrganization(
    userId: string,
    data: CreateOrganizationDto
  ): Promise<CreateOrganizationResponseDto> {
    const { name, description } = data;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });

    const currency = user?.language?.toLowerCase() === "pt" ? "BRL" : "USD";

    // Get ORGANIZATION_OWNER role (global system role)
    const ownerRole = await this.prisma.role.findFirst({
      where: { key: 'ORGANIZATION_OWNER', isSystem: true, organizationId: null },
      include: { permissions: true },
    });
    if (!ownerRole) {
      throw new Error('System role ORGANIZATION_OWNER not found. Run seed first.');
    }

    const organization = await this.prisma.organization.create({
      data: {
        name,
        description,
        currency,
        memberships: {
          create: { userId, roleId: ownerRole.id },
        },
      },
      include: {
        memberships: {
          where: { userId },
          include: { role: { include: { permissions: true } } },
        },
      },
    });

    const membership = organization.memberships[0];

    return {
      message: "Organization created successfully",
      organization: {
        id: organization.id,
        name: organization.name,
        description: organization.description,
        currency: organization.currency,
        createdAt: organization.createdAt,
        role: formatRole(membership.role),
        joinedAt: membership.createdAt,
      },
    };
  }

  async getUserOrganizations(userId: string): Promise<OrganizationsListResponseDto> {
    const organizations = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
        role: { include: { permissions: true } },
      },
    });

    return {
      organizations: organizations.map((member) => ({
        ...member.organization,
        role: formatRole(member.role),
        joinedAt: member.createdAt,
      })),
    };
  }

  async getOrganizationDetails(
    userId: string,
    organizationId: string
  ): Promise<OrganizationResponseDto> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      include: {
        organization: true,
        role: { include: { permissions: true } },
      },
    });

    if (!membership) {
      throw new ForbiddenException(ApiCode.ORGANIZATION_NOT_FOUND);
    }

    return {
      ...membership.organization,
      role: formatRole(membership.role),
      joinedAt: membership.createdAt,
    };
  }

  async updateOrganization(
    userId: string,
    organizationId: string,
    data: UpdateOrganizationDto
  ): Promise<UpdateOrganizationResponseDto> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      include: { role: { include: { permissions: true } } },
    });

    if (!membership) {
      throw new ForbiddenException(ApiCode.ORGANIZATION_NOT_FOUND);
    }

    const updatedOrganization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
      select: { id: true, name: true, description: true, currency: true, createdAt: true },
    });

    return {
      message: "Organization updated successfully",
      organization: {
        ...updatedOrganization,
        role: formatRole(membership.role),
        joinedAt: membership.createdAt,
      },
    };
  }
}
