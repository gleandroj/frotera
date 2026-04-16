# PLAN — Integração API de Preços de Combustível + Módulo de Relatórios de Combustível

> **Agente executor:** Sonnet
> **Wave de implementação:** Wave 3.5 (extensão do FUEL, após módulo base de FuelLog implementado)
> **Pré-requisito crítico:** O módulo FUEL (FuelLog CRUD) deve estar implementado antes deste plano.
> **Documento destino:** Ao iniciar a execução, copiar este arquivo para `.planning/fuel-reports/PLAN.md`.

---

## Contexto

O módulo de abastecimento (FUEL) registra os dados de abastecimento mas não tem inteligência sobre
preços de mercado nem capacidade de gerar relatórios cruzados. Este plano resolve dois problemas:

1. **Integração com API de Preços (combustivelapi.com.br):** buscar diariamente os preços médios
   de combustível por estado para enriquecer os registros de abastecimento com um preço de referência
   de mercado, permitindo comparações como "paguei mais ou menos que a média do estado?".

2. **Relatórios de Combustível:** um conjunto de 5 relatórios que cruzam FuelLog + preços de mercado
   + dados de veículo para gerar insights operacionais: consumo médio por veículo, análise de custos
   por período, benchmark de preço pago vs mercado, alertas de eficiência e resumos dia/mês/ano.

---

## 1. Objetivo

- Buscar automaticamente preços de combustível via API pública e armazená-los como histórico.
- Enriquecer registros de abastecimento com o preço de mercado vigente no momento do registro.
- Gerar relatórios analíticos que cruzam consumo, custo e preço de mercado por veículo e período.
- Detectar veículos com consumo anômalo (acima da média histórica) e calcular economia potencial.

---

## 2. Schema Prisma

### Localização
`apps/api/prisma/schema.prisma`

### Model FuelPriceSnapshot (novo)
```prisma
model FuelPriceSnapshot {
  id        String   @id @default(cuid())
  state     String   // UF do estado: SP, RJ, MG, etc.
  fuelType  FuelType // reutiliza enum já existente
  avgPrice  Float    // R$/litro — média do estado
  minPrice  Float?   // mínimo registrado no estado
  maxPrice  Float?   // máximo registrado no estado
  source    String   @default("combustivelapi")
  refDate   DateTime // data de referência dos preços (da API)
  fetchedAt DateTime @default(now())

  @@index([state, fuelType, refDate])
  @@index([fuelType, refDate])
  @@map("fuel_price_snapshots")
}
```

### Alteração em FuelLog (coluna adicional)
```prisma
// Adicionar no model FuelLog, após o campo `consumption`:
marketPriceRef Float? // preço médio de mercado (estado da org) no momento do registro — snapshot
```

### Migration
```bash
cd apps/api
npx prisma migrate dev --name add_fuel_price_snapshots_and_market_ref
```

---

## 3. Backend: Integração com API de Preços

### Estrutura de arquivos (dentro do módulo fuel)
```
apps/api/src/fuel/
  fuel-price-api.service.ts   ← busca e persiste preços da API externa
  fuel-price-api.cron.ts      ← cron job diário
```

### 3.1 `fuel-price-api.service.ts`

**Responsabilidades:**
- Fazer HTTP GET para `https://combustivelapi.com.br/api/precos/` com params de estado/tipo.
- Persistir resultado como `FuelPriceSnapshot`.
- Expor método para buscar o preço mais recente dado estado + tipo de combustível.
- Expor histórico de preços para os relatórios de benchmark.

> **ATENÇÃO para o executor:** Verificar o formato exato da resposta da API antes de implementar
> o parser. A URL base é `https://combustivelapi.com.br/api/precos/`. Testar com GET simples
> para inspecionar a estrutura JSON retornada (campos de estado, tipo de combustível, preço).

```typescript
@Injectable()
export class FuelPriceApiService {
  private readonly API_URL = 'https://combustivelapi.com.br/api/precos/';
  private readonly logger = new Logger(FuelPriceApiService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Busca e persiste todos os estados e tipos de combustível
  async fetchAndStoreAllPrices(): Promise<void>

  // Busca preço mais recente para estado + tipo
  async getLatestPrice(state: string, fuelType: FuelType): Promise<FuelPriceSnapshot | null>

  // Histórico de preços (para gráficos de benchmark)
  async getPriceHistory(
    state: string,
    fuelType: FuelType,
    days: number,
  ): Promise<FuelPriceSnapshot[]>
}
```

