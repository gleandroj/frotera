import { PrismaService } from "../prisma/prisma.service";
import { NotificationType } from "@prisma/client";
import { getNotificationTranslation } from "./translations";

/**
 * Get organization owners and admins to send notifications to
 */
export async function getOrganizationOwnersAndAdmins(
  prisma: PrismaService,
  organizationId: string
): Promise<Array<{ id: string; email: string; name: string | null; language: string | null }>> {
  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId,
      role: {
        in: ["OWNER", "ADMIN"],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          language: true,
        },
      },
    },
  });

  return members.map((member) => ({
    id: member.user.id,
    email: member.user.email,
    name: member.user.name,
    language: member.user.language,
  }));
}

/**
 * Get organization's preferred language from owners/admins
 * Returns the first owner/admin's language, or "pt" as default
 */
export async function getOrganizationLanguage(
  prisma: PrismaService,
  organizationId: string
): Promise<string> {
  const members = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      role: {
        in: ["OWNER", "ADMIN"],
      },
    },
    include: {
      user: {
        select: {
          language: true,
        },
      },
    },
    orderBy: {
      role: "asc", // OWNER comes before ADMIN
    },
  });

  return members?.user?.language || "pt";
}

/**
 * Determine if email should be sent for a notification type
 */
export function shouldSendEmail(type: NotificationType): boolean {
  // TODO: Add logic for different notification types
  return true;
}

/**
 * Format notification message with context
 */
export function formatNotificationMessage(
  type: NotificationType,
  metadata?: Record<string, any>,
  language: string = "pt"
): { title: string; message: string } {
  const translations = getNotificationTranslation(language);

  // TODO: Add specific handling for different notification types
  return {
    title: translations.default.title,
    message: translations.default.message,
  };
}
