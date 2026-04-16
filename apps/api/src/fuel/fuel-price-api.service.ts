import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '@/prisma/prisma.service';
import { FuelType } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

interface CombustivelApiResponse {
  error: boolean;
  data_coleta: string;
  precos: {
    [fuelName: string]: {
      [stateCode: string]: string;
    };
  };
}

@Injectable()
export class FuelPriceApiService {
  private readonly API_URL = 'https://combustivelapi.com.br/api/precos/';
  private readonly logger = new Logger(FuelPriceApiService.name);

  // Mapping between API fuel type names and our FuelType enum
  private readonly FUEL_TYPE_MAP: Record<string, FuelType> = {
    gasolina: FuelType.GASOLINE,
    diesel: FuelType.DIESEL,
  };

  // Mapping from state code to uppercase (e.g., 'sp' -> 'SP')
  private readonly STATE_CODES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Busca preços de combustível da API externa e persiste como snapshots
   */
  async fetchAndStoreAllPrices(): Promise<void> {
    try {
      this.logger.log('Iniciando fetch de preços de combustível...');

      const response = await firstValueFrom(
        this.httpService.get<CombustivelApiResponse>(this.API_URL),
      );

      const data = response.data;

      if (data.error) {
        this.logger.warn(`API retornou erro: ${JSON.stringify(data)}`);
        return;
      }

      const refDate = new Date(data.data_coleta);

      // Iterar por cada tipo de combustível retornado pela API
      for (const [fuelName, statesPrices] of Object.entries(data.precos)) {
        const fuelType = this.FUEL_TYPE_MAP[fuelName.toLowerCase()];

        if (!fuelType) {
          this.logger.warn(`Tipo de combustível não mapeado: ${fuelName}`);
          continue;
        }

        // Iterar por cada estado
        for (const [stateCode, priceStr] of Object.entries(statesPrices)) {
          const stateUpper = stateCode.toUpperCase();
          const price = parseFloat(priceStr.toString().replace(',', '.'));

          if (isNaN(price)) {
            this.logger.warn(`Preço inválido para ${stateUpper} / ${fuelName}: ${priceStr}`);
            continue;
          }

          try {
            const existing = await this.prisma.fuelPriceSnapshot.findFirst({
              where: { state: stateUpper, fuelType, refDate },
            });
            if (existing) {
              await this.prisma.fuelPriceSnapshot.update({
                where: { id: existing.id },
                data: { avgPrice: price, fetchedAt: new Date() },
              });
            } else {
              await this.prisma.fuelPriceSnapshot.create({
                data: { state: stateUpper, fuelType, avgPrice: price, refDate, source: 'combustivelapi' },
              });
            }
          } catch (error) {
            this.logger.debug(`Erro ao salvar snapshot ${stateUpper}/${fuelName}: ${error.message}`);
          }
        }
      }

      this.logger.log('Preços de combustível atualizados com sucesso');
    } catch (error) {
      this.logger.error(
        `Erro ao buscar preços da API externa: ${error.message}`,
        error.stack,
      );
      // Não lançar exceção — a API pode estar fora
    }
  }

  /**
   * Busca o preço mais recente para um estado + tipo de combustível
   */
  async getLatestPrice(
    state: string,
    fuelType: FuelType,
  ): Promise<any | null> {
    try {
      const snapshot = await this.prisma.fuelPriceSnapshot.findFirst({
        where: {
          state: state.toUpperCase(),
          fuelType,
        },
        orderBy: {
          refDate: 'desc',
        },
      });

      return snapshot;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar preço mais recente (${state}/${fuelType}): ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Busca histórico de preços para gráficos de benchmark
   */
  async getPriceHistory(
    state: string,
    fuelType: FuelType,
    days: number = 30,
  ): Promise<any[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const snapshots = await this.prisma.fuelPriceSnapshot.findMany({
        where: {
          state: state.toUpperCase(),
          fuelType,
          refDate: {
            gte: startDate,
          },
        },
        orderBy: {
          refDate: 'asc',
        },
      });

      return snapshots;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar histórico de preços (${state}/${fuelType}): ${error.message}`,
      );
      return [];
    }
  }
}