**Detalhes de `fetchAndStoreAllPrices()`:**
- Usar `HttpService` (módulo `@nestjs/axios`) para fazer as requisições.
- Fazer `upsert` por `(state, fuelType, refDate)` para evitar duplicatas.
- Logar erros sem lançar exceção (não deve quebrar o cron se a API estiver fora).
- Adicionar `HttpModule` ao `FuelModule`.

### 3.2 `fuel-price-api.cron.ts`

```typescript
@Injectable()
export class FuelPriceApiCron {
  constructor(private readonly fuelPriceApiService: FuelPriceApiService) {}

  @Cron('0 6 * * *') // Todo dia às 06:00 (horário do servidor)
  async handleDailyPriceFetch() {
    this.logger.log('Iniciando busca diária de preços de combustível...');
    await this.fuelPriceApiService.fetchAndStoreAllPrices();
    this.logger.log('Preços atualizados com sucesso.');
  }
}
```

### 3.3 Endpoint de preços de mercado (adicionar ao FuelController)

```typescript
// GET /api/organizations/:orgId/fuel/market-prices?state=SP&fuelType=GASOLINE
// DEVE ser declarado ANTES de /:id no controller
@Get('market-prices')
async getMarketPrices(
  @Query('state') state: string,
  @Query('fuelType') fuelType: FuelTypeEnum,
): Promise<{ avgPrice: number | null; refDate: string | null }>
```

Retorna o preço médio mais recente disponível para o estado/tipo informados.
Útil para pré-preencher o campo `pricePerLiter` no formulário de abastecimento como sugestão.

### 3.4 Enriquecer `FuelService.create()` com marketPriceRef

Ao criar um `FuelLog`, buscar automaticamente o preço de mercado vigente:
```typescript
// No create() do FuelService, após calcular totalCost:
const orgState = await this.getOrgState(organizationId); // buscar estado da org
const snapshot = await this.fuelPriceApiService.getLatestPrice(orgState, dto.fuelType);
const marketPriceRef = snapshot?.avgPrice ?? null;
// Incluir no prisma.fuelLog.create({ data: { ..., marketPriceRef } })
```

> Estado da organização: adicionar campo `state String?` à `Organization` ou usar configuração
> de organização já existente. Se não houver campo de estado, usar 'SP' como padrão até que
> seja configurável.

---

## 4. Backend: Módulo de Relatórios

### Estrutura de arquivos
```
apps/api/src/fuel-reports/
  fuel-reports.module.ts
  fuel-reports.controller.ts
  fuel-reports.service.ts
  fuel-reports.dto.ts
```

---

### 4.1 `fuel-reports.dto.ts`

```typescript
// ── Query params compartilhados ───────────────────────────────────────────────
export class FuelReportBaseQueryDto {
  @IsOptional() @IsString()
  vehicleId?: string;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;
}

// ── Params específicos por relatório ─────────────────────────────────────────
export class ConsumptionReportQueryDto extends FuelReportBaseQueryDto {}

export class CostsReportQueryDto extends FuelReportBaseQueryDto {
  @IsOptional() @IsEnum(['day', 'month', 'year'])
  groupBy?: 'day' | 'month' | 'year'; // default: 'month'
}

export class BenchmarkReportQueryDto extends FuelReportBaseQueryDto {
  @IsOptional() @IsString()
  state?: string; // estado para comparar (default: estado da org)
}

export class EfficiencyReportQueryDto {
  @IsOptional() @IsNumber() @Min(0)
  thresholdPct?: number; // % de queda de consumo para disparar alerta (default: 15)
}

export class SummaryReportQueryDto {
  @IsOptional() @IsString()
  vehicleId?: string;

  @IsEnum(['day', 'month', 'year'])
  period: 'day' | 'month' | 'year';

  @IsDateString()
  date: string; // data de referência do período
}

// ── Response types ────────────────────────────────────────────────────────────
export class VehicleConsumptionDto {
  vehicleId: string;
  vehicleName: string | null;
  vehiclePlate: string | null;
  avgConsumption: number | null;   // km/l médio no período
  bestConsumption: number | null;
  worstConsumption: number | null;
  totalKm: number | null;          // odômetro final - inicial no período
  totalLiters: number;
  logsCount: number;
  trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data';
  // Série temporal para gráfico: data + consumo
  timeSeries: Array<{ date: string; consumption: number | null }>;
}

export class CostsPeriodDto {
  period: string;        // 'YYYY-MM-DD' | 'YYYY-MM' | 'YYYY'
  totalCost: number;
  totalLiters: number;
  logsCount: number;
  avgPricePerLiter: number | null;
  costPerKm: number | null;
  byFuelType: Record<string, { cost: number; liters: number }>;
}

export class BenchmarkPointDto {
  date: string;           // agrupado por semana/mês
  avgPricePaid: number;
  marketAvgPrice: number | null;
  difference: number | null;  // pago - mercado (positivo = pagou mais caro)
}

export class BenchmarkSummaryDto {
  totalPaid: number;
  totalAtMarketPrice: number | null;
  totalOverpaid: number | null;    // positivo = pagou mais caro que mercado
  overpaidPct: number | null;      // % a mais que o mercado
  timeSeries: BenchmarkPointDto[];
}

export class VehicleEfficiencyDto {
  vehicleId: string;
  vehicleName: string | null;
  vehiclePlate: string | null;
  currentAvgConsumption: number | null;    // últimas 3 aferições
  historicalAvgConsumption: number | null; // todas as aferições
  consumptionDropPct: number | null;       // % de queda
  isAlert: boolean;                        // queda > threshold
  estimatedExtraCost: number | null;       // R$ perdidos pela ineficiência
  lastFuelDate: string | null;
}

export class PeriodSummaryDto {
  period: string;
  totalCost: number;
  totalLiters: number;
  logsCount: number;
  avgConsumption: number | null;
  avgPricePaid: number | null;
  avgMarketPrice: number | null;
  costPerKm: number | null;
  // Comparação com período anterior equivalente
  vsLastPeriod: {
    costChangePct: number | null;
    consumptionChangePct: number | null;
    litersChangePct: number | null;
  };
}
```

