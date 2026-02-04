import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganizationMemberGuard } from "../organizations/guards/organization-member.guard";
import {
  NotificationListResponseDto,
  UnreadCountResponseDto,
} from "./dto/notification.dto";

@Controller("organizations/:organizationId/notifications")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Param("organizationId") organizationId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("read") read?: string
  ): Promise<NotificationListResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const readFilter = read === "true" ? true : read === "false" ? false : undefined;

    return this.notificationsService.getOrganizationNotifications(
      organizationId,
      pageNum,
      limitNum,
      readFilter
    );
  }

  @Get("unread-count")
  async getUnreadCount(
    @Param("organizationId") organizationId: string
  ): Promise<UnreadCountResponseDto> {
    const count = await this.notificationsService.getUnreadCount(organizationId);
    return { count };
  }

  @Patch(":id/read")
  async markAsRead(
    @Param("organizationId") organizationId: string,
    @Param("id") id: string
  ) {
    return this.notificationsService.markAsRead(id, organizationId);
  }

  @Patch("read-all")
  async markAllAsRead(@Param("organizationId") organizationId: string) {
    return this.notificationsService.markAllAsRead(organizationId);
  }
}
