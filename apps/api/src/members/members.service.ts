import { ApiCode } from "@/common/api-codes.enum";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService } from "../auth/auth.service";
import { CustomersService } from "../customers/customers.service";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateMemberDto,
  CreateMemberResponseDto,
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
    private authService: AuthService,
    private emailService: EmailService,
  ) {}

  async getMembers(
    userId: string,
    organizationId: string,
    filterCustomerId?: string,
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

    // Get organization members (exclude system super admin users)
    let members = await this.prisma.organizationMember.findMany({
      where: { organizationId, user: { isSuperAdmin: false } },
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

    // Enforce requesting user's own customer restrictions: restricted users must never see
    // members from customers outside their own accessible customer scope.
    const requestingUserAllowedIds = await this.customersService.getAllowedCustomerIds(
      { id: organizationMember.id, customerRestricted: organizationMember.customerRestricted },
      organizationId,
    );

    if (requestingUserAllowedIds !== null) {
      const allowedSet = new Set(requestingUserAllowedIds);
      members = members.filter((member) => {
        if (!member.customerRestricted) return true;
        const memberCustomerIds = member.customers?.map((mc) => mc.customer.id) ?? [];
        return memberCustomerIds.some((id) => allowedSet.has(id));
      });
    }

    // When global customer filter is set: only members that have access to that customer
    if (filterCustomerId?.trim()) {
      const customerIdAndAncestors = await this.customersService.getCustomerIdAndAncestorIds(
        filterCustomerId.trim(),
        organizationId,
      );
      if (customerIdAndAncestors.length > 0) {
        const allowedSet = new Set(customerIdAndAncestors);
        members = members.filter((member) => {
          if (!member.customerRestricted) return true;
          const memberCustomerIds = member.customers?.map((mc) => mc.customer.id) ?? [];
          return memberCustomerIds.some((id) => allowedSet.has(id));
        });
      }
    }

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

  async createMember(
    userId: string,
    organizationId: string,
    data: CreateMemberDto
  ): Promise<CreateMemberResponseDto> {
    // Caller must be OWNER or ADMIN
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

    // Cannot create a new member with OWNER role (only transfer existing ownership elsewhere)
    if (data.role === OrganizationRole.OWNER) {
      throw new ForbiddenException(
        ApiCode.MEMBER_ONLY_OWNERS_CAN_ASSIGN_OWNER_ROLE
      );
    }

    const customerRestricted =
      data.customerRestricted ?? (data.customerIds?.length ? true : false);
    const customerIdsToValidate = data.customerIds ?? [];

    // Validate customer access: caller cannot grant full access if they are restricted
    const editorAllowedIds = await this.customersService.getAllowedCustomerIds(
      {
        id: userMembership.id,
        customerRestricted: userMembership.customerRestricted,
      },
      organizationId
    );
    if (editorAllowedIds !== null) {
      if (!customerRestricted || customerIdsToValidate.length === 0) {
        throw new BadRequestException({
          errorCode: ApiCode.MEMBER_CANNOT_GRANT_FULL_ACCESS,
        });
      }
      const allowedSet = new Set(editorAllowedIds);
      const invalid = customerIdsToValidate.filter((id) => !allowedSet.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException({
          errorCode: ApiCode.COMMON_INVALID_INPUT,
        });
      }
    } else if (customerRestricted && customerIdsToValidate.length > 0) {
      const customersInOrg = await this.prisma.customer.findMany({
        where: { id: { in: customerIdsToValidate }, organizationId },
        select: { id: true },
      });
      const validIds = new Set(customersInOrg.map((c) => c.id));
      const invalid = customerIdsToValidate.filter((id) => !validIds.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException({
          errorCode: ApiCode.COMMON_INVALID_INPUT,
        });
      }
    }

    // Check if user with this email is already a member of this organization
    const existingMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email: data.email.toLowerCase() },
      },
    });

    if (existingMember) {
      throw new BadRequestException({
        errorCode: ApiCode.USER_ALREADY_EXISTS,
      });
    }

    // Create user (throws USER_ALREADY_EXISTS if email already exists globally)
    const user = await this.authService.createUserWithPassword({
      email: data.email,
      password: data.password,
      name: data.name,
    });

    // Store only root customers for access
    let customerIdsToStore =
      customerRestricted && customerIdsToValidate.length > 0
        ? await this.customersService.getRootCustomerIds(
            organizationId,
            customerIdsToValidate
          )
        : [];

    const member = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId,
          role: data.role,
          customerRestricted: customerRestricted,
          customers:
            customerIdsToStore.length > 0
              ? {
                  create: customerIdsToStore.map((customerId) => ({
                    customerId,
                  })),
                }
              : undefined,
        },
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
      return created;
    });

    const loginUrl = `${process.env.FRONTEND_URL || ""}/login`;
    this.emailService
      .sendAccountCreatedEmail({
        to: user.email,
        name: user.name,
        loginUrl,
        language: "pt",
      })
      .catch((err) => {
        console.error("[MembersService] Failed to send account-created email:", err);
      });

    return {
      message: ApiCode.MEMBER_CREATED_SUCCESSFULLY,
      member: {
        id: member.id,
        role: member.role as OrganizationRole,
        joinedAt: member.createdAt,
        customerRestricted: member.customerRestricted,
        customers:
          member.customers?.map((mc) => ({
            id: mc.customer.id,
            name: mc.customer.name,
          })) ?? [],
        user: member.user,
      },
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

    // Validate new email uniqueness before entering the transaction
    if (data.email !== undefined) {
      const normalizedEmail = data.email.toLowerCase();
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existingUser && existingUser.id !== memberToUpdate.userId) {
        throw new BadRequestException({
          errorCode: ApiCode.USER_ALREADY_EXISTS,
        });
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

    // Pre-hash password outside the transaction to keep it short
    let hashedPassword: string | undefined;
    if (data.newPassword !== undefined) {
      hashedPassword = await bcrypt.hash(data.newPassword, 10);
    }

    const updatedMember = await this.prisma.$transaction(async (tx) => {
      // Update user profile fields if any were provided
      const userUpdateData: {
        name?: string;
        email?: string;
        password?: string;
      } = {};
      if (data.name !== undefined) userUpdateData.name = data.name;
      if (data.email !== undefined) userUpdateData.email = data.email.toLowerCase();
      if (hashedPassword !== undefined) userUpdateData.password = hashedPassword;

      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: memberToUpdate.userId },
          data: userUpdateData,
        });
      }

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