---

### 4.2 `fuel-reports.service.ts`

**Métodos:**

```typescript
// Relatório de consumo por veículo
async getConsumptionReport(
  organizationId: string,
  memberId: string,
  query: ConsumptionReportQueryDto,
): Promise<VehicleConsumptionDto[]>

// Análise de custos agrupada por período
async getCostsReport(
  organizationId: string,
  memberId: string,
  query: CostsReportQueryDto,
): Promise<CostsPeriodDto[]>

// Benchmark preço pago vs mercado
async getBenchmarkReport(
  organizationId: string,
  memberId: string,
  query: BenchmarkReportQueryDto,
): Promise<BenchmarkSummaryDto>

// Alertas de eficiência por veículo
async getEfficiencyReport(
  organizationId: string,
  memberId: string,
  query: EfficiencyReportQueryDto,
): Promise<VehicleEfficiencyDto[]>

// Resumo de período (dia/mês/ano) com comparativo
async getSummaryReport(
  organizationId: string,
  memberId: string,
  query: SummaryReportQueryDto,
): Promise<PeriodSummaryDto>
```

**Lógicas críticas:**

```
Trend (consumption):
  - Dividir série de consumo em 2 metades (temporal)
  - avgPrimeira vs avgSegunda: se segunda < primeira em > 5% → worsening
  - se segunda > primeira em > 5% → improving
  - else → stable
  - Se < 3 registros → insufficient_data

Efficiency alert:
  historicalAvg = média de todos os registros do veículo na org
  currentAvg = média dos últimos 3 registros
  dropPct = (historicalAvg - currentAvg) / historicalAvg * 100
  isAlert = dropPct > threshold (padrão 15%)
  estimatedExtraCost:
    extraLiters = totalKm / currentAvg - totalKm / historicalAvg
    estimatedExtraCost = extraLiters * avgPricePaid

Benchmark:
  Para cada FuelLog com marketPriceRef preenchido:
    difference = pricePerLiter - marketPriceRef
    totalOverpaid += difference * liters
  Se marketPriceRef = null → excluir do cálculo
```

---

### 4.3 `fuel-reports.controller.ts`

```typescript
@ApiTags('fuel-reports')
@Controller('organizations/:organizationId/fuel/reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FuelReportsController {

  // GET /api/organizations/:orgId/fuel/reports/consumption
  @Get('consumption')
  async getConsumption(...): Promise<VehicleConsumptionDto[]>

  // GET /api/organizations/:orgId/fuel/reports/costs
  @Get('costs')
  async getCosts(...): Promise<CostsPeriodDto[]>

  // GET /api/organizations/:orgId/fuel/reports/benchmark
  @Get('benchmark')
  async getBenchmark(...): Promise<BenchmarkSummaryDto>

  // GET /api/organizations/:orgId/fuel/reports/efficiency
  @Get('efficiency')
  async getEfficiency(...): Promise<VehicleEfficiencyDto[]>

  // GET /api/organizations/:orgId/fuel/reports/summary
  @Get('summary')
  async getSummary(...): Promise<PeriodSummaryDto>
}
```

