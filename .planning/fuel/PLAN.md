# PLAN — Módulo FUEL (Controle de Abastecimento)

> **Agente executor:** Haiku
> **Wave de implementação:** Wave 3 (após RBAC, Drivers, Documents)
> **Pré-requisito crítico:** O módulo RBAC deve estar implementado antes deste módulo.
> Enquanto não existir, usar `@UseGuards(JwtAuthGuard)` simples com placeholder para `PermissionGuard`.

---

## 1. Objetivo

Registrar abastecimentos de veículos com cálculo automático de consumo (km/l) e custo/km,
além de relatórios agregados por período, veículo e motorista. O custo total é sempre calculado
no servidor (`liters × pricePerLiter`) e nunca aceito do cliente.

---

## 2. Schema Prisma

### Localização
`apps/api/prisma/schema.prisma` — adicionar ao final do arquivo (antes do último `}`).

### Enum FuelType (adicionar junto aos outros enums)
```prisma
enum FuelType {
  GASOLINE
  ETHANOL
  DIESEL
  ELECTRIC
  GNV
}
```

### Model FuelLog
```prisma
model FuelLog {
  id             String    @id @default(cuid())
  organizationId String
  vehicleId      String
  driverId       String?   // FK para Driver (quando módulo Drivers existir)
  createdById    String    // FK para OrganizationMember.id

  date           DateTime
  odometer       Float     // km no momento do abastecimento
  liters         Float
  pricePerLiter  Float
  totalCost      Float     // CALCULADO: liters * pricePerLiter — NUNCA aceitar do cliente
  fuelType       FuelType

  station        String?   // nome do posto
  city           String?
  receipt        String?   // URL da foto do comprovante (placeholder S3/R2)
  notes          String?

  // Campo calculado no momento da escrita (km/l vs abastecimento anterior do mesmo veículo)
  // null quando é o primeiro abastecimento do veículo ou odômetro anterior não disponível
  consumption    Float?    // km/l

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  organization   Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  vehicle        Vehicle            @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  createdBy      OrganizationMember @relation(fields: [createdById], references: [id])

  @@index([organizationId])
  @@index([vehicleId])
  @@index([organizationId, date])
  @@index([vehicleId, date])
  @@map("fuel_logs")
}
```

### Alterações em modelos existentes
Adicionar relação inversa em `Vehicle`:
```prisma
// dentro de model Vehicle, na seção de relações:
fuelLogs FuelLog[]
```

Adicionar relação inversa em `Organization`:
```prisma
// dentro de model Organization, na seção de relações:
fuelLogs FuelLog[]
```

Adicionar relação inversa em `OrganizationMember`:
```prisma
// dentro de model OrganizationMember, na seção de relações:
fuelLogs FuelLog[]
```

### Migration
```bash
# Após editar o schema:
cd apps/api
npx prisma migrate dev --name add_fuel_log
```

---

## 3. Backend

### Estrutura de arquivos
```
apps/api/src/fuel/
  fuel.module.ts
  fuel.controller.ts
  fuel.service.ts
  fuel.dto.ts
```

---

### 3.1 `fuel.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export enum FuelTypeEnum {
  GASOLINE = 'GASOLINE',
  ETHANOL   = 'ETHANOL',
  DIESEL    = 'DIESEL',
  ELECTRIC  = 'ELECTRIC',
  GNV       = 'GNV',
}

