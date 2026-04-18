import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { FuelModule } from '@/fuel/fuel.module';
import { FuelReportsController } from './fuel-reports.controller';
import { FuelReportsService } from './fuel-reports.service';

@Module({
  imports: [PrismaModule, FuelModule],
  controllers: [FuelReportsController],
  providers: [FuelReportsService],
  exports: [FuelReportsService],
})
export class FuelReportsModule {}
