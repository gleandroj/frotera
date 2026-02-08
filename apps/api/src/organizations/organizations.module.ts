import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { CustomersModule } from "../customers/customers.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OrganizationMemberGuard } from "./guards/organization-member.guard";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => CustomersModule),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationMemberGuard, SuperAdminGuard],
  exports: [OrganizationsService, OrganizationMemberGuard],
})
export class OrganizationsModule {}