// ── Create ────────────────────────────────────────────────────────────────────
export class CreateFuelLogDto {
  @ApiProperty({ description: 'Vehicle ID' })
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @ApiPropertyOptional({ description: 'Driver ID (optional)' })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiProperty({ description: 'Date/time of fueling (ISO 8601)' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Odometer reading in km at time of fueling' })
  @IsNumber()
  @IsPositive()
  odometer: number;

  @ApiProperty({ description: 'Liters fueled' })
  @IsNumber()
  @IsPositive()
  liters: number;

  @ApiProperty({ description: 'Price per liter' })
  @IsNumber()
  @IsPositive()
  pricePerLiter: number;

  @ApiProperty({ enum: FuelTypeEnum })
  @IsEnum(FuelTypeEnum)
  fuelType: FuelTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  station?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Receipt URL (placeholder for S3/R2)' })
  @IsOptional()
  @IsString()
  receipt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Update ────────────────────────────────────────────────────────────────────
export class UpdateFuelLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  odometer?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  liters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  pricePerLiter?: number;

  @ApiPropertyOptional({ enum: FuelTypeEnum })
  @IsOptional()
  @IsEnum(FuelTypeEnum)
  fuelType?: FuelTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  station?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receipt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── List query params ─────────────────────────────────────────────────────────
export class ListFuelLogsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Start date ISO 8601' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date ISO 8601' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: FuelTypeEnum })
  @IsOptional()
  @IsEnum(FuelTypeEnum)
  fuelType?: FuelTypeEnum;
}

// ── Stats query params ────────────────────────────────────────────────────────
export class FuelStatsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Start date ISO 8601' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date ISO 8601' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

// ── Response ──────────────────────────────────────────────────────────────────
export class FuelLogResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() vehicleId: string;
  @ApiPropertyOptional() driverId?: string | null;
  @ApiProperty() createdById: string;
  @ApiProperty() date: string;
  @ApiProperty() odometer: number;
  @ApiProperty() liters: number;
  @ApiProperty() pricePerLiter: number;
  @ApiProperty() totalCost: number;
  @ApiProperty({ enum: FuelTypeEnum }) fuelType: FuelTypeEnum;
  @ApiPropertyOptional() station?: string | null;
  @ApiPropertyOptional() city?: string | null;
  @ApiPropertyOptional() receipt?: string | null;
  @ApiPropertyOptional() notes?: string | null;
  @ApiPropertyOptional() consumption?: number | null; // km/l
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;

  // Joined fields
  @ApiPropertyOptional() vehicle?: { id: string; name: string | null; plate: string | null };
}

// ── Stats response ────────────────────────────────────────────────────────────
export class FuelStatsResponseDto {
  @ApiProperty({ description: 'Total cost in the period' })
  totalCost: number;

  @ApiProperty({ description: 'Total liters in the period' })
  totalLiters: number;

  @ApiProperty({ description: 'Number of fuel logs in the period' })
  count: number;

  @ApiPropertyOptional({ description: 'Average consumption (km/l) weighted by distance — null when insufficient data' })
  avgConsumption: number | null;

  @ApiPropertyOptional({ description: 'Average cost per km — null when insufficient data' })
  avgCostPerKm: number | null;

  @ApiProperty({ description: 'Total cost of fuel logs in the current calendar month' })
  currentMonthCost: number;

  @ApiProperty({ description: 'Number of fuel logs in the current calendar month' })
  currentMonthCount: number;
}
```

---

### 3.2 `fuel.service.ts`

**Responsabilidades:**
- Sempre filtrar por `organizationId`.
- Sempre filtrar veículos pelo escopo de `allowedCustomerIds` do membro (via `CustomersService.getAllowedCustomerIds`).
- `totalCost` calculado exclusivamente pelo service: `liters × pricePerLiter` (arredondado para 2 casas).
- `consumption` calculado buscando o registro anterior do mesmo veículo ordenado por `date DESC, odometer DESC`.

**Assinatura dos métodos:**
```typescript
// Lista com filtros opcionais
async list(
  organizationId: string,
  memberId: string,        // para verificar escopo de customerIds
  query: ListFuelLogsQueryDto,
): Promise<FuelLogResponseDto[]>

// Cria novo registro
async create(
  organizationId: string,
  createdById: string,     // OrganizationMember.id
  dto: CreateFuelLogDto,
  allowedCustomerIds: string[] | null,
): Promise<FuelLogResponseDto>

// Busca por ID
async getById(
  id: string,
  organizationId: string,
  allowedCustomerIds: string[] | null,
): Promise<FuelLogResponseDto>

// Atualiza (recalcula totalCost e consumption se liters/pricePerLiter/odometer mudar)
async update(
  id: string,
  organizationId: string,
  dto: UpdateFuelLogDto,
  allowedCustomerIds: string[] | null,
): Promise<FuelLogResponseDto>

