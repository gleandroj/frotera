import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { UtilsModule } from "../utils/utils.module";
import { ChecklistController } from "./checklist.controller";
import { PublicChecklistController } from "./public-checklist.controller";
import { ChecklistService } from "./checklist.service";

@Module({
  imports: [PrismaModule, UtilsModule, CustomersModule, OrganizationsModule],
  controllers: [ChecklistController, PublicChecklistController],
  providers: [ChecklistService],
  exports: [ChecklistService],
})
export class ChecklistModule {}
