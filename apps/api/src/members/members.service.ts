import { ApiCode } from "@/common/api-codes.enum";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CustomersService } from "../customers/customers.service";
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
  constructor(
    private prisma: PrismaService,
    private customersService: CustomersService,
  ) {}

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

    const isEditingSelf = memberToUpdate.userId === userId;

    // Prevent changing own role (only OWNER can change own role via different flow if needed)
    if (data.role !== undefined && isEditingSelf) {
      throw new BadRequestException(ApiCode.MEMBER_CANNOT_CHANGE_OWN_ROLE);
    }

    // Only organization OWNER can edit their own customer access (restricted/ customerIds)
    if (
      isEditingSelf &&
      userMembership.role !== OrganizationRole.OWNER &&
      (data.customerRestricted !== undefined || data.customerIds !== undefined)
    ) {
      throw new BadRequestException({
        errorCode: ApiCode.MEMBER_CANNOT_EDIT_OWN_ACCESS,
      });
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

    // A member restricted to certain customers cannot grant full organization access
    const editorAllowedIds = await this.customersService.getAllowedCustomerIds(
      {
        id: userMembership.id,
        customerRestricted: userMembership.customerRestricted,
      },
      organizationId,
    );
    if (editorAllowedIds !== null) {
      if (data.customerRestricted === false) {
        throw new BadRequestException({
          errorCode: ApiCode.MEMBER_CANNOT_GRANT_FULL_ACCESS,
        });
      }
      if (data.customerIds !== undefined && data.customerIds.length > 0) {
        const allowedSet = new Set(editorAllowedIds);
        const invalid = data.customerIds.filter((id) => !allowedSet.has(id));
        if (invalid.length > 0) {
          throw new BadRequestException({
            errorCode: ApiCode.COMMON_INVALID_INPUT,
          });
        }
      }
    }

    const updateData: {
      role?: OrganizationRole;
      customerRestricted?: boolean;
    } = {};
    if (data.role !== undefined) updateData.role = data.role;
    if (data.customerRestricted !== undefined) updateData.customerRestricted = data.customerRestricted;

    // Store only root customers: access to a parent automatically includes all descendants at read time
    let customerIdsToStore = data.customerIds ?? (data.customerRestricted ? [] : undefined);
    if (customerIdsToStore !== undefined && customerIdsToStore.length > 0) {
      customerIdsToStore = await this.customersService.getRootCustomerIds(
        organizationId,
        customerIdsToStore,
      );
    }

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
        if (customerIdsToStore !== undefined && customerIdsToStore.length > 0) {
          await tx.organizationMemberCustomer.createMany({
            data: customerIdsToStore.map((customerId) => ({
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
