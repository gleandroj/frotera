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
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      memberships: members.map((member) => ({
        id: member.id,
        role: member.role as OrganizationRole,
        joinedAt: member.createdAt,
        user: member.user,
      })),
    };
  }

  async updateMemberRole(
    userId: string,
    organizationId: string,
    memberId: string,
    role: OrganizationRole
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
    if (memberToUpdate.userId === userId) {
      throw new BadRequestException(ApiCode.MEMBER_CANNOT_CHANGE_OWN_ROLE);
    }

    // Only owners can assign owner role
    if (
      role === OrganizationRole.OWNER &&
      userMembership.role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException(
        ApiCode.MEMBER_ONLY_OWNERS_CAN_ASSIGN_OWNER_ROLE
      );
    }

    // Update member role
    const updatedMember = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      message: ApiCode.MEMBER_ROLE_UPDATED_SUCCESSFULLY,
      member: {
        id: updatedMember.id,
        role: updatedMember.role as OrganizationRole,
        user: updatedMember.user,
        joinedAt: updatedMember.createdAt,
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