### 4.4 `fuel-reports.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, FuelModule],
  controllers: [FuelReportsController],
  providers: [FuelReportsService],
})
export class FuelReportsModule {}
```

Registrar `FuelReportsModule` e `FuelPriceApiCron` em `apps/api/src/app.module.ts`.

### 4.5 Adicionar códigos de erro em `api-codes.enum.ts`

```typescript
// Fuel Reports errors (12000+)
FUEL_REPORT_INSUFFICIENT_DATA = "FUEL_REPORT_INSUFFICIENT_DATA",
FUEL_PRICE_API_UNAVAILABLE = "FUEL_PRICE_API_UNAVAILABLE",
```

---

## 5. Frontend

### 5.1 Tipos e API client

Adicionar em `apps/web/lib/frontend/api-client.ts`:

```typescript
// ── Fuel Reports ──────────────────────────────────────────────────────────────
export interface VehicleConsumption {
  vehicleId: string;
  vehicleName: string | null;
  vehiclePlate: string | null;
  avgConsumption: number | null;
  bestConsumption: number | null;
  worstConsumption: number | null;
  totalKm: number | null;
  totalLiters: number;
  logsCount: number;
  trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data';
  timeSeries: Array<{ date: string; consumption: number | null }>;
}

export interface CostsPeriod {
  period: string;
  totalCost: number;
  totalLiters: number;
  logsCount: number;
  avgPricePerLiter: number | null;
  costPerKm: number | null;
  byFuelType: Record<string, { cost: number; liters: number }>;
}

export interface BenchmarkSummary {
  totalPaid: number;
  totalAtMarketPrice: number | null;
  totalOverpaid: number | null;
  overpaidPct: number | null;
  timeSeries: Array<{
    date: string;
    avgPricePaid: number;
    marketAvgPrice: number | null;
    difference: number | null;
  }>;
}

export interface VehicleEfficiency {
  vehicleId: string;
  vehicleName: string | null;
  vehiclePlate: string | null;
  currentAvgConsumption: number | null;
  historicalAvgConsumption: number | null;
  consumptionDropPct: number | null;
  isAlert: boolean;
  estimatedExtraCost: number | null;
  lastFuelDate: string | null;
}

export interface PeriodSummary {
  period: string;
  totalCost: number;
  totalLiters: number;
  logsCount: number;
  avgConsumption: number | null;
  avgPricePaid: number | null;
  avgMarketPrice: number | null;
  costPerKm: number | null;
  vsLastPeriod: {
    costChangePct: number | null;
    consumptionChangePct: number | null;
    litersChangePct: number | null;
  };
}

