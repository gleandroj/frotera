import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@/prisma/prisma.module';
import { CustomersModule } from '@/customers/customers.module';
import { FuelController } from './fuel.controller';
import { FuelService } from './fuel.service';
import { FuelPriceApiService } from './fuel-price-api.service';
import { FuelPriceApiCron } from './fuel-price-api.cron';

@Module({
  imports: [PrismaModule, CustomersModule, HttpModule],
  controllers: [FuelController],
  providers: [FuelService, FuelPriceApiService, FuelPriceApiCron],
  exports: [FuelService, FuelPriceApiService],
})
export class FuelModule {}
