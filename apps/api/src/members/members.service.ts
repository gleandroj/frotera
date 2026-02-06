import { ApiCode } from "@/common/api-codes.enum";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  DeleteMemberResponseDto,
  MembersListResponseDto,
  OrganizationRole,
  UpdateMemberDto,
  UpdateMemberResponseDto,
} from "./members.dto";

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async getMembers(
    userId: string,
    organizationId: string
  ): Promise<MembersListResponseDto> {
    // Check if user is member of the organization
    const organizationMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!organizationMember) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    // Get organization members
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
        customers: { include: { customer: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      memberships: members.map((member) => ({
        id: member.id,
        role: member.role as OrganizationRole,
        joinedAt: member.createdAt,
        customerRestricted: member.customerRestricted,
        customers: member.customers?.map((mc) => ({ id: mc.customer.id, name: mc.customer.name })) ?? [],
        user: member.user,
      })),
    };
  }

  async updateMember(
    userId: string,
    organizationId: string,
    memberId: string,
    data: UpdateMemberDto
  ): Promise<UpdateMemberResponseDto> {
    // Check if user is owner/admin of the organization
    const userMembership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!userMembership) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    // Get the member to update
    const memberToUpdate = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
      include: { user: true },
    });

    if (!memberToUpdate) {
      throw new NotFoundException(ApiCode.MEMBER_NOT_FOUND);
    }

    // Prevent changing own role
    if (data.role !== undefined && memberToUpdate.userId === userId) {
      throw new BadRequestException(ApiCode.MEMBER_CANNOT_CHANGE_OWN_ROLE);
    }

    // Only owners can assign owner role
    if (
      data.role === OrganizationRole.OWNER &&
      userMembership.role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException(
        ApiCode.MEMBER_ONLY_OWNERS_CAN_ASSIGN_OWNER_ROLE
      );
    }

    const updateData: {
      role?: OrganizationRole;
      customerRestricted?: boolean;
    } = {};
    if (data.role !== undefined) updateData.role = data.role;
    if (data.customerRestricted !== undefined) updateData.customerRestricted = data.customerRestricted;

    const updatedMember = await this.prisma.$transaction(async (tx) => {
      const member = await tx.organizationMember.update({
        where: { id: memberId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true,
            },
          },
          customers: { include: { customer: true } },
        },
      });

      // Sync customer access when customerRestricted or customerIds provided
      if (data.customerRestricted !== undefined || data.customerIds !== undefined) {
        await tx.organizationMemberCustomer.deleteMany({
          where: { organizationMemberId: memberId },
        });
        const customerIds = data.customerIds ?? (data.customerRestricted ? [] : undefined);
        if (customerIds !== undefined && customerIds.length > 0) {
          await tx.organizationMemberCustomer.createMany({
            data: customerIds.map((customerId) => ({
              organizationMemberId: memberId,
              customerId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.organizationMember.findUniqueOrThrow({
        where: { id: memberId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true,
            },
          },
          customers: { include: { customer: true } },
        },
      });
    });

    return {
      message: ApiCode.MEMBER_ROLE_UPDATED_SUCCESSFULLY,
      member: {
        id: updatedMember.id,
        role: updatedMember.role as OrganizationRole,
        joinedAt: updatedMember.createdAt,
        customerRestricted: updatedMember.customerRestricted,
        customers:
          updatedMember.customers?.map((mc) => ({
            id: mc.customer.id,
            name: mc.customer.name,
          })) ?? [],
        user: updatedMember.user,
      },
    };
  }

  async removeMember(
    userId: string,
    organizationId: string,
    memberId: string
  ): Promise<DeleteMemberResponseDto> {
    // Check if user is owner/admin of the organization
    const userMembership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!userMembership) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    // Get the member to remove
    const memberToRemove = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
    });

    if (!memberToRemove) {
      throw new NotFoundException(ApiCode.MEMBER_NOT_FOUND);
    }

    // Prevent removing yourself
    if (memberToRemove.userId === userId) {
      throw new BadRequestException(ApiCode.MEMBER_CANNOT_REMOVE_YOURSELF);
    }

    // Remove member
    await this.prisma.organizationMember.delete({
      where: { id: memberId },
    });

    return { message: ApiCode.MEMBER_REMOVED_SUCCESSFULLY };
  }
}
