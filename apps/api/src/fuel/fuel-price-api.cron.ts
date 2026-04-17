import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FuelPriceApiService } from './fuel-price-api.service';

@Injectable()
export class FuelPriceApiCron {
  constructor(private readonly fuelPriceApiService: FuelPriceApiService) {}

  /** A cada minuto (segundo 0); persistência só ocorre se mudou o dia e/ou o preço — ver FuelPriceApiService */
  @Cron('0 * * * * *')
  async handleDailyPriceFetch() {
    await this.fuelPriceApiService.fetchAndStoreAllPrices();
  }
}
