import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GeocodingService, GeocodeResult } from './geocoding.service';

@ApiTags('geocoding')
@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get('search')
  @ApiOperation({ summary: 'Forward geocode: search address by text' })
  @ApiQuery({ name: 'q', type: String, description: 'Address or place query' })
  @ApiQuery({ name: 'limit', type: Number, required: false, description: 'Max results (default 5)' })
  async search(
    @Query('q') q: string,
    @Query('limit') limit: string = '5',
  ): Promise<{ results: GeocodeResult[] }> {
    const results = await this.geocodingService.forwardGeocode(q, parseInt(limit, 10));
    return { results };
  }

  @Get('reverse')
  @ApiOperation({ summary: 'Reverse geocode: get address from coordinates' })
  @ApiQuery({ name: 'lat', type: Number })
  @ApiQuery({ name: 'lng', type: Number })
  async reverse(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ): Promise<{ address: string | null }> {
    const address = await this.geocodingService.reverseGeocode(parseFloat(lat), parseFloat(lng));
    return { address };
  }
}
