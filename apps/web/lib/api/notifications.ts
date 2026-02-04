import { externalApi } from "../frontend/api-client";

const BASE = "/api/organizations";

export interface Notification {
  id: string;
  organizationId: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  read: boolean;
  readAt: Date | null;
  emailSent: boolean;
  emailSentAt: Date | null;
  createdAt: Date;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UnreadCountResponse {
  count: number;
}

export const notificationsAPI = {
  /**
   * Get notifications for an organization
   */
  list: async (
    organizationId: string,
    params?: {
      page?: number;
      limit?: number;
      read?: boolean;
    }
  ): Promise<{ data: NotificationListResponse }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.read !== undefined)
      queryParams.append("read", params.read.toString());

    const queryString = queryParams.toString();
    const url = `${BASE}/${organizationId}/notifications${queryString ? `?${queryString}` : ""}`;

    return externalApi.get<NotificationListResponse>(url);
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async (
    organizationId: string
  ): Promise<{ data: UnreadCountResponse }> => {
    return externalApi.get<UnreadCountResponse>(
      `${BASE}/${organizationId}/notifications/unread-count`
    );
  },

  /**
   * Mark a notification as read
   */
  markAsRead: async (
    organizationId: string,
    notificationId: string
  ): Promise<{ data: Notification }> => {
    return externalApi.patch<Notification>(
      `${BASE}/${organizationId}/notifications/${notificationId}/read`
    );
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (
    organizationId: string
  ): Promise<{ data: { count: number } }> => {
    return externalApi.patch<{ count: number }>(
      `${BASE}/${organizationId}/notifications/read-all`
    );
  },
};