export const fuelReportsAPI = {
  consumption: (orgId: string, params?: { vehicleId?: string; dateFrom?: string; dateTo?: string }) =>
    externalApi.get<VehicleConsumption[]>(`/api/organizations/${orgId}/fuel/reports/consumption`, { params }),

  costs: (orgId: string, params?: { vehicleId?: string; dateFrom?: string; dateTo?: string; groupBy?: string }) =>
    externalApi.get<CostsPeriod[]>(`/api/organizations/${orgId}/fuel/reports/costs`, { params }),

  benchmark: (orgId: string, params?: { vehicleId?: string; dateFrom?: string; dateTo?: string; state?: string }) =>
    externalApi.get<BenchmarkSummary>(`/api/organizations/${orgId}/fuel/reports/benchmark`, { params }),

  efficiency: (orgId: string, params?: { thresholdPct?: number }) =>
    externalApi.get<VehicleEfficiency[]>(`/api/organizations/${orgId}/fuel/reports/efficiency`, { params }),

  summary: (orgId: string, params: { period: 'day' | 'month' | 'year'; date: string; vehicleId?: string }) =>
    externalApi.get<PeriodSummary>(`/api/organizations/${orgId}/fuel/reports/summary`, { params }),

  marketPrices: (orgId: string, params: { state: string; fuelType: string }) =>
    externalApi.get<{ avgPrice: number | null; refDate: string | null }>(
      `/api/organizations/${orgId}/fuel/market-prices`, { params }
    ),
};
```

---

### 5.2 Chaves i18n

Adicionar em `apps/web/i18n/locales/pt.json`, seção `"fuelReports"`:

```json
"fuelReports": {
  "title": "Relatórios de Combustível",
  "description": "Análise completa de consumo, custos e preços da frota.",
  "nav": "Relatórios",

  "consumption": {
    "title": "Consumo por Veículo",
    "description": "Eficiência (km/l) por veículo no período.",
    "avgConsumption": "Consumo Médio",
    "best": "Melhor",
    "worst": "Pior",
    "totalKm": "Km Rodados",
    "trend": "Tendência",
    "trends": {
      "improving": "Melhorando",
      "worsening": "Piorando",
      "stable": "Estável",
      "insufficient_data": "Dados insuficientes"
    },
    "noData": "Nenhum dado de consumo disponível para o período."
  },

  "costs": {
    "title": "Análise de Custos",
    "description": "Custos de abastecimento agrupados por período.",
    "totalCost": "Custo Total",
    "costPerKm": "Custo/km",
    "avgPrice": "Preço Médio Pago",
    "groupBy": {
      "day": "Por Dia",
      "month": "Por Mês",
      "year": "Por Ano"
    },
    "noData": "Nenhum custo registrado no período."
  },

  "benchmark": {
    "title": "Preço Pago vs Mercado",
    "description": "Compare o preço pago nos abastecimentos com a média de mercado do estado.",
    "paid": "Preço Pago",
    "market": "Média Mercado",
    "difference": "Diferença",
    "totalOverpaid": "Total pago acima do mercado",
    "totalSaved": "Total economizado vs mercado",
    "overpaidPct": "% acima do mercado",
    "noMarketData": "Dados de mercado não disponíveis para o período.",
    "noData": "Nenhum registro com preço de referência de mercado."
  },

  "efficiency": {
    "title": "Alertas de Eficiência",
    "description": "Veículos com queda de consumo acima do limiar configurado.",
    "currentAvg": "Consumo Atual",
    "historicalAvg": "Consumo Histórico",
    "dropPct": "Queda",
    "extraCost": "Custo Extra Estimado",
    "alert": "Alerta",
    "ok": "Normal",
    "threshold": "Limiar de alerta",
    "noAlerts": "Nenhum veículo com queda de consumo detectada.",
    "noData": "Dados insuficientes para análise de eficiência."
  },

  "summary": {
    "title": "Resumo do Período",
    "description": "KPIs de combustível para o período selecionado.",
    "period": {
      "day": "Dia",
      "month": "Mês",
      "year": "Ano"
    },
    "totalCost": "Custo Total",
    "totalLiters": "Total Litros",
    "logsCount": "Abastecimentos",
    "avgConsumption": "Consumo Médio",
    "avgPricePaid": "Preço Médio Pago",
    "avgMarketPrice": "Preço Médio Mercado",
    "costPerKm": "Custo/km",
    "vsLastPeriod": "vs período anterior",
    "noData": "Nenhum dado para o período selecionado."
  },

  "hub": {
    "consumption": "Consumo por Veículo",
    "consumptionDesc": "Eficiência km/l e tendência por veículo",
    "costs": "Análise de Custos",
    "costsDesc": "Gastos por período e tipo de combustível",
    "benchmark": "Preço vs Mercado",
    "benchmarkDesc": "Compare o que pagou com a média do estado",
    "efficiency": "Alertas de Eficiência",
    "efficiencyDesc": "Veículos com queda de consumo acima do limiar",
    "summary": "Resumo do Período",
    "summaryDesc": "KPIs de dia, mês ou ano com comparativo"
  }
},
```

Adicionar no sidebar (`navigation.items`):
```json
"fuelReports": "Relatórios"
```

---

### 5.3 Sidebar

Editar `apps/web/components/navigation/app-sidebar.tsx`:

1. Importar ícone `BarChart3` do `lucide-react`.
2. Adicionar item na seção overview, **após** o item "Abastecimento":
```typescript
{
  name: t('navigation.items.fuelReports'),
  href: "/dashboard/fuel/reports",
  icon: BarChart3,
  current: pathname.startsWith("/dashboard/fuel/reports"),
},
```

---

### 5.4 Páginas do frontend

#### Estrutura de arquivos
```
apps/web/app/dashboard/fuel/reports/
  page.tsx                      ← Hub com 5 cards navegáveis
  consumption/
    page.tsx                    ← Gráfico de consumo + tabela por veículo
  costs/
    page.tsx                    ← BarChart de custos por período + filtros
  benchmark/
    page.tsx                    ← AreaChart preço pago vs mercado
  efficiency/
    page.tsx                    ← Tabela de alertas de eficiência
  summary/
    page.tsx                    ← KPI cards + tabs dia/mês/ano
  components/
    report-filters.tsx          ← Filtros compartilhados (vehicle, dateFrom, dateTo)
    consumption-chart.tsx       ← LineChart (recharts) consumo ao longo do tempo
    costs-bar-chart.tsx         ← BarChart (recharts) custo por período
    benchmark-area-chart.tsx    ← AreaChart (recharts) preço pago vs mercado
    efficiency-table.tsx        ← DataTable com badge de alerta
    summary-cards.tsx           ← Grid de KPI cards com % vs período anterior
    period-selector.tsx         ← Tabs dia/mês/ano + date picker
