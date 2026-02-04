import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { NotificationType } from "@prisma/client";
import {
  getOrganizationOwnersAndAdmins,
  getOrganizationLanguage,
  shouldSendEmail,
  formatNotificationMessage,
} from "./notifications.helper";
import { CreateNotificationDto, NotificationDto } from "./dto/notification.dto";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Create a notification record
   */
  async createNotification(dto: CreateNotificationDto): Promise<NotificationDto> {
    // Get organization's preferred language
    const language = await getOrganizationLanguage(this.prisma, dto.organizationId);
    const { title, message } = formatNotificationMessage(dto.type, dto.metadata, language);

    const notification = await this.prisma.notification.create({
      data: {
        organizationId: dto.organizationId,
        type: dto.type,
        title: dto.title || title,
        message: dto.message || message,
        metadata: dto.metadata || undefined,
      },
    });

    this.logger.log(
      `Created notification ${notification.id} of type ${dto.type} for organization ${dto.organizationId} (language: ${language})`
    );

    return notification as NotificationDto;
  }

  /**
   * Send notification and optionally send email
   */
  async sendNotification(dto: CreateNotificationDto): Promise<NotificationDto> {
    const notification = await this.createNotification(dto);

    // Send email if enabled and type supports it
    if (dto.sendEmail !== false && shouldSendEmail(dto.type)) {
      await this.sendNotificationEmails(notification).catch((error) => {
        this.logger.error(
          `Failed to send notification emails for ${notification.id}: ${error.message}`,
          error.stack
        );
        // Don't throw - notification is already created
      });
    }

    return notification;
  }

  /**
   * Send email notifications to organization owners and admins
   */
  private async sendNotificationEmails(notification: NotificationDto): Promise<void> {
    // Check if email was already sent recently (rate limiting)
    const rateLimitHours = 1;
    const rateLimitAgo = new Date(Date.now() - rateLimitHours * 60 * 60 * 1000);
    const recentNotification = await this.prisma.notification.findFirst({
      where: {
        organizationId: notification.organizationId,
        type: notification.type,
        emailSent: true,
        emailSentAt: {
          gte: rateLimitAgo,
        },
      },
    });

    if (recentNotification) {
      const timeWindow = "last hour";
      this.logger.debug(
        `Skipping email for notification ${notification.id}: similar notification sent within ${timeWindow}`
      );
      return;
    }

    const recipients = await getOrganizationOwnersAndAdmins(
      this.prisma,
      notification.organizationId
    );

    if (recipients.length === 0) {
      this.logger.warn(
        `No owners/admins found for organization ${notification.organizationId}`
      );
      return;
    }

    const appName = this.configService.get("APP_NAME", "RS Frotas");

    // Send email to each recipient
    const emailPromises = recipients.map(async (recipient) => {
      try {
        const language = recipient.language || "pt";
        const html = await this.renderEmailTemplate(notification, language, appName);

        await this.emailService.sendMail({
          to: recipient.email,
          subject: notification.title,
          html,
        });

        this.logger.log(
          `Sent notification email to ${recipient.email} for notification ${notification.id}`
        );
      } catch (error) {
        this.logger.error(
          `Failed to send email to ${recipient.email} for notification ${notification.id}: ${error.message}`
        );
      }
    });

    await Promise.all(emailPromises);

    // Mark notification as email sent
    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        emailSent: true,
        emailSentAt: new Date(),
      },
    });
  }

  /**
   * Render email template based on notification type
   */
  private async renderEmailTemplate(
    notification: NotificationDto,
    language: string,
    appName: string
  ): Promise<string> {
    const metadata = notification.metadata || {};
    const currency = metadata.currency || "USD";
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat(currency === "USD" ? "en-US" : "pt-BR", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    };

    // TODO: Add specific email templates for different notification types
    switch (notification.type) {
      default:
        // Fallback to simple text email
        return `
          <h2>${notification.title}</h2>
          <p>${notification.message}</p>
        `;
    }
  }

  /**
   * Get notifications for an organization
   */
  async getOrganizationNotifications(
    organizationId: string,
    page: number = 1,
    limit: number = 20,
    read?: boolean
  ) {
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (read !== undefined) {
      where.read = read;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications: notifications as NotificationDto[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, organizationId: string): Promise<NotificationDto> {
    const notification = await this.prisma.notification.update({
      where: {
        id: notificationId,
        organizationId, // Ensure user can only mark their org's notifications as read
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return notification as NotificationDto;
  }

  /**
   * Mark all notifications as read for an organization
   */
  async markAllAsRead(organizationId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        organizationId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(organizationId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        organizationId,
        read: false,
      },
    });
  }

  /**
   * Check if a similar notification was sent recently (for deduplication)
   */
  async hasRecentNotification(
    organizationId: string,
    type: NotificationType,
    timeWindowMinutes: number = 60
  ): Promise<boolean> {
    const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const count = await this.prisma.notification.count({
      where: {
        organizationId,
        type,
        createdAt: {
          gte: timeWindow,
        },
      },
    });

    return count > 0;
  }
}