// Delete físico (FuelLog não tem soft delete; dados de custo são críticos para auditoria
// — reconsiderar se necessário, mas por ora DELETE físico)
async delete(
  id: string,
  organizationId: string,
  allowedCustomerIds: string[] | null,
): Promise<void>

// Estatísticas agregadas
async getStats(
  organizationId: string,
  memberId: string,
  query: FuelStatsQueryDto,
): Promise<FuelStatsResponseDto>
```

**Lógica de cálculo de consumo (km/l):**
```
// Ao criar/atualizar, busca o registro anterior do mesmo veículo:
const previous = await prisma.fuelLog.findFirst({
  where: {
    vehicleId: dto.vehicleId,
    organizationId,
    date: { lt: new Date(dto.date) },   // anterior em data
    id: { not: currentId },             // exclui o próprio (no update)
  },
  orderBy: [{ date: 'desc' }, { odometer: 'desc' }],
});

const kmDriven = previous ? dto.odometer - previous.odometer : null;
const consumption = (kmDriven && kmDriven > 0 && dto.liters > 0)
  ? parseFloat((kmDriven / dto.liters).toFixed(2))
  : null;
```

**Lógica de custo/km (na stats):**
```
// Para cada veículo no período:
// costPerKm = totalCost / totalKmDriven
// onde totalKmDriven = último odômetro no período - primeiro odômetro no período
// Se totalKmDriven <= 0 ou não há dados suficientes: null
```

**Filtro de escopo no list/stats:**
```typescript
// Buscar veículos permitidos para o membro:
const allowedVehicleFilter = allowedCustomerIds !== null
  ? { customerId: { in: allowedCustomerIds } }
  : {};
const allowedVehicles = await prisma.vehicle.findMany({
  where: { organizationId, ...allowedVehicleFilter },
  select: { id: true },
});
const allowedVehicleIds = allowedVehicles.map(v => v.id);
```

---

### 3.3 `fuel.controller.ts`

```typescript
@ApiTags('fuel')
@Controller('organizations/:organizationId/fuel')
@UseGuards(JwtAuthGuard /* , PermissionGuard — adicionar quando RBAC existir */)
@ApiBearerAuth()
export class FuelController {

  // GET /api/organizations/:orgId/fuel/stats   ← DEVE vir ANTES de /:id
  @Get('stats')
  async getStats(
    @Request() req,
    @Param('organizationId') organizationId: string,
    @Query() query: FuelStatsQueryDto,
  ): Promise<FuelStatsResponseDto>

  // GET /api/organizations/:orgId/fuel
  @Get()
  async list(
    @Request() req,
    @Param('organizationId') organizationId: string,
    @Query() query: ListFuelLogsQueryDto,
  ): Promise<FuelLogResponseDto[]>

  // POST /api/organizations/:orgId/fuel
  @Post()
  async create(
    @Request() req,
    @Param('organizationId') organizationId: string,
    @Body() body: CreateFuelLogDto,
  ): Promise<FuelLogResponseDto>

  // GET /api/organizations/:orgId/fuel/:id
  @Get(':id')
  async getOne(
    @Request() req,
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<FuelLogResponseDto>

  // PATCH /api/organizations/:orgId/fuel/:id
  @Patch(':id')
  async update(
    @Request() req,
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: UpdateFuelLogDto,
  ): Promise<FuelLogResponseDto>

  // DELETE /api/organizations/:orgId/fuel/:id
  @Delete(':id')
  async delete(
    @Request() req,
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<{ message: string }>
}
```

**ATENÇÃO:** A rota `GET /fuel/stats` DEVE ser declarada ANTES de `GET /fuel/:id` no controller
para que NestJS não interprete "stats" como um `:id`. Usar `@Get('stats')` antes de `@Get(':id')`.

---

### 3.4 `fuel.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuthModule, CustomersModule],
  controllers: [FuelController],
  providers: [FuelService],
  exports: [FuelService],
})
export class FuelModule {}
```

### 3.5 Registrar em `app.module.ts`

Adicionar `FuelModule` ao array `imports` de `AppModule` em
`apps/api/src/app.module.ts`.

### 3.6 Adicionar códigos de erro em `api-codes.enum.ts`

```typescript
// Fuel errors (11000+)
FUEL_LOG_NOT_FOUND = "FUEL_LOG_NOT_FOUND",
FUEL_LOG_ODOMETER_INVALID = "FUEL_LOG_ODOMETER_INVALID",
```

---

## 4. Frontend

### 4.1 Tipos e API client

Adicionar ao final de `apps/web/lib/frontend/api-client.ts`:

```typescript
// ── Fuel ──────────────────────────────────────────────────────────────────────
export type FuelType = 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'ELECTRIC' | 'GNV';