```

#### Hub (`page.tsx`)
- Grid 2x3 de cards clicáveis, cada um navegando para o sub-relatório correspondente.
- Cada card: ícone, título, descrição curta.

#### Consumption (`consumption/page.tsx`)
- `useEffect` → `fuelReportsAPI.consumption(orgId, filters)`
- Componente `<ConsumptionChart>` com `LineChart` do recharts por veículo (multiline)
  - Eixo X: datas, Eixo Y: km/l
  - Tooltip com data, consumo e veículo
- Tabela com: veículo, consumo médio, tendência (badge colorida), km total, total litros

#### Costs (`costs/page.tsx`)
- `useEffect` → `fuelReportsAPI.costs(orgId, { ..., groupBy })`
- Componente `<CostsBarChart>` — `BarChart` agrupado por tipo de combustível por período
  - Eixo X: período, Eixo Y: custo (R$)
- Tabs para groupBy: Dia / Mês / Ano
- Tabela: período, custo total, litros, preço médio, custo/km

#### Benchmark (`benchmark/page.tsx`)
- `useEffect` → `fuelReportsAPI.benchmark(orgId, filters)`
- Componente `<BenchmarkAreaChart>` — `AreaChart` com duas séries:
  - `avgPricePaid` (cor primária)
  - `marketAvgPrice` (cor cinza tracejada)
  - Tooltip mostrando diferença (positivo = pagou mais caro)
- Cards de resumo: totalPaid, totalOverpaid (ou "economizado"), overpaidPct
- Se `totalAtMarketPrice === null`, exibir aviso "Dados de mercado insuficientes"

#### Efficiency (`efficiency/page.tsx`)
- `useEffect` → `fuelReportsAPI.efficiency(orgId, { thresholdPct })`
- `<EfficiencyTable>` — DataTable com colunas:
  - Veículo (nome + placa)
  - Consumo Atual / Consumo Histórico
  - Queda (%) — badge vermelho se `isAlert`
  - Custo Extra Estimado
  - Status — `Badge` "Alerta" (vermelho) ou "Normal" (verde)
- Input slider para ajustar `thresholdPct` (padrão 15%)

#### Summary (`summary/page.tsx`)
- `<PeriodSelector>` — Tabs Dia/Mês/Ano + date picker (react-day-picker)
- `useEffect` ao mudar período → `fuelReportsAPI.summary(orgId, { period, date })`
- `<SummaryCards>` — Grid de 6 cards KPI, cada um com:
  - Valor principal
  - Variação percentual vs período anterior (verde se melhorou, vermelho se piorou)
  - Cards: Custo Total, Litros, Abastecimentos, Consumo Médio, Preço Médio Pago, Preço Mercado

---

## 6. Dependência de RBAC

Enquanto o RBAC não estiver implementado, usar apenas `JwtAuthGuard`.
Quando RBAC estiver disponível, todos os endpoints de relatórios requerem:
```typescript
@Permission(Module.REPORTS, Action.VIEW)
```

Roles que devem ter REPORTS:VIEW por padrão (no seed):
- `COMPANY_OWNER` → REPORTS: VIEW, CREATE, EDIT, DELETE
- `COMPANY_ADMIN` → REPORTS: VIEW, CREATE
- `OPERATOR` → REPORTS: VIEW
- `VIEWER` → REPORTS: VIEW
- `DRIVER` → (sem acesso a relatórios)

---

## 7. Ordem de implementação (tasks numeradas)

### Task 0 — Copiar plano
- [ ] Copiar este arquivo para `.planning/fuel-reports/PLAN.md`

### Task 1 — Schema e Migration
- [ ] Adicionar model `FuelPriceSnapshot` ao `schema.prisma`
- [ ] Adicionar campo `marketPriceRef Float?` ao `FuelLog`
- [ ] Executar `npx prisma migrate dev --name add_fuel_price_snapshots_and_market_ref`
- [ ] Verificar migração com `npx prisma studio`

### Task 2 — FuelPriceApiService + Cron
- [ ] Criar `apps/api/src/fuel/fuel-price-api.service.ts`
- [ ] Verificar formato real da API `https://combustivelapi.com.br/api/precos/` com GET manual
- [ ] Implementar `fetchAndStoreAllPrices()` com upsert
- [ ] Implementar `getLatestPrice()` e `getPriceHistory()`
- [ ] Criar `apps/api/src/fuel/fuel-price-api.cron.ts` com `@Cron('0 6 * * *')`
- [ ] Adicionar `HttpModule` ao `FuelModule`
- [ ] Registrar `FuelPriceApiCron` como provider no `FuelModule`
- [ ] Adicionar códigos de erro ao `api-codes.enum.ts`

