import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [PrismaModule, CustomersModule, OrganizationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