export interface FuelLog {
  id: string;
  organizationId: string;
  vehicleId: string;
  driverId?: string | null;
  createdById: string;
  date: string;
  odometer: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  fuelType: FuelType;
  station?: string | null;
  city?: string | null;
  receipt?: string | null;
  notes?: string | null;
  consumption?: number | null;   // km/l
  createdAt: string;
  updatedAt: string;
  vehicle?: { id: string; name: string | null; plate: string | null } | null;
}

export interface FuelStats {
  totalCost: number;
  totalLiters: number;
  count: number;
  avgConsumption: number | null;
  avgCostPerKm: number | null;
  currentMonthCost: number;
  currentMonthCount: number;
}

export interface CreateFuelLogPayload {
  vehicleId: string;
  driverId?: string;
  date: string;
  odometer: number;
  liters: number;
  pricePerLiter: number;
  fuelType: FuelType;
  station?: string;
  city?: string;
  receipt?: string;
  notes?: string;
}

export interface UpdateFuelLogPayload {
  driverId?: string;
  date?: string;
  odometer?: number;
  liters?: number;
  pricePerLiter?: number;
  fuelType?: FuelType;
  station?: string;
  city?: string;
  receipt?: string;
  notes?: string;
}

export interface FuelListParams {
  vehicleId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
  fuelType?: FuelType;
}

