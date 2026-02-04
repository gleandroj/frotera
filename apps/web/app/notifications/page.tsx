"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { notificationsAPI, Notification } from "@/lib/api/notifications";
import { useTranslation } from "@/i18n/useTranslation";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";
import { CheckCheck, Bell } from "lucide-react";
import { toast } from "sonner";

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const readFilter = filter === "all" ? undefined : filter === "read";
      const response = await notificationsAPI.list(currentOrganization.id, {
        page,
        limit: 20,
        read: readFilter,
      });
      setNotifications(response.data.notifications);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchNotifications();
    }
  }, [page, filter, currentOrganization?.id]);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!currentOrganization?.id) return;
    try {
      await notificationsAPI.markAsRead(currentOrganization.id, notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true, readAt: new Date() } : n
        )
      );
      toast.success(t("notifications.markAsRead"));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      toast.error(t("common.error"));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentOrganization?.id) return;
    setMarkingAll(true);
    try {
      await notificationsAPI.markAllAsRead(currentOrganization.id);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date() }))
      );
      toast.success(t("notifications.markAllAsRead"));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error(t("common.error"));
    } finally {
      setMarkingAll(false);
    }
  };

  const formatTime = (date: Date | string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return "";
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("notifications.title")}</h1>
            <p className="text-muted-foreground mt-1">
              {unreadCount > 0
                ? `${unreadCount} ${t("notifications.unread")}`
                : t("notifications.empty")}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              variant="outline"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              {t("notifications.markAllAsRead")}
            </Button>
          )}
        </div>

        <Tabs value={filter} onValueChange={(v) => {
          setFilter(v as "all" | "unread" | "read");
          setPage(1);
        }}>
          <TabsList>
            <TabsTrigger value="all">{t("notifications.all")}</TabsTrigger>
            <TabsTrigger value="unread">{t("notifications.unreadOnly")}</TabsTrigger>
            <TabsTrigger value="read">{t("notifications.readOnly")}</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("notifications.title")}</CardTitle>
                <CardDescription>
                  {filter === "all" && t("notifications.all")}
                  {filter === "unread" && t("notifications.unreadOnly")}
                  {filter === "read" && t("notifications.readOnly")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("notifications.loading")}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>
                      {filter === "all"
                        ? t("notifications.empty")
                        : t("notifications.emptyFiltered")}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border rounded-lg ${
                            !notification.read
                              ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                              : "bg-background"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3
                                  className={`text-sm font-medium ${
                                    !notification.read ? "font-semibold" : ""
                                  }`}
                                >
                                  {notification.title}
                                </h3>
                                {!notification.read && (
                                  <Badge variant="secondary" className="text-xs">
                                    {t("notifications.unread")}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatTime(notification.createdAt)}
                              </p>
                            </div>
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="ml-4"
                              >
                                {t("notifications.markAsRead")}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {!loading && notifications.length > 0 && totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      {t("common.previous")}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t("common.showing")} {page} {t("common.to")} {totalPages} {t("common.of")}{" "}
                      {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      {t("common.next")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}