### Task 3 — Endpoint de mercado + enriquecimento do create
- [ ] Adicionar endpoint `GET /fuel/market-prices` ao `FuelController`
  - Declarar ANTES de `GET /fuel/:id` e de `GET /fuel/stats`
- [ ] Atualizar `FuelService.create()` para popular `marketPriceRef` automaticamente

### Task 4 — FuelReportsModule backend
- [ ] Criar `apps/api/src/fuel-reports/fuel-reports.dto.ts` com todos os DTOs
- [ ] Criar `apps/api/src/fuel-reports/fuel-reports.service.ts` com os 5 métodos
- [ ] Criar `apps/api/src/fuel-reports/fuel-reports.controller.ts`
- [ ] Criar `apps/api/src/fuel-reports/fuel-reports.module.ts`
- [ ] Registrar `FuelReportsModule` em `app.module.ts`

### Task 5 — Frontend: tipos e API client
- [ ] Adicionar tipos `VehicleConsumption`, `CostsPeriod`, `BenchmarkSummary`, etc. em `api-client.ts`
- [ ] Adicionar `fuelReportsAPI` em `api-client.ts`

### Task 6 — Frontend: i18n e sidebar
- [ ] Adicionar seção `"fuelReports"` em `apps/web/i18n/locales/pt.json`
- [ ] Adicionar item de sidebar "Relatórios" com ícone `BarChart3`

### Task 7 — Frontend: componentes
- [ ] Criar `report-filters.tsx`
- [ ] Criar `consumption-chart.tsx` (Recharts LineChart)
- [ ] Criar `costs-bar-chart.tsx` (Recharts BarChart)
- [ ] Criar `benchmark-area-chart.tsx` (Recharts AreaChart)
- [ ] Criar `efficiency-table.tsx` (shadcn DataTable + badges)
- [ ] Criar `summary-cards.tsx` (cards KPI com % vs anterior)
- [ ] Criar `period-selector.tsx` (tabs + date picker)

### Task 8 — Frontend: páginas
- [ ] Criar `apps/web/app/dashboard/fuel/reports/page.tsx` (hub)
- [ ] Criar `consumption/page.tsx`
- [ ] Criar `costs/page.tsx`
- [ ] Criar `benchmark/page.tsx`
- [ ] Criar `efficiency/page.tsx`
- [ ] Criar `summary/page.tsx`

---

## 8. Testes de verificação

### Backend