export interface FuelStatsParams {
  vehicleId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const fuelAPI = {
  list: (organizationId: string, params?: FuelListParams) =>
    externalApi.get<FuelLog[]>(
      `/api/organizations/${organizationId}/fuel`,
      { params },
    ),
  get: (organizationId: string, id: string) =>
    externalApi.get<FuelLog>(
      `/api/organizations/${organizationId}/fuel/${id}`,
    ),
  create: (organizationId: string, payload: CreateFuelLogPayload) =>
    externalApi.post<FuelLog>(
      `/api/organizations/${organizationId}/fuel`,
      payload,
    ),
  update: (organizationId: string, id: string, payload: UpdateFuelLogPayload) =>
    externalApi.patch<FuelLog>(
      `/api/organizations/${organizationId}/fuel/${id}`,
      payload,
    ),
  delete: (organizationId: string, id: string) =>
    externalApi.delete(
      `/api/organizations/${organizationId}/fuel/${id}`,
    ),
  getStats: (organizationId: string, params?: FuelStatsParams) =>
    externalApi.get<FuelStats>(
      `/api/organizations/${organizationId}/fuel/stats`,
      { params },
    ),
};
```

---

### 4.2 Chaves i18n

Adicionar em `apps/web/i18n/locales/pt.json`, inserindo a seção `"fuel"` antes do fechamento
do JSON (antes do último `}`):

```json
"fuel": {
  "title": "Abastecimentos",
  "listDescription": "Registros de abastecimento da frota. Controle custos e consumo por veículo.",
  "noLogs": "Nenhum abastecimento registrado.",
  "newLog": "Novo Abastecimento",
  "editLog": "Editar Abastecimento",
  "deleteLog": "Excluir Abastecimento",
  "logDetail": "Detalhe do Abastecimento",
  "backToList": "← Voltar aos abastecimentos",
  "filterByVehicle": "Filtrar por veículo...",
  "noResults": "Nenhum resultado.",
  "openActionsMenu": "Abrir menu de ações",

  "fields": {
    "vehicle": "Veículo",
    "driver": "Motorista",
    "date": "Data",
    "odometer": "Hodômetro (km)",
    "liters": "Litros",
    "pricePerLiter": "Preço por litro",
    "totalCost": "Custo total",
    "fuelType": "Tipo de combustível",
    "station": "Posto",
    "city": "Cidade",
    "receipt": "Comprovante (URL)",
    "notes": "Observações",
    "consumption": "Consumo (km/l)",
    "costPerKm": "Custo/km"
  },

  "fuelTypes": {
    "GASOLINE": "Gasolina",
    "ETHANOL": "Etanol",
    "DIESEL": "Diesel",
    "ELECTRIC": "Elétrico",
    "GNV": "GNV"
  },

  "stats": {
    "totalCostMonth": "Custo Total (Mês)",
    "totalLiters": "Litros Abastecidos",
    "avgConsumption": "Consumo Médio (km/l)",
    "avgCostPerKm": "Custo Médio por km",
    "logsMonth": "Abastecimentos (Mês)",
    "noData": "Sem dados suficientes"
  },

  "form": {
    "selectVehicle": "Selecione o veículo",
    "filterVehicle": "Buscar veículo...",
    "vehicleRequired": "Selecione um veículo.",
    "dateRequired": "Informe a data do abastecimento.",
    "odometerRequired": "Informe a leitura do hodômetro.",
    "odometerPositive": "Hodômetro deve ser maior que zero.",
    "litersRequired": "Informe a quantidade em litros.",
    "litersPositive": "Litros deve ser maior que zero.",
    "priceRequired": "Informe o preço por litro.",
    "pricePositive": "Preço deve ser maior que zero.",
    "fuelTypeRequired": "Selecione o tipo de combustível.",
    "selectFuelType": "Selecione o combustível",
    "stationPlaceholder": "Nome do posto",
    "cityPlaceholder": "Cidade",
    "receiptPlaceholder": "https://...",
    "notesPlaceholder": "Observações..."
  },

  "toastCreated": "Abastecimento registrado com sucesso.",
  "toastUpdated": "Abastecimento atualizado com sucesso.",
  "toastDeleted": "Abastecimento excluído com sucesso.",
  "toastError": "Falha ao salvar abastecimento. Tente novamente.",

  "confirmDelete": {
    "title": "Excluir abastecimento",
    "description": "Tem certeza que deseja excluir este registro de abastecimento? Esta ação não pode ser desfeita."
  }
},
```

Adicionar também a chave no sidebar (seção `navigation.items`):
```json
"fuel": "Abastecimento"
```

---

### 4.3 Sidebar

Editar `apps/web/components/navigation/app-sidebar.tsx`:

1. Importar ícone `Fuel` do pacote `lucide-react` (já disponível em shadcn/lucide).
2. Adicionar item no array `items` da seção `navigation.sections.overview`:

```typescript
// Adicionar import:
import { Building, Building2, Car, Fuel, Home, User, Users } from "lucide-react";

// Adicionar item após "vehicles" no array de overview:
{
  name: t('navigation.items.fuel'),
  href: "/dashboard/fuel",
  icon: Fuel,
  current: pathname.startsWith("/dashboard/fuel"),
},
```

---

### 4.4 Páginas do frontend

#### Estrutura de arquivos
```
apps/web/app/dashboard/fuel/
  page.tsx                  ← lista + stats cards
  new/
    page.tsx                ← formulário de criação
  [id]/
    page.tsx                ← detalhe/edição
  components/
    fuel-stats-cards.tsx    ← cards de KPIs
    fuel-columns.tsx        ← colunas da DataTable
    fuel-form.tsx           ← formulário compartilhado (criar/editar)
    delete-fuel-dialog.tsx  ← modal de confirmação de exclusão
