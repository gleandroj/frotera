import { ApiCode } from "@/common/api-codes.enum";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { AuthService } from "../auth/auth.service";
import { CustomersService } from "../customers/customers.service";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  AcceptInvitationResponseDto,
  CreateInvitationDto,
  InvitationCheckResponseDto,
  InvitationsListResponseDto,
  InvitationStatus,
  OrganizationRole,
  ResendInvitationDto,
} from "./invitations.dto";

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private emailService: EmailService,
    private customersService: CustomersService,
  ) {}

  async createInvitation(
    userId: string,
    data: CreateInvitationDto & { organizationId: string; customerIds?: string[] }
  ) {
    const { email, organizationId, role, language, customerIds } = data;
    const customerRestricted = "customerIds" in data && Array.isArray(data.customerIds);

    // Check if user is admin/owner of the organization
    const organizationMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
      include: {
        organization: true,
        user: true,
      },
    });

    if (!organizationMember) {
      throw new ForbiddenException({
        errorCode: ApiCode.AUTH_FORBIDDEN,
      });
    }

    // A member restricted to certain customers cannot grant full organization access
    const inviterAllowedIds = await this.customersService.getAllowedCustomerIds(
      { id: organizationMember.id, customerRestricted: organizationMember.customerRestricted },
      organizationId,
    );
    if (inviterAllowedIds !== null) {
      if (!customerRestricted || (customerIds?.length ?? 0) === 0) {
        throw new BadRequestException({ errorCode: ApiCode.MEMBER_CANNOT_GRANT_FULL_ACCESS });
      }
      const allowedSet = new Set(inviterAllowedIds);
      const invalid = customerIds!.filter((id: string) => !allowedSet.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException({ errorCode: ApiCode.COMMON_INVALID_INPUT });
      }
    } else if (customerRestricted && (customerIds?.length ?? 0) > 0) {
      const customersInOrg = await this.prisma.customer.findMany({
        where: { id: { in: customerIds! }, organizationId },
        select: { id: true },
      });
      const validIds = new Set(customersInOrg.map((c) => c.id));
      const invalid = customerIds!.filter((id: string) => !validIds.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException({ errorCode: ApiCode.COMMON_INVALID_INPUT });
      }
    }

    // Check if user is already a member
    const existingMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email },
      },
    });

    if (existingMember) {
      throw new BadRequestException({
        errorCode: ApiCode.USER_ALREADY_EXISTS,
      });
    }

    // Check if there's already a pending invitation
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        email,
        organizationId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      throw new BadRequestException({
        errorCode: ApiCode.INVITATION_ALREADY_SENT,
      });
    }

    // Store only root customers: access to a parent automatically includes all descendants at read time
    let customerIdsToStore = customerIds;
    if (customerRestricted && (customerIdsToStore?.length ?? 0) > 0) {
      customerIdsToStore = await this.customersService.getRootCustomerIds(
        organizationId,
        customerIdsToStore!,
      );
    }

    // Create invitation
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.invitation.create({
      data: {
        email,
        organizationId,
        role: role as any, // Type assertion needed due to Prisma enum type
        token,
        expiresAt,
        inviterId: userId,
        customerRestricted,
        customers: customerRestricted && (customerIdsToStore?.length ?? 0) > 0
          ? { create: customerIdsToStore!.map((customerId: string) => ({ customerId })) }
          : undefined,
      },
      include: { customers: { include: { customer: true } } },
    });

    // Send invitation email
    const acceptUrl = `${process.env.FRONTEND_URL}/accept-invitation?token=${token}`;

    // Check if the invited user already exists to use their language preference
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { language: true },
    });

    await this.emailService.sendInvitationEmail({
      to: email,
      organizationName: organizationMember.organization.name,
      inviterName:
        organizationMember.user.name || organizationMember.user.email,
      inviterEmail: organizationMember.user.email,
      acceptUrl,
      language: existingUser?.language || language || "pt", // Use existing user's language preference if available
    });

    return {
      message: ApiCode.INVITATION_SENT_SUCCESSFULLY,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role as OrganizationRole,
        expiresAt: invitation.expiresAt,
        customerRestricted: invitation.customerRestricted,
        customers: invitation.customers?.map((ic) => ({ id: ic.customer.id, name: ic.customer.name })) ?? [],
      },
    };
  }

  async getInvitations(
    userId: string,
    organizationId: string
  ): Promise<InvitationsListResponseDto> {
    // Check if user is member of the organization
    const organizationMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!organizationMember) {
      throw new ForbiddenException({
        errorCode: ApiCode.AUTH_FORBIDDEN,
      });
    }

    // Get all invitations for the organization
    const invitations = await this.prisma.invitation.findMany({
      where: {
        organizationId,
        status: "PENDING",
      },
      include: {
        inviter: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        customers: { include: { customer: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role as OrganizationRole,
        status: invitation.status as InvitationStatus,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        customerRestricted: invitation.customerRestricted,
        customers: invitation.customers?.map((ic) => ({ id: ic.customer.id, name: ic.customer.name })) ?? [],
        inviter: invitation.inviter,
      })),
    };
  }

  async resendInvitation(
    userId: string,
    organizationId: string,
    data: ResendInvitationDto
  ) {
    const { invitationId, language } = data;

    // Check if user is admin/owner of the organization
    const organizationMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
      include: {
        organization: true,
        user: true,
      },
    });

    if (!organizationMember) {
      throw new ForbiddenException({
        errorCode: ApiCode.AUTH_FORBIDDEN,
      });
    }

    // Get the invitation
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
        status: "PENDING",
      },
    });

    if (!invitation) {
      throw new NotFoundException({
        errorCode: ApiCode.INVITATION_NOT_FOUND,
      });
    }

    // Update expiration date
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { expiresAt },
    });

    // Send invitation email
    const acceptUrl = `${process.env.FRONTEND_URL}/accept-invitation?token=${invitation.token}`;

    // Check if the invited user already exists to use their language preference
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { language: true },
    });

    await this.emailService.sendInvitationEmail({
      to: invitation.email,
      organizationName: organizationMember.organization.name,
      inviterName:
        organizationMember.user.name || organizationMember.user.email,
      inviterEmail: organizationMember.user.email,
      acceptUrl,
      language: existingUser?.language || language || "pt", // Use existing user's language preference if available
    });

    return {
      message: ApiCode.INVITATION_RESENT_SUCCESSFULLY,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role as OrganizationRole,
        expiresAt,
      },
    };
  }

  async revokeInvitation(
    userId: string,
    organizationId: string,
    invitationId: string
  ) {
    // Check if user is admin/owner of the organization
    const organizationMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!organizationMember) {
      throw new ForbiddenException({
        errorCode: ApiCode.AUTH_FORBIDDEN,
      });
    }

    // Update invitation status to REVOKED
    const invitation = await this.prisma.invitation.update({
      where: {
        id: invitationId,
        organizationId,
      },
      data: { status: "REVOKED" },
    });

    if (!invitation) {
      throw new NotFoundException({
        errorCode: ApiCode.INVITATION_NOT_FOUND,
      });
    }

    return {
      message: ApiCode.INVITATION_REVOKED_SUCCESSFULLY,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role as OrganizationRole,
        status: invitation.status,
      },
    };
  }

  async checkInvitation(token: string): Promise<InvitationCheckResponseDto> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        inviter: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        customers: { include: { customer: true } },
      },
    });

    if (!invitation) {
      throw new BadRequestException({
        errorCode: ApiCode.INVALID_INVITATION_TOKEN,
      });
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException({
        errorCode: ApiCode.INVITATION_EXPIRED,
      });
    }

    if (invitation.status === "ACCEPTED") {
      throw new BadRequestException({
        errorCode: ApiCode.INVITATION_ALREADY_ACCEPTED,
      });
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });

    return {
      invitation: {
        email: invitation.email,
        role: invitation.role as OrganizationRole,
        expiresAt: invitation.expiresAt,
        customerRestricted: invitation.customerRestricted,
        customers: invitation.customers?.map((ic) => ({ id: ic.customer.id, name: ic.customer.name })) ?? [],
        organization: invitation.organization,
        inviter: invitation.inviter,
      },
      userExists: !!existingUser,
    };
  }

  async acceptInvitation(
    token: string,
    data: { password?: string; name?: string }
  ): Promise<AcceptInvitationResponseDto> {
    const { password, name } = data;

    // Find the invitation
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organization: true, customers: true },
    });

    if (!invitation) {
      throw new BadRequestException({
        errorCode: ApiCode.INVALID_INVITATION_TOKEN,
      });
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException({
        errorCode: ApiCode.INVITATION_EXPIRED,
      });
    }

    if (invitation.status === "ACCEPTED") {
      throw new BadRequestException({
        errorCode: ApiCode.INVITATION_ALREADY_ACCEPTED,
      });
    }

    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (!user) {
      // For new users, password is required
      if (!password) {
        throw new BadRequestException(
          ApiCode.PASSWORD_REQUIRED_FOR_NEW_USER_REGISTRATION
        );
      }

      // Create new user without creating an organization (they join the inviting org)
      await this.authService.signupFromInvitation({
        email: invitation.email,
        password,
        name: name || invitation.email.split("@")[0],
      });

      // Get the newly created user
      user = await this.prisma.user.findUnique({
        where: { email: invitation.email },
      });

      if (!user) {
        throw new BadRequestException({
          errorCode: ApiCode.FAILED_TO_CREATE_USER,
        });
      }

      // Auto-verify email for accounts created from invitations
      // Since the invitation was sent to this email, we can trust it's verified
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });

      // Update the user object to reflect the verified status
      user.emailVerified = new Date();
    }

    // Create organization member
    const organizationMember = await this.prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
        customerRestricted: invitation.customerRestricted,
        customers:
          invitation.customerRestricted && invitation.customers?.length
            ? {
                create: invitation.customers.map((ic) => ({
                  customerId: ic.customerId,
                })),
              }
            : undefined,
      },
    });

    // Mark invitation as accepted
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });

    // Get full organization details
    const organization = await this.prisma.organization.findUnique({
      where: { id: invitation.organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
      },
    });

    if (!organization) {
      throw new NotFoundException({
        errorCode: ApiCode.ORGANIZATION_NOT_FOUND,
      });
    }

    return {
      message: ApiCode.INVITATION_ACCEPTED_SUCCESSFULLY,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: organizationMember.role as OrganizationRole,
        isNewUser:
          !user.createdAt ||
          new Date().getTime() - new Date(user.createdAt).getTime() < 5000,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        description: organization.description,
        createdAt: organization.createdAt,
      },
    };
  }
}
