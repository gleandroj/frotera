import { Module } from "@nestjs/common";
import { CustomersModule } from "@/customers/customers.module";
import { OrganizationsModule } from "@/organizations/organizations.module";
import { PrismaModule } from "@/prisma/prisma.module";
import { UtilsModule } from "@/utils/utils.module";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";

@Module({
  imports: [PrismaModule, CustomersModule, OrganizationsModule, UtilsModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
