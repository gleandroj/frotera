import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { CustomersModule } from "./customers/customers.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { EmailModule } from "./email/email.module";
import { HealthModule } from "./health/health.module";
import { MembersModule } from "./members/members.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SettingsModule } from "./settings/settings.module";
import { UsersModule } from "./users/users.module";
import { AppConfigModule } from "./config/config.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { TrackersModule } from "./trackers/trackers.module";
import { RolesModule } from "./roles/roles.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: "../../.env",
    }),
    ScheduleModule.forRoot(),
    SettingsModule,
    AuthModule,
    UsersModule,
    PrismaModule,
    MembersModule,
    OrganizationsModule,
    CustomersModule,
    EmailModule,
    HealthModule,
    DashboardModule,
    AdminModule,
    AppConfigModule,
    NotificationsModule,
    TrackersModule,
    RolesModule,
  ],
})
export class AppModule {}
