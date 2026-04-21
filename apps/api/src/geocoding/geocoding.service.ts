import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RedisClientType } from 'redis';
import { TRACKER_REDIS } from '@/trackers/ingress/tracker-redis.tokens';

export interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly nominatimBaseUrl: string;

  constructor(
    @Inject(TRACKER_REDIS) private readonly redis: RedisClientType,
    private readonly configService: ConfigService,
  ) {
    this.nominatimBaseUrl =
      this.configService.get<string>('NOMINATIM_BASE_URL') ?? 'http://nominatim.internal';
  }

  /**
   * Reverse geocode coordinates to get a display name (address).
   * Returns null on any error; caches results for 7 days in Redis.
   */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      // Round to 4 decimal places
      const lat4 = Math.round(lat * 10000) / 10000;
      const lng4 = Math.round(lng * 10000) / 10000;

      // Check Redis cache
      const cacheKey = `geocode:reverse:${lat4}:${lng4}`;
      const cached = await this.redis.get(cacheKey);

      if (cached !== null) {
        // Return null if cached as empty string, otherwise return the cached value
        return cached === '' ? null : cached;
      }

      // Call Nominatim API
      const url = `${this.nominatimBaseUrl}/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'rs-frotas-fleet-system',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Nominatim API returned status ${response.status} for ${lat}, ${lng}`);
        // Cache as empty string for errors
        await this.redis.setEx(cacheKey, 604800, '');
        return null;
      }

      const data = (await response.json()) as { display_name?: string };

      if (!data.display_name) {
        this.logger.warn(`No display_name in Nominatim response for ${lat}, ${lng}`);
        await this.redis.setEx(cacheKey, 604800, '');
        return null;
      }

      // Cache the result for 7 days
      await this.redis.setEx(cacheKey, 604800, data.display_name);
      return data.display_name;
    } catch (error) {
      this.logger.error(`Error reverse geocoding ${lat}, ${lng}:`, error);
      return null;
    }
  }

  /**
   * Forward geocode an address query to get coordinates and display name.
   * Returns up to `limit` results. No caching (interactive search).
   */
  async forwardGeocode(query: string, limit = 5): Promise<GeocodeResult[]> {
    try {
      const url = `${this.nominatimBaseUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&accept-language=pt`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'rs-frotas-fleet-system',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Nominatim API returned status ${response.status} for query: ${query}`);
        return [];
      }

      const data = (await response.json()) as Array<{
        display_name?: string;
        lat?: string;
        lon?: string;
      }>;

      if (!Array.isArray(data)) {
        this.logger.warn(`Unexpected response format from Nominatim for query: ${query}`);
        return [];
      }

      return data
        .filter((item) => item.display_name && item.lat && item.lon)
        .map((item) => ({
          displayName: item.display_name!,
          lat: parseFloat(item.lat!),
          lng: parseFloat(item.lon!),
        }));
    } catch (error) {
      this.logger.error(`Error forward geocoding query: ${query}:`, error);
      return [];
    }
  }
}