```
# Pré-requisito: ter FuelLogs registrados com diferentes veículos e datas

# 1. Testar busca manual de preços da API externa
GET /api/organizations/:orgId/fuel/market-prices?state=SP&fuelType=GASOLINE
→ 200, { avgPrice: <float>, refDate: <string> }
→ Se a API externa estiver offline: { avgPrice: null, refDate: null } (sem erro 500)

# 2. Verificar que o cron popula FuelPriceSnapshot no banco
# (executar manualmente via método exposto ou aguardar execução às 06:00)
SELECT * FROM fuel_price_snapshots ORDER BY fetched_at DESC LIMIT 5;
→ Deve ter registros por estado e tipo de combustível

# 3. Verificar que novo FuelLog recebe marketPriceRef
POST /api/organizations/:orgId/fuel { ... }
→ 201, response deve incluir marketPriceRef: <float> (ou null se API não retornou dado)

# 4. Relatório de consumo
GET /api/organizations/:orgId/fuel/reports/consumption?dateFrom=2026-01-01
→ 200, array de VehicleConsumptionDto por veículo
→ Verificar que 'trend' está presente e 'timeSeries' tem pontos

# 5. Relatório de custos mensal
GET /api/organizations/:orgId/fuel/reports/costs?groupBy=month
→ 200, array de CostsPeriodDto com 'byFuelType' não vazio

# 6. Benchmark
GET /api/organizations/:orgId/fuel/reports/benchmark?state=SP
→ 200, BenchmarkSummaryDto com timeSeries
→ Se não houver snapshots: timeSeries vazio, totalAtMarketPrice: null

# 7. Eficiência
GET /api/organizations/:orgId/fuel/reports/efficiency?thresholdPct=10
→ 200, array de VehicleEfficiencyDto
→ Veículos com queda > 10% devem ter isAlert: true

# 8. Resumo mensal
GET /api/organizations/:orgId/fuel/reports/summary?period=month&date=2026-04-01
→ 200, PeriodSummaryDto com vsLastPeriod.costChangePct calculado

# 9. Resumo do mês anterior (deve ter dados para comparação)
GET /api/organizations/:orgId/fuel/reports/summary?period=month&date=2026-03-01
→ 200, vsLastPeriod.costChangePct: número (% vs fevereiro)

# 10. Segurança: relatório de outra org deve retornar 403
GET /api/organizations/:outraOrgId/fuel/reports/summary?period=month&date=2026-04-01
→ 403
```

### Frontend

```
1. Acessar /dashboard/fuel/reports → exibe hub com 5 cards
2. Clicar em "Consumo por Veículo" → gráfico com linha por veículo carrega
3. Trocar filtros de data → gráfico atualiza
4. Clicar em "Análise de Custos" → BarChart aparece; tabs Dia/Mês/Ano funcionam
5. Clicar em "Preço vs Mercado" → AreaChart com 2 séries; cards de resumo aparecem
6. Se não houver dados de mercado → aviso "Dados insuficientes" visível
7. Clicar em "Alertas de Eficiência" → tabela com badges; slider de threshold funciona
8. Clicar em "Resumo do Período" → tabs dia/mês/ano; date picker funciona; KPIs atualizam
9. Cards de KPI mostram % vs período anterior (verde/vermelho conforme direção)
10. Sidebar mostra "Relatórios" com ícone BarChart3, destacado quando na rota
11. Criar novo abastecimento → verificar que o form sugere preço de mercado atual
```

---

## 9. Notas críticas para o agente executor

1. **Verificar API antes de implementar o parser.** Fazer um GET manual para
   `https://combustivelapi.com.br/api/precos/` e documentar a estrutura JSON real.
   Adaptar `FuelPriceApiService.fetchAndStoreAllPrices()` ao schema real da resposta.

2. **marketPriceRef é melhor-esforço.** Se a API externa estiver fora ou não tiver dados
   para o estado da org, `marketPriceRef = null`. Nunca deve retornar erro 500 por causa disso.

3. **Estado da organização.** O campo `state` da org pode não existir ainda no schema.
   Se não existir, usar 'SP' como padrão até que seja configurável. Documentar isso como TODO.

4. **Rota order no FuelController.** O endpoint `GET /fuel/market-prices` deve ser declarado
   ANTES de `GET /fuel/stats` e `GET /fuel/:id` para evitar conflito de rota no NestJS.

5. **Recharts já instalado.** `recharts@2.15.0` está nas dependências — não instalar novamente.
   Usar componentes `LineChart`, `BarChart`, `AreaChart` do recharts com wrapper `ResponsiveContainer`.

6. **Escopo de customer.** Todos os métodos do `FuelReportsService` devem filtrar veículos
   pelo `allowedCustomerIds` do membro, seguindo o mesmo padrão do `FuelService`.

7. **Performance.** Consultas de relatório podem ser pesadas. Usar `prisma.$queryRaw` para
   agregações complexas ou garantir que os índices `@@index([vehicleId, date])` e
   `@@index([organizationId, date])` do `FuelLog` sejam usados nas queries.

8. **Cron schedule.** O `ScheduleModule.forRoot()` já está registrado em `app.module.ts`.
   Apenas adicionar o cron service como provider.

9. **`HttpModule` para chamadas externas.** Usar `@nestjs/axios` (`HttpModule`) no lugar
   do `fetch` nativo para consistência com o padrão do projeto. Adicionar ao `FuelModule`.

10. **FuelReportsModule importa FuelModule.** Para acessar `FuelPriceApiService`.
    Certificar que `FuelModule` exporta `FuelService` E `FuelPriceApiService`.
