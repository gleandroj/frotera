import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CustomersModule } from "../customers/customers.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OrganizationMemberGuard } from "./guards/organization-member.guard";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    CustomersModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationMemberGuard],
  exports: [OrganizationsService, OrganizationMemberGuard],
})
export class OrganizationsModule {}