```

---

#### `apps/web/app/dashboard/fuel/page.tsx`

Segue o mesmo padrão de `vehicles/page.tsx`:
- `"use client"`
- Usa `useAuth()` para obter `currentOrganization`
- Usa `useTranslation()` para i18n
- Estado: `logs: FuelLog[]`, `stats: FuelStats | null`, `loading`, `error`
- Chama `fuelAPI.list(orgId, filters)` e `fuelAPI.getStats(orgId)` em paralelo via `Promise.all`
- Exibe 3 cards de KPI no topo (via `<FuelStatsCards stats={stats} />`)
- Exibe `<DataTable>` com colunas de `getFuelColumns(t, { onEdit, onDelete })`
- Botão "Novo Abastecimento" → navega para `/dashboard/fuel/new`
- Filtros no topo: select de veículo, select de tipo de combustível, date range (dateFrom/dateTo)

**Cards de KPI (componente `fuel-stats-cards.tsx`):**
```
Card 1: "Custo Total (Mês)"   → stats.currentMonthCost  (formatado como moeda)
Card 2: "Consumo Médio"       → stats.avgConsumption ?? "—"  (km/l)
Card 3: "Abastecimentos (Mês)"→ stats.currentMonthCount
```

---

#### `apps/web/app/dashboard/fuel/new/page.tsx`

- `"use client"`
- Título: `t('fuel.newLog')`
- Renderiza `<FuelForm onSubmit={handleCreate} loading={loading} />`
- No submit: chama `fuelAPI.create(orgId, payload)`, exibe toast de sucesso e navega para `/dashboard/fuel`

---

#### `apps/web/app/dashboard/fuel/[id]/page.tsx`

- `"use client"`
- Carrega o registro com `fuelAPI.get(orgId, id)` via `useEffect`
- Exibe `<FuelForm initialValues={log} onSubmit={handleUpdate} loading={loading} />`
- Botão de excluir abre `<DeleteFuelDialog>`
- Botão "Voltar" → `/dashboard/fuel`

---

#### `fuel-form.tsx` (campos)

Campos do formulário (todos usam componentes shadcn/ui):
| Campo | Componente | Validação |
|---|---|---|
| vehicleId | Combobox (lista da org) | obrigatório |
| date | `<Input type="datetime-local">` | obrigatório |
| odometer | `<Input type="number">` | obrigatório, > 0 |
| liters | `<Input type="number" step="0.001">` | obrigatório, > 0 |
| pricePerLiter | `<Input type="number" step="0.001">` | obrigatório, > 0 |
| fuelType | `<Select>` | obrigatório |
| station | `<Input>` | opcional |
| city | `<Input>` | opcional |
| receipt | `<Input type="url">` | opcional |
| notes | `<Textarea>` | opcional |

**Campo `totalCost` não aparece no formulário** — é exibido como valor calculado em tempo real:
`totalCost = liters × pricePerLiter` (somente display, não enviado).

---

#### `fuel-columns.tsx`

Colunas da DataTable:
| Coluna | Campo | Notas |
|---|---|---|
| Data | `date` | formatada como `dd/MM/yyyy HH:mm` |
| Veículo | `vehicle.name / vehicle.plate` | nome + placa |
| Tipo | `fuelType` | label i18n de `fuel.fuelTypes.*` |
| Litros | `liters` | 2 casas decimais |
| Custo Total | `totalCost` | moeda (BRL) |
| Consumo | `consumption` | `X.XX km/l` ou `—` |
| Posto | `station` | opcional |
| Ações | dropdown | Visualizar, Editar, Excluir |

---

## 5. Dependência de RBAC

### Placeholder no controller

Enquanto o módulo RBAC não existir, o controller usa apenas `JwtAuthGuard`.
Quando o RBAC for implementado, adicionar no controller:

```typescript
// FUTURO — após módulo RBAC:
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from '../auth/decorators/permission.decorator';
import { Module as RbacModule, Action } from '../rbac/rbac.types';

