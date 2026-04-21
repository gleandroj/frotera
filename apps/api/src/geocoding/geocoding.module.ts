import { Module } from '@nestjs/common';
import { TrackersCoreModule } from '@/trackers/trackers-core.module';
import { GeocodingService } from './geocoding.service';
import { GeocodingController } from './geocoding.controller';

@Module({
  imports: [TrackersCoreModule],
  controllers: [GeocodingController],
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
