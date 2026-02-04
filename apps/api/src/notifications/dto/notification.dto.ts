import { NotificationType } from "@prisma/client";

export interface NotificationDto {
  id: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  read: boolean;
  readAt: Date | null;
  emailSent: boolean;
  emailSentAt: Date | null;
  createdAt: Date;
}

export interface NotificationListResponseDto {
  notifications: NotificationDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UnreadCountResponseDto {
  count: number;
}

export interface CreateNotificationDto {
  organizationId: string;
  type: NotificationType;
  title?: string;
  message?: string;
  metadata?: Record<string, any>;
  sendEmail?: boolean;
}
