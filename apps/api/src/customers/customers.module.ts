import { PrismaModule } from "@/prisma/prisma.module";
import { Global, Module } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
