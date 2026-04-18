import { PrismaModule } from "@/prisma/prisma.module";
import { Global, Module } from "@nestjs/common";
import { CustomerFleetSettingsService } from "./customer-fleet-settings.service";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerFleetSettingsService],
  exports: [CustomersService, CustomerFleetSettingsService],
})
export class CustomersModule {}