// Em cada método:
@Permission(RbacModule.FUEL, Action.VIEW)    // GET list, GET stats
@Permission(RbacModule.FUEL, Action.CREATE)  // POST
@Permission(RbacModule.FUEL, Action.EDIT)    // PATCH
@Permission(RbacModule.FUEL, Action.DELETE)  // DELETE
```

### Roles padrão relevantes (do ARCHITECTURE.md)
- `OPERATOR` → `FUEL: CREATE` (pode criar, não pode editar/excluir)
- `DRIVER` → `FUEL: CREATE` (apenas próprios registros — scope `ASSIGNED`)
- `COMPANY_ADMIN` → todos os actions em `FUEL`
- `COMPANY_OWNER` → todos os actions em `FUEL`
- `VIEWER` → `FUEL: VIEW`

---

## 6. Ordem de implementação (tasks numeradas)

### Task 1 — Schema e Migration
- [ ] Adicionar enum `FuelType` ao `schema.prisma`
- [ ] Adicionar model `FuelLog` ao `schema.prisma`
- [ ] Adicionar relações inversas em `Vehicle`, `Organization`, `OrganizationMember`
- [ ] Executar `npx prisma migrate dev --name add_fuel_log`
- [ ] Confirmar que migration gerou corretamente com `npx prisma studio` (verificação visual)

### Task 2 — Backend: DTOs e códigos de erro
- [ ] Criar `apps/api/src/fuel/fuel.dto.ts` com todos os DTOs descritos na seção 3.1
- [ ] Adicionar `FUEL_LOG_NOT_FOUND` e `FUEL_LOG_ODOMETER_INVALID` em `api-codes.enum.ts`

### Task 3 — Backend: Service
- [ ] Criar `apps/api/src/fuel/fuel.service.ts`
- [ ] Implementar `list()` com filtros e escopo de allowedCustomerIds
- [ ] Implementar `create()` com cálculo de `totalCost` e `consumption`
- [ ] Implementar `getById()` com verificação de escopo
- [ ] Implementar `update()` com recálculo de `totalCost` e `consumption`
- [ ] Implementar `delete()` com verificação de escopo
- [ ] Implementar `getStats()` com agregações: totalCost, totalLiters, avgConsumption, avgCostPerKm, currentMonthCost, currentMonthCount

### Task 4 — Backend: Controller e Module
- [ ] Criar `apps/api/src/fuel/fuel.controller.ts` (ATENÇÃO: `GET /stats` antes de `GET /:id`)
- [ ] Criar `apps/api/src/fuel/fuel.module.ts`
- [ ] Registrar `FuelModule` em `apps/api/src/app.module.ts`

### Task 5 — Frontend: API client e tipos
- [ ] Adicionar tipos `FuelLog`, `FuelStats`, payloads e `fuelAPI` em `api-client.ts`

### Task 6 — Frontend: i18n
- [ ] Adicionar seção `"fuel"` em `apps/web/i18n/locales/pt.json`
- [ ] Adicionar `"fuel": "Abastecimento"` em `navigation.items`

### Task 7 — Frontend: Sidebar
- [ ] Importar ícone `Fuel` de `lucide-react`
- [ ] Adicionar item "Abastecimento" na seção overview do sidebar

### Task 8 — Frontend: Componentes base
- [ ] Criar `fuel-columns.tsx`
- [ ] Criar `fuel-stats-cards.tsx`
- [ ] Criar `fuel-form.tsx` (campos completos com validação inline + cálculo de totalCost em tempo real)
- [ ] Criar `delete-fuel-dialog.tsx`

### Task 9 — Frontend: Páginas
- [ ] Criar `apps/web/app/dashboard/fuel/page.tsx` (lista + stats)
- [ ] Criar `apps/web/app/dashboard/fuel/new/page.tsx`
- [ ] Criar `apps/web/app/dashboard/fuel/[id]/page.tsx`

### Task 10 — Verificação final
- [ ] Executar todos os testes de verificação da seção 7

---

## 7. Testes de verificação

### Backend (via HTTP ou curl/Postman)

```
# Autenticar e obter token JWT para uma org existente

# 1. Criar abastecimento
POST /api/organizations/:orgId/fuel
{
  "vehicleId": "<id_valido>",
  "date": "2026-04-16T10:00:00.000Z",
  "odometer": 50000,
  "liters": 40,
  "pricePerLiter": 5.89,
  "fuelType": "GASOLINE"
}
→ Esperado: 201, body com totalCost = 235.60, consumption = null (primeiro registro)

