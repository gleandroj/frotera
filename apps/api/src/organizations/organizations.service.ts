import { ApiCode } from "@/common/api-codes.enum";
import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrganizationRole } from "../invitations/invitations.dto";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateOrganizationDto,
  CreateOrganizationResponseDto,
  OrganizationResponseDto,
  OrganizationsListResponseDto,
  UpdateOrganizationDto,
  UpdateOrganizationResponseDto,
} from "./organizations.dto";

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

    // Get default credit balance from environment variable (default: 0)
    const defaultCreditBalance = parseFloat(
      this.configService.get<string>("DEFAULT_CREDIT_BALANCE") || "0"
    );

    // Get user's language to determine currency
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });

    // Set currency based on user's language: BRL for Portuguese (pt), USD otherwise
    const currency = user?.language?.toLowerCase() === "pt" ? "BRL" : "USD";

    // Create organization
    const organization = await this.prisma.organization.create({
      data: {
        name,
        description,
        currency,
        memberships: {
          create: {
            userId,
            role: OrganizationRole.OWNER,
          },
        },
      },
      include: {
        memberships: {
          where: {
            userId,
          },
          select: {
            role: true,
            createdAt: true,
          },
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
        role: membership.role as OrganizationRole,
        joinedAt: membership.createdAt,
      },
    };
  }

  async getUserOrganizations(
    userId: string
  ): Promise<OrganizationsListResponseDto> {
    const organizations = await this.prisma.organizationMember.findMany({
      where: {
        userId,
      },
      include: {
        organization: true,
      },
    });

    return {
      organizations: organizations.map((member) => ({
        ...member.organization,
        role: member.role as OrganizationRole,
        joinedAt: member.createdAt,
      })),
    };
  }

  async getOrganizationDetails(
    userId: string,
    organizationId: string
  ): Promise<OrganizationResponseDto> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(ApiCode.ORGANIZATION_NOT_FOUND);
    }

    return {
      ...membership.organization,
      role: membership.role as OrganizationRole,
      joinedAt: membership.createdAt,
    };
  }

  async updateOrganization(
    userId: string,
    organizationId: string,
    data: UpdateOrganizationDto
  ): Promise<UpdateOrganizationResponseDto> {
    // Check if user has permission to update the organization
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        role: {
          in: [OrganizationRole.OWNER, OrganizationRole.ADMIN],
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(ApiCode.ORGANIZATION_NOT_FOUND);
    }

    // Update organization
    const updatedOrganization = await this.prisma.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        currency: true,
        createdAt: true,
      },
    });

    return {
      message: "Organization updated successfully",
      organization: {
        ...updatedOrganization,
        role: membership.role as OrganizationRole,
        joinedAt: membership.createdAt,
      },
    };
  }
}
