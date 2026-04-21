import { Module } from '@nestjs/common';
import { TrackersCoreModule } from '@/trackers/trackers-core.module';
import { GeocodingService } from './geocoding.service';

@Module({
  imports: [TrackersCoreModule],
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