# 2. Criar segundo abastecimento (mesmo veículo, odômetro maior)
POST /api/organizations/:orgId/fuel
{
  "vehicleId": "<id_valido>",
  "date": "2026-04-23T10:00:00.000Z",
  "odometer": 50450,
  "liters": 38,
  "pricePerLiter": 5.89,
  "fuelType": "GASOLINE"
}
→ Esperado: 201, consumption = (50450 - 50000) / 38 = 11.84 km/l

# 3. Listar abastecimentos
GET /api/organizations/:orgId/fuel
→ 200, array com os 2 registros

# 4. Filtrar por veículo
GET /api/organizations/:orgId/fuel?vehicleId=<id>
→ 200, apenas registros do veículo

# 5. Obter stats
GET /api/organizations/:orgId/fuel/stats
→ 200, { totalCost: 470.12, totalLiters: 78, count: 2, avgConsumption: 11.84, ... }

# 6. Tentar criar com totalCost no body (deve ser ignorado)
POST ... body: { ..., "totalCost": 9999 }
→ 201, totalCost no response deve ser liters × pricePerLiter (não 9999)

# 7. Atualizar registro
PATCH /api/organizations/:orgId/fuel/:id
{ "liters": 45 }
→ 200, totalCost recalculado, consumption recalculado

# 8. Deletar
DELETE /api/organizations/:orgId/fuel/:id
→ 200

# 9. Tentar acessar registro de outra org
GET /api/organizations/:outraOrgId/fuel/:id
→ 403 ou 404

# 10. GET /fuel/stats deve NÃO ser tratado como GET /fuel/:id
GET /api/organizations/:orgId/fuel/stats
→ 200 com FuelStatsResponseDto (não 404 de "stats não encontrado")
```

### Frontend

```
1. Acessar /dashboard/fuel → página carrega com 3 cards KPI e tabela
2. Cards exibem valores corretos: custo do mês, consumo médio, contagem do mês
3. Clicar em "Novo Abastecimento" → navega para /dashboard/fuel/new
4. Preencher formulário e submeter → toast de sucesso + redirect para lista
5. Verificar que "Custo Total" no formulário é calculado em tempo real (não é input)
6. Abrir dropdown de ações na lista → Visualizar, Editar, Excluir presentes
7. Clicar em Editar → abre /dashboard/fuel/:id com dados pré-preenchidos
8. Salvar edição → toast de sucesso
9. Clicar em Excluir → modal de confirmação → ao confirmar, registro some da lista
10. Sidebar exibe "Abastecimento" com ícone Fuel na seção "Visão Geral"
11. Filtrar por veículo → tabela filtra corretamente
12. Verificar que sem organização selecionada exibe mensagem adequada
```

---

## 8. Notas críticas para o agente executor

1. **`totalCost` nunca vem do cliente.** O DTO de criação/atualização NÃO tem campo `totalCost`.
   O service SEMPRE calcula: `Math.round(liters * pricePerLiter * 100) / 100`.

2. **Rota `/stats` antes de `/:id`** no controller. Se invertido, NestJS vai tratar
   a string literal `"stats"` como um parâmetro dinâmico `:id`.

3. **Escopo de customer.** Ao criar/listar, verificar que o veículo pertence a um `customerId`
   dentro do `allowedCustomerIds` do membro (ou `null` = acesso total).
   Usar `CustomersService` já existente para resolver os IDs permitidos.

4. **Consumption pode ser `null`** no primeiro registro do veículo ou se o odômetro anterior
   não existir. Não retornar erro nesses casos.

5. **Migration, não db push.** Em produção usar sempre `prisma migrate dev` localmente
   e `prisma migrate deploy` em CI/CD. Nunca `prisma db push`.

6. **Relação com Driver é opcional** (módulo Drivers ainda não existe).
   O campo `driverId` no schema é uma `String?` sem FK explícita por enquanto.
   Quando o módulo Drivers for implementado, adicionar a FK e relation formalmente via migration.

7. **Formato de moeda.** No frontend, usar `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
   para exibir valores monetários, respeitando o locale da organização (`organization.currency`).

8. **Index de performance.** Os índices `@@index([vehicleId, date])` e `@@index([organizationId, date])`
   são críticos para a query de consumo (busca do registro anterior) e para os stats por período.
   Não remover.
