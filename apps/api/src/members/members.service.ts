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
  UpdateMemberDto,
  UpdateMemberResponseDto,
} from "./members.dto";
import { RoleResponseDto, SystemRoleKey } from "../roles/roles.dto";

function formatMemberRole(role: any): RoleResponseDto {
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
    includeInactive = false,
  ): Promise<MembersListResponseDto> {
    const requestingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });

    const organizationMember = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId, active: true },
    });

    if (!organizationMember) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    let members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { active: true }),
        ...(requestingUser?.isSuperAdmin === true
          ? {}
          : { user: { isSuperAdmin: false, isSystemUser: false } }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            isSuperAdmin: true,
            isSystemUser: true,
          },
        },
        role: { include: { permissions: true } },
        customers: { include: { customer: true } },
        vehicles: { select: { vehicle: { select: { id: true, name: true, plate: true } } } },
        drivers: { select: { driver: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    const requestingUserAllowedIds =
      await this.customersService.getAllowedCustomerIds(
        {
          id: organizationMember.id,
          customerRestricted: organizationMember.customerRestricted,
        },
        organizationId,
      );

    if (requestingUserAllowedIds !== null) {
      const filtered = await Promise.all(
        members.map(async (member) =>
          (await this.customersService.memberOverlapsViewerCustomerIds(
            { id: member.id, customerRestricted: member.customerRestricted },
            organizationId,
            requestingUserAllowedIds,
          ))
            ? member
            : null,
        ),
      );
      members = filtered.filter((m): m is NonNullable<typeof m> => m !== null);
    }

    if (filterCustomerId?.trim()) {
      const customerIdAndAncestors =
        await this.customersService.getCustomerIdAndAncestorIds(
          filterCustomerId.trim(),
          organizationId,
        );
      if (customerIdAndAncestors.length > 0) {
        const ancestorSet = new Set(customerIdAndAncestors);
        if (requestingUserAllowedIds === null) {
          members = members.filter((member) => {
            if (!member.customerRestricted) return true;
            const memberCustomerIds =
              member.customers?.map((mc) => mc.customer.id) ?? [];
            return memberCustomerIds.some((id) => ancestorSet.has(id));
          });
        } else {
          const filtered = await Promise.all(
            members.map(async (member) => {
              const mAllowed =
                await this.customersService.getAllowedCustomerIds(
                  {
                    id: member.id,
                    customerRestricted: member.customerRestricted,
                  },
                  organizationId,
                );
              if (mAllowed === null || mAllowed.length === 0) return null;
              return mAllowed.some((id) => ancestorSet.has(id)) ? member : null;
            }),
          );
          members = filtered.filter(
            (m): m is NonNullable<typeof m> => m !== null,
          );
        }
      }
    }

    return {
      memberships: members.map((member) => ({
        id: member.id,
        role: formatMemberRole(member.role),
        joinedAt: member.createdAt,
        isActive: member.active,
        customerRestricted: member.customerRestricted,
        customers:
          member.customers?.map((mc) => ({
            id: mc.customer.id,
            name: mc.customer.name,
          })) ?? [],
        vehicles: (member.vehicles ?? []).map((mv: any) => mv.vehicle),
        drivers: (member.drivers ?? []).map((md: any) => md.driver),
        user: member.user,
      })),
    };
  }

  async createMember(
    userId: string,
    organizationId: string,
    data: CreateMemberDto,
  ): Promise<CreateMemberResponseDto> {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });

    const userMembership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId, active: true },
      include: { role: { include: { permissions: true } } },
    });

    if (!userMembership) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    if (
      userRecord?.isSuperAdmin !== true &&
      (data.isSuperAdmin !== undefined || data.isSystemUser !== undefined)
    ) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    const usersPerm = userMembership.role.permissions.find(
      (p) => p.module === "USERS",
    );
    const canCreate = usersPerm?.actions?.includes("CREATE" as any) ?? false;
    if (!canCreate) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    // Validate roleId exists and belongs to this org or is a system role
    const targetRole = await this.prisma.role.findFirst({
      where: {
        id: data.roleId,
        OR: [{ organizationId: null }, { organizationId }],
      },
    });
    if (!targetRole) {
      throw new BadRequestException({
        errorCode: ApiCode.COMMON_INVALID_INPUT,
      });
    }

    // Only members with USERS:EDIT can assign COMPANY_OWNER role
    const isAssigningOwnerRole = targetRole.key === SystemRoleKey.COMPANY_OWNER;
    if (isAssigningOwnerRole) {
      const canEdit = usersPerm?.actions?.includes("EDIT" as any) ?? false;
      if (!canEdit) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }

    // Only superadmin can assign ORGANIZATION_OWNER role
    if (targetRole.key === SystemRoleKey.ORGANIZATION_OWNER) {
      if (userRecord?.isSuperAdmin !== true) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }

    const customerRestricted =
      data.customerRestricted ?? (data.customerIds?.length ? true : false);
    const customerIdsToValidate = data.customerIds ?? [];

    // COMPANY_OWNER must always be assigned to at least one specific company
    if (targetRole.key === SystemRoleKey.COMPANY_OWNER) {
      if (!customerRestricted || customerIdsToValidate.length === 0) {
        throw new BadRequestException({
          errorCode: ApiCode.MEMBER_CANNOT_GRANT_FULL_ACCESS,
        });
      }
    }

    const editorAllowedIds = await this.customersService.getAllowedCustomerIds(
      {
        id: userMembership.id,
        customerRestricted: userMembership.customerRestricted,
      },
      organizationId,
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

    const existingMember = await this.prisma.organizationMember.findFirst({
      where: { organizationId, user: { email: data.email.toLowerCase() } },
    });

    if (existingMember) {
      throw new BadRequestException({ errorCode: ApiCode.USER_ALREADY_EXISTS });
    }

    const user = await this.authService.createUserWithPassword({
      email: data.email,
      password: data.password,
      name: data.name,
      isSuperAdmin:
        userRecord?.isSuperAdmin === true ? data.isSuperAdmin : undefined,
      isSystemUser:
        userRecord?.isSuperAdmin === true ? data.isSystemUser : undefined,
    });

    let customerIdsToStore =
      customerRestricted && customerIdsToValidate.length > 0
        ? await this.customersService.getRootCustomerIds(
            organizationId,
            customerIdsToValidate,
          )
        : [];

    const member = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId,
          roleId: data.roleId,
          customerRestricted,
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
              isSuperAdmin: true,
              isSystemUser: true,
            },
          },
          role: { include: { permissions: true } },
          customers: { include: { customer: true } },
          vehicles: { select: { vehicle: { select: { id: true, name: true, plate: true } } } },
          drivers: { select: { driver: { select: { id: true, name: true } } } },
        },
      });
      return created;
    });

    if (data.sendCredentials) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mustChangePassword: true },
      });
    }

    const loginUrl = `${process.env.APP_URL || ""}/login`;
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (data.sendCredentials && organization) {
      this.emailService
        .sendWelcomeCredentialsEmail({
          to: user.email,
          name: user.name,
          email: user.email,
          temporaryPassword: data.password,
          loginUrl,
          language: "pt",
          organizationName: organization.name,
        })
        .catch((err) => {
          console.error(
            "[MembersService] Failed to send welcome credentials email:",
            err,
          );
        });
    } else {
      this.emailService
        .sendAccountCreatedEmail({
          to: user.email,
          name: user.name,
          loginUrl,
          language: "pt",
        })
        .catch((err) => {
          console.error(
            "[MembersService] Failed to send account-created email:",
            err,
          );
        });
    }

    return {
      message: ApiCode.MEMBER_CREATED_SUCCESSFULLY,
      member: {
        id: member.id,
        role: formatMemberRole(member.role),
        joinedAt: member.createdAt,
        isActive: member.active,
        customerRestricted: member.customerRestricted,
        customers:
          member.customers?.map((mc) => ({
            id: mc.customer.id,
            name: mc.customer.name,
          })) ?? [],
        vehicles: (member.vehicles ?? []).map((mv: any) => mv.vehicle),
        drivers: (member.drivers ?? []).map((md: any) => md.driver),
        user: member.user,
      },
    };
  }

  async updateMember(
    userId: string,
    organizationId: string,
    memberId: string,
    data: UpdateMemberDto,
  ): Promise<UpdateMemberResponseDto> {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });

    const userMembership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId, active: true },
      include: { role: { include: { permissions: true } } },
    });

    if (!userMembership) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    if (
      userRecord?.isSuperAdmin !== true &&
      (data.isSuperAdmin !== undefined || data.isSystemUser !== undefined)
    ) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    const usersPerm = userMembership.role.permissions.find(
      (p) => p.module === "USERS",
    );
    const canEdit = usersPerm?.actions?.includes("EDIT" as any) ?? false;
    if (!canEdit) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    const memberToUpdate = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      include: {
        user: true,
        role: { include: { permissions: true } },
        customers: { select: { customerId: true } },
      },
    });

    if (!memberToUpdate) {
      throw new NotFoundException(ApiCode.MEMBER_NOT_FOUND);
    }

    const isEditingSelf = memberToUpdate.userId === userId;

    if (data.roleId !== undefined && data.roleId !== memberToUpdate.roleId && isEditingSelf) {
      throw new BadRequestException(ApiCode.MEMBER_CANNOT_CHANGE_OWN_ROLE);
    }

    // Only block self-edit of customer access when values actually change
    const currentCustomerIdSet = new Set(memberToUpdate.customers.map((c) => c.customerId));
    const customerIdsChanging =
      data.customerIds !== undefined &&
      (data.customerIds.length !== currentCustomerIdSet.size ||
        data.customerIds.some((id) => !currentCustomerIdSet.has(id)));
    if (
      isEditingSelf &&
      (
        (data.customerRestricted !== undefined && data.customerRestricted !== memberToUpdate.customerRestricted) ||
        customerIdsChanging
      )
    ) {
      throw new BadRequestException({
        errorCode: ApiCode.MEMBER_CANNOT_EDIT_OWN_ACCESS,
      });
    }

    // Validate new roleId if provided
    if (data.roleId !== undefined) {
      const targetRole = await this.prisma.role.findFirst({
        where: {
          id: data.roleId,
          OR: [{ organizationId: null }, { organizationId }],
        },
      });
      if (!targetRole) {
        throw new BadRequestException({
          errorCode: ApiCode.COMMON_INVALID_INPUT,
        });
      }
      // Only superadmin can assign ORGANIZATION_OWNER role
      if (targetRole.key === SystemRoleKey.ORGANIZATION_OWNER) {
        if (userRecord?.isSuperAdmin !== true) {
          throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
        }
      }
    }

    const editorAllowedIds = await this.customersService.getAllowedCustomerIds(
      {
        id: userMembership.id,
        customerRestricted: userMembership.customerRestricted,
      },
      organizationId,
    );
    if (editorAllowedIds !== null) {
      const targetAllowed = await this.customersService.getAllowedCustomerIds(
        {
          id: memberToUpdate.id,
          customerRestricted: memberToUpdate.customerRestricted,
        },
        organizationId,
      );
      if (
        targetAllowed === null ||
        targetAllowed.length === 0 ||
        !targetAllowed.some((id) => editorAllowedIds.includes(id))
      ) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
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

    const updateData: { roleId?: string; customerRestricted?: boolean } = {};
    if (data.roleId !== undefined) updateData.roleId = data.roleId;
    if (data.customerRestricted !== undefined)
      updateData.customerRestricted = data.customerRestricted;

    let customerIdsToStore =
      data.customerIds ?? (data.customerRestricted ? [] : undefined);
    if (customerIdsToStore !== undefined && customerIdsToStore.length > 0) {
      customerIdsToStore = await this.customersService.getRootCustomerIds(
        organizationId,
        customerIdsToStore,
      );
    }

    let hashedPassword: string | undefined;
    if (data.newPassword !== undefined) {
      hashedPassword = await bcrypt.hash(data.newPassword, 10);
    }

    const updatedMember = await this.prisma.$transaction(async (tx) => {
      const userUpdateData: {
        name?: string;
        email?: string;
        password?: string;
        isSuperAdmin?: boolean;
        isSystemUser?: boolean;
      } = {};
      if (data.name !== undefined) userUpdateData.name = data.name;
      if (data.email !== undefined)
        userUpdateData.email = data.email.toLowerCase();
      if (hashedPassword !== undefined)
        userUpdateData.password = hashedPassword;
      if (userRecord?.isSuperAdmin === true) {
        if (data.isSuperAdmin !== undefined)
          userUpdateData.isSuperAdmin = data.isSuperAdmin;
        if (data.isSystemUser !== undefined)
          userUpdateData.isSystemUser = data.isSystemUser;
      }

      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: memberToUpdate.userId },
          data: userUpdateData,
        });
      }

      await tx.organizationMember.update({
        where: { id: memberId },
        data: updateData,
      });

      if (
        data.customerRestricted !== undefined ||
        data.customerIds !== undefined
      ) {
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
              isSuperAdmin: true,
              isSystemUser: true,
            },
          },
          role: { include: { permissions: true } },
          customers: { include: { customer: true } },
          vehicles: { select: { vehicle: { select: { id: true, name: true, plate: true } } } },
          drivers: { select: { driver: { select: { id: true, name: true } } } },
        },
      });
    });

    return {
      message: ApiCode.MEMBER_ROLE_UPDATED_SUCCESSFULLY,
      member: {
        id: updatedMember.id,
        role: formatMemberRole(updatedMember.role),
        joinedAt: updatedMember.createdAt,
        isActive: updatedMember.active,
        customerRestricted: updatedMember.customerRestricted,
        customers:
          updatedMember.customers?.map((mc) => ({
            id: mc.customer.id,
            name: mc.customer.name,
          })) ?? [],
        vehicles: (updatedMember.vehicles ?? []).map((mv: any) => mv.vehicle),
        drivers: (updatedMember.drivers ?? []).map((md: any) => md.driver),
        user: updatedMember.user,
      },
    };
  }

  async removeMember(
    userId: string,
    organizationId: string,
    memberId: string,
  ): Promise<DeleteMemberResponseDto> {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });

    const userMembership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId, active: true },
      include: { role: { include: { permissions: true } } },
    });

    if (!userMembership) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    if (userRecord?.isSuperAdmin !== true) {
      const usersPerm = userMembership.role.permissions.find(
        (p) => p.module === "USERS",
      );
      const canDelete = usersPerm?.actions?.includes("DELETE" as any) ?? false;
      if (!canDelete) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }

    const memberToRemove = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });

    if (!memberToRemove) {
      throw new NotFoundException(ApiCode.MEMBER_NOT_FOUND);
    }

    if (memberToRemove.userId === userId) {
      throw new BadRequestException(ApiCode.MEMBER_CANNOT_REMOVE_YOURSELF);
    }

    const editorAllowedIds = await this.customersService.getAllowedCustomerIds(
      {
        id: userMembership.id,
        customerRestricted: userMembership.customerRestricted,
      },
      organizationId,
    );
    if (editorAllowedIds !== null) {
      const targetAllowed = await this.customersService.getAllowedCustomerIds(
        {
          id: memberToRemove.id,
          customerRestricted: memberToRemove.customerRestricted,
        },
        organizationId,
      );
      if (
        targetAllowed === null ||
        targetAllowed.length === 0 ||
        !targetAllowed.some((id) => editorAllowedIds.includes(id))
      ) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }

    await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { active: false },
    });

    return { message: ApiCode.MEMBER_REMOVED_SUCCESSFULLY };
  }

  async enableMember(
    userId: string,
    organizationId: string,
    memberId: string,
  ): Promise<DeleteMemberResponseDto> {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });

    const userMembership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId, active: true },
      include: { role: { include: { permissions: true } } },
    });

    if (!userMembership) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    if (userRecord?.isSuperAdmin !== true) {
      const usersPerm = userMembership.role.permissions.find(
        (p) => p.module === "USERS",
      );
      const canEdit = usersPerm?.actions?.includes("EDIT" as any) ?? false;
      if (!canEdit) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }

    const memberToEnable = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });

    if (!memberToEnable) {
      throw new NotFoundException(ApiCode.MEMBER_NOT_FOUND);
    }

    const editorAllowedIds = await this.customersService.getAllowedCustomerIds(
      {
        id: userMembership.id,
        customerRestricted: userMembership.customerRestricted,
      },
      organizationId,
    );
    if (editorAllowedIds !== null) {
      const targetAllowed = await this.customersService.getAllowedCustomerIds(
        {
          id: memberToEnable.id,
          customerRestricted: memberToEnable.customerRestricted,
        },
        organizationId,
      );
      if (
        targetAllowed === null ||
        targetAllowed.length === 0 ||
        !targetAllowed.some((id) => editorAllowedIds.includes(id))
      ) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }

    await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { active: true },
    });

    return { message: ApiCode.MEMBER_ENABLED_SUCCESSFULLY };
  }

  async setMemberVehicles(
    organizationId: string,
    memberId: string,
    vehicleIds: string[],
  ): Promise<void> {
    // Verify membership belongs to org
    const membership = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!membership) throw new NotFoundException(ApiCode.MEMBER_NOT_FOUND);

    // Validate all vehicleIds belong to this org
    if (vehicleIds.length > 0) {
      const vehicles = await this.prisma.vehicle.findMany({
        where: { id: { in: vehicleIds }, organizationId },
        select: { id: true },
      });
      if (vehicles.length !== vehicleIds.length)
        throw new BadRequestException({
          errorCode: ApiCode.COMMON_INVALID_INPUT,
        });
    }

    // Replace: delete all existing, create new
    await this.prisma.$transaction([
      this.prisma.organizationMemberVehicle.deleteMany({
        where: { organizationMemberId: memberId },
      }),
      ...(vehicleIds.length > 0
        ? [this.prisma.organizationMemberVehicle.createMany({
            data: vehicleIds.map((vehicleId) => ({ organizationMemberId: memberId, vehicleId })),
            skipDuplicates: true,
          })]
        : []),
    ]);
  }

  async setMemberDrivers(
    organizationId: string,
    memberId: string,
    driverIds: string[],
  ): Promise<void> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!membership) throw new NotFoundException(ApiCode.MEMBER_NOT_FOUND);

    if (driverIds.length > 0) {
      const drivers = await this.prisma.driver.findMany({
        where: { id: { in: driverIds }, organizationId },
        select: { id: true },
      });
      if (drivers.length !== driverIds.length)
        throw new BadRequestException({
          errorCode: ApiCode.COMMON_INVALID_INPUT,
        });
    }

    await this.prisma.$transaction([
      this.prisma.organizationMemberDriver.deleteMany({
        where: { organizationMemberId: memberId },
      }),
      ...(driverIds.length > 0
        ? [this.prisma.organizationMemberDriver.createMany({
            data: driverIds.map((driverId) => ({ organizationMemberId: memberId, driverId })),
            skipDuplicates: true,
          })]
        : []),
    ]);
  }
}
