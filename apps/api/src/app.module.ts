import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { EmailModule } from "./email/email.module";
import { HealthModule } from "./health/health.module";
import { InvitationsModule } from "./invitations/invitations.module";
import { MembersModule } from "./members/members.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { AppConfigModule } from "./config/config.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: "../../.env",
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    PrismaModule,
    InvitationsModule,
    MembersModule,
    OrganizationsModule,
    EmailModule,
    HealthModule,
    DashboardModule,
    AdminModule,
    AppConfigModule,
    NotificationsModule,
  ],
})
export class AppModule {}
