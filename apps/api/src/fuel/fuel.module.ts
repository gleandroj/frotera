import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@/prisma/prisma.module';
import { CustomersModule } from '@/customers/customers.module';
import { UtilsModule } from '@/utils/utils.module';
import { FuelController } from './fuel.controller';
import { FuelService } from './fuel.service';
import { FuelPriceApiService } from './fuel-price-api.service';
import { FuelPriceApiCron } from './fuel-price-api.cron';
import { FuelGeoService } from './fuel-geo.service';

@Module({
  imports: [PrismaModule, CustomersModule, HttpModule, UtilsModule],
  controllers: [FuelController],
  providers: [FuelService, FuelPriceApiService, FuelPriceApiCron, FuelGeoService],
  exports: [FuelService, FuelPriceApiService, FuelGeoService],
})
export class FuelModule {}
