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

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  private calendarDayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private sameCalendarDay(a: Date, b: Date): boolean {
    return this.calendarDayKey(a) === this.calendarDayKey(b);
  }

  private samePrice(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-5;
  }

  /**
   * Busca preços de combustível da API externa e persiste como snapshots.
   * Só grava quando o dia de referência ou o valor mudou em relação ao último snapshot (estado+tipo).
   */
  async fetchAndStoreAllPrices(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<CombustivelApiResponse>(this.API_URL),
      );

      const data = response.data;

      if (data.error) {
        this.logger.warn(`API retornou erro: ${JSON.stringify(data)}`);
        return;
      }

      const refDate = new Date(data.data_coleta);
      if (Number.isNaN(refDate.getTime())) {
        this.logger.warn(`data_coleta inválida: ${data.data_coleta}`);
        return;
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

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
            const latest = await this.prisma.fuelPriceSnapshot.findFirst({
              where: { state: stateUpper, fuelType },
              orderBy: { refDate: 'desc' },
            });

            if (
              latest &&
              this.sameCalendarDay(latest.refDate, refDate) &&
              this.samePrice(latest.avgPrice, price)
            ) {
              skipped += 1;
              continue;
            }

            const existing = await this.prisma.fuelPriceSnapshot.findFirst({
              where: { state: stateUpper, fuelType, refDate },
            });
            if (existing) {
              if (this.samePrice(existing.avgPrice, price)) {
                skipped += 1;
                continue;
              }
              await this.prisma.fuelPriceSnapshot.update({
                where: { id: existing.id },
                data: { avgPrice: price, fetchedAt: new Date() },
              });
              updated += 1;
            } else {
              await this.prisma.fuelPriceSnapshot.create({
                data: { state: stateUpper, fuelType, avgPrice: price, refDate, source: 'combustivelapi' },
              });
              created += 1;
            }
          } catch (error) {
            this.logger.debug(`Erro ao salvar snapshot ${stateUpper}/${fuelName}: ${error.message}`);
          }
        }
      }

      if (created > 0 || updated > 0) {
        this.logger.log(
          `Preços combustível: ${created} criados, ${updated} atualizados, ${skipped} ignorados (sem mudança)`,
        );
      }
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
