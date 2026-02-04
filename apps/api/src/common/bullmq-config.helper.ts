import { ConfigService } from '@nestjs/config';
import { DefaultJobOptions } from 'bullmq';

/**
 * Helper para gerar configuração padronizada de limpeza automática de jobs no BullMQ
 * Permite controlar via variáveis de ambiente quando os jobs completos e falhados são removidos do Redis
 */
export function getBullMQDefaultJobOptions(
  configService: ConfigService,
): DefaultJobOptions {
  // Configuração para jobs completos
  const removeOnCompleteAge = configService.get<number>(
    'BULLMQ_REMOVE_ON_COMPLETE_AGE',
    0, // Padrão: remover imediatamente
  );
  const removeOnCompleteCount = configService.get<number>(
    'BULLMQ_REMOVE_ON_COMPLETE_COUNT',
    10, // Padrão: manter últimos 10 jobs
  );

  // Configuração para jobs falhados
  const removeOnFailAge = configService.get<number>(
    'BULLMQ_REMOVE_ON_FAIL_AGE',
    86400, // Padrão: 24 horas
  );
  const removeOnFailCount = configService.get<number | undefined>(
    'BULLMQ_REMOVE_ON_FAIL_COUNT',
    undefined, // Padrão: não limitar por quantidade
  );

  // Se age for 0, remove imediatamente
  const removeOnComplete =
    removeOnCompleteAge === 0
      ? true
      : {
          age: removeOnCompleteAge,
          count: removeOnCompleteCount,
        };

  const removeOnFail =
    removeOnFailAge === 0
      ? true
      : {
          age: removeOnFailAge,
          ...(removeOnFailCount !== undefined && { count: removeOnFailCount }),
        };

  return {
    removeOnComplete,
    removeOnFail,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
  };
}
