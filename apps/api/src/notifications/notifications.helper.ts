import { PrismaService } from "../prisma/prisma.service";
import { NotificationType } from "@prisma/client";
import { getNotificationTranslation } from "./translations";

/**
 * Get organization owners and admins to send notifications to.
 * Uses RBAC: members whose role has USERS:EDIT permission (COMPANY_OWNER) or
 * USERS:CREATE (COMPANY_ADMIN) are considered owners/admins.
 */
export async function getOrganizationOwnersAndAdmins(
  prisma: PrismaService,
  organizationId: string
): Promise<Array<{ id: string; email: string; name: string | null; language: string | null }>> {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    include: {
      user: { select: { id: true, email: true, name: true, language: true } },
      role: { include: { permissions: true } },
    },
  });

  const managersOrAdmins = members.filter((m) => {
    const usersPerm = m.role.permissions.find((p) => p.module === 'USERS');
    return usersPerm?.actions?.includes('CREATE' as any) ?? false;
  });

  return managersOrAdmins.map((member) => ({
    id: member.user.id,
    email: member.user.email,
    name: member.user.name,
    language: member.user.language,
  }));
}

/**
 * Get organization's preferred language from owners/admins.
 * Returns the first owner/admin's language, or "pt" as default.
 */
export async function getOrganizationLanguage(
  prisma: PrismaService,
  organizationId: string
): Promise<string> {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    include: {
      user: { select: { language: true } },
      role: { include: { permissions: true } },
    },
    take: 10,
  });

  const manager = members.find((m) => {
    const usersPerm = m.role.permissions.find((p) => p.module === 'USERS');
    return usersPerm?.actions?.includes('EDIT' as any) ?? false;
  });

  return manager?.user?.language || "pt";
}

export function shouldSendEmail(type: NotificationType): boolean {
  return true;
}

export function formatNotificationMessage(
  type: NotificationType,
  metadata?: Record<string, any>,
  language: string = "pt"
): { title: string; message: string } {
  const translations = getNotificationTranslation(language);

  return {
    title: translations.default.title,
    message: translations.default.message,
  };
}
