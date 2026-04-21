import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { GeocodingModule } from '@/geocoding/geocoding.module';
import { TrackersCoreModule } from '@/trackers/trackers-core.module';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TripDetectorService } from './trip-detector.service';
import { TripDetectionCronService } from './trip-detection-cron.service';

@Module({
  imports: [PrismaModule, GeocodingModule, TrackersCoreModule],
  controllers: [TripsController],
  providers: [TripsService, TripDetectorService, TripDetectionCronService],
  exports: [TripsService, TripDetectorService],
})
export class TripsModule {}
