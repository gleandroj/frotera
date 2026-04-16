import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FuelPriceApiService } from './fuel-price-api.service';

@Injectable()
export class FuelPriceApiCron {
  private readonly logger = new Logger(FuelPriceApiCron.name);

  constructor(private readonly fuelPriceApiService: FuelPriceApiService) {}

  @Cron('0 6 * * *') // Todo dia às 06:00 (horário do servidor)
  async handleDailyPriceFetch() {
    this.logger.log('Iniciando busca diária de preços de combustível...');
    await this.fuelPriceApiService.fetchAndStoreAllPrices();
    this.logger.log('Preços atualizados com sucesso.');
  }
}
