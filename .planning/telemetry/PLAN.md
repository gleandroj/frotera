# PLAN — Módulo TELEMETRY (Telemetria e Alertas)

> Agente executor: Claude Haiku
> Módulo: `TELEMETRY`
> Wave: 4 (Events) — depende de Wave 1 RBAC para PermissionGuard real; use placeholder enquanto RBAC não está disponível
> Data do plano: 2026-04-16

---

## 1. Objetivo

Implementar geração automática de alertas baseados em telemetria recebida pelo servidor TCP GT06, visualização desses alertas em tempo real via WebSocket, e configuração de zonas de geofence poligonais e circulares.

Escopo funcional:
- **SPEEDING**: alertar quando velocidade excede `vehicle.speedLimit`
- **IGNITION_ON / IGNITION_OFF**: detectar mudança de estado de ignição
- **GEOFENCE_ENTER / GEOFENCE_EXIT**: ponto dentro/fora de zonas configuradas (point-in-polygon / haversine)
- **DEVICE_OFFLINE**: job periódico detectando dispositivos sem posição por X minutos
- Listagem, filtro e reconhecimento de alertas pelo frontend
- Gerenciamento de zonas de geofence (CRUD + mapa Leaflet)
- Badge de alertas não lidos no sidebar

---

## 2. Schema Prisma

### 2.1 Adicionar campo `speedLimit` em Vehicle

```prisma
model Vehicle {
  // ... campos existentes ...
  speedLimit Float? // km/h; null = sem monitoramento de velocidade
}
```

### 2.2 Novos enums

```prisma
enum AlertType {
  SPEEDING
  HARSH_BRAKING
  RAPID_ACCELERATION
  GEOFENCE_ENTER
  GEOFENCE_EXIT
  DEVICE_OFFLINE
  LOW_BATTERY
  IGNITION_ON
  IGNITION_OFF
}

enum AlertSeverity {
  INFO
  WARNING
  CRITICAL
}

enum GeofenceType {
  CIRCLE
  POLYGON
}
```

### 2.3 Model TelemetryAlert

```prisma
model TelemetryAlert {
  id             String        @id @default(cuid())
  organizationId String
  vehicleId      String?
  deviceId       String
  type           AlertType
  severity       AlertSeverity
  message        String
  metadata       Json?         // { speed, speedLimit, latitude, longitude, geofenceId?, geofenceName? }
  acknowledgedAt DateTime?
  acknowledgedBy String?       // OrganizationMember.id
  createdAt      DateTime      @default(now())

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  vehicle      Vehicle?        @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  device       TrackerDevice   @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  acknowledger OrganizationMember? @relation("AlertAcknowledger", fields: [acknowledgedBy], references: [id], onDelete: SetNull)

  @@index([organizationId])
  @@index([vehicleId])
  @@index([deviceId])
  @@index([type])
  @@index([createdAt])
  @@index([acknowledgedAt])
  @@map("telemetry_alerts")
}
```

### 2.4 Model GeofenceZone

```prisma
model GeofenceZone {
  id             String       @id @default(cuid())
  organizationId String
  name           String
  description    String?
  type           GeofenceType // CIRCLE ou POLYGON
  coordinates    Json         // CIRCLE: { center: [lat, lng], radius: number (metros) }
                              // POLYGON: { points: [[lat, lng], ...] } (mínimo 3 pontos, fechado)
  vehicleIds     String[]     // [] = todos os veículos da org; ids específicos = filtro
  alertOnEnter   Boolean      @default(true)
  alertOnExit    Boolean      @default(true)
  active         Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([active])
  @@map("geofence_zones")
}
```

### 2.5 Relações a adicionar em modelos existentes

Em `Vehicle`, adicionar a relação inversa:
```prisma
model Vehicle {
  // ... existente ...
  telemetryAlerts TelemetryAlert[]
}
```

Em `TrackerDevice`, adicionar:
```prisma
model TrackerDevice {
  // ... existente ...
  telemetryAlerts TelemetryAlert[]
}
```

Em `OrganizationMember`, adicionar:
```prisma
model OrganizationMember {
  // ... existente ...
  acknowledgedAlerts TelemetryAlert[] @relation("AlertAcknowledger")
}
```

Em `Organization`, adicionar:
```prisma
model Organization {
  // ... existente ...
  telemetryAlerts TelemetryAlert[]
  geofenceZones   GeofenceZone[]
}
```

### 2.6 Arquivo de migration

Criar migration: `prisma/migrations/YYYYMMDDHHMMSS_add_telemetry_module/migration.sql`

Operações SQL necessárias:
1. `CREATE TYPE "AlertType" AS ENUM (...)`
2. `CREATE TYPE "AlertSeverity" AS ENUM (...)`
3. `CREATE TYPE "GeofenceType" AS ENUM (...)`
4. `ALTER TABLE "vehicles" ADD COLUMN "speedLimit" DOUBLE PRECISION;`
5. `CREATE TABLE "telemetry_alerts" (...)`
6. `CREATE TABLE "geofence_zones" (...)`
7. Todos os índices listados

---

## 3. Backend — Módulo `apps/api/src/telemetry/`

### 3.1 Estrutura de arquivos

```
apps/api/src/telemetry/
  telemetry.module.ts
  telemetry.controller.ts
  telemetry.service.ts
  telemetry.dto.ts
  telemetry-alerts.service.ts    ← lógica de geração de alertas (chamada pelo TCP handler)
  geofence.utils.ts              ← funções puras de geometria (point-in-polygon, haversine)
```

### 3.2 `telemetry.dto.ts`

```typescript
// Enums (espelham Prisma)
export enum AlertType { SPEEDING, HARSH_BRAKING, RAPID_ACCELERATION, GEOFENCE_ENTER, GEOFENCE_EXIT, DEVICE_OFFLINE, LOW_BATTERY, IGNITION_ON, IGNITION_OFF }
export enum AlertSeverity { INFO, WARNING, CRITICAL }
export enum GeofenceType { CIRCLE, POLYGON }

// Query alertas
export class ListAlertsQueryDto {
  @IsOptional() @IsEnum(AlertType)     type?: AlertType;
  @IsOptional() @IsEnum(AlertSeverity) severity?: AlertSeverity;
  @IsOptional() @IsString()            vehicleId?: string;
  @IsOptional() @IsBoolean()           acknowledged?: boolean; // true = só reconhecidos, false = só não reconhecidos
  @IsOptional() @IsString()            dateFrom?: string; // ISO
  @IsOptional() @IsString()            dateTo?: string;   // ISO
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(200) limit?: number = 50;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) offset?: number = 0;
}

// Response alert
export class TelemetryAlertResponseDto {
  id: string;
  organizationId: string;
  vehicleId: string | null;
  deviceId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata: Record<string, unknown> | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
  vehicle?: { id: string; name: string | null; plate: string | null } | null;
  device?: { id: string; imei: string; name: string | null } | null;
}

// Response stats
export class AlertStatsResponseDto {
  total: number;
  unacknowledged: number;
  byType: Record<AlertType, number>;
  bySeverity: Record<AlertSeverity, number>;
}

// Geofence DTOs
export class CircleCoordinatesDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(2) center: [number, number]; // [lat, lng]
  @IsNumber() @Min(1)                          radius: number; // metros
}

export class PolygonCoordinatesDto {
  @IsArray() @ArrayMinSize(3) points: Array<[number, number]>; // [[lat,lng], ...] mínimo 3
}

export class CreateGeofenceDto {
  @IsString() @MinLength(1)                    name: string;
  @IsOptional() @IsString()                    description?: string;
  @IsEnum(GeofenceType)                        type: GeofenceType;
  @IsObject()                                  coordinates: CircleCoordinatesDto | PolygonCoordinatesDto;
  @IsOptional() @IsArray() @IsString({ each: true }) vehicleIds?: string[];
  @IsOptional() @IsBoolean()                   alertOnEnter?: boolean;
  @IsOptional() @IsBoolean()                   alertOnExit?: boolean;
}

export class UpdateGeofenceDto extends PartialType(CreateGeofenceDto) {
  @IsOptional() @IsBoolean() active?: boolean;
}

export class GeofenceResponseDto {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  type: GeofenceType;
  coordinates: Record<string, unknown>;
  vehicleIds: string[];
  alertOnEnter: boolean;
  alertOnExit: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 3.3 `telemetry.controller.ts`

Rota base: `/api/organizations/:orgId/telemetry`

```typescript
@Controller('organizations/:orgId/telemetry')
@UseGuards(JwtAuthGuard)   // PermissionGuard(TELEMETRY, VIEW) — adicionar quando RBAC disponível
export class TelemetryController {

  // ALERTAS
  @Get('alerts')
  listAlerts(@Param('orgId') orgId: string, @Query() query: ListAlertsQueryDto)

  @Get('alerts/stats')
  getAlertStats(@Param('orgId') orgId: string)

  @Patch('alerts/:id/acknowledge')
  acknowledgeAlert(
    @Param('orgId') orgId: string,
    @Param('id') alertId: string,
    @CurrentMember() member: { id: string }   // decorator que extrai memberId do JWT + orgId
  )

  // GEOFENCES
  @Get('geofences')
  listGeofences(@Param('orgId') orgId: string)

  @Post('geofences')
  createGeofence(@Param('orgId') orgId: string, @Body() dto: CreateGeofenceDto)

  @Patch('geofences/:id')
  updateGeofence(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateGeofenceDto)

  @Delete('geofences/:id')
  deleteGeofence(@Param('orgId') orgId: string, @Param('id') id: string)
}
```

### 3.4 `telemetry.service.ts`

Métodos:

```typescript
// Alertas
async listAlerts(organizationId: string, query: ListAlertsQueryDto): Promise<{ data: TelemetryAlertResponseDto[]; total: number }>
async getAlertStats(organizationId: string): Promise<AlertStatsResponseDto>
async acknowledgeAlert(organizationId: string, alertId: string, memberId: string): Promise<TelemetryAlertResponseDto>

// Geofences
async listGeofences(organizationId: string): Promise<GeofenceResponseDto[]>
async createGeofence(organizationId: string, dto: CreateGeofenceDto): Promise<GeofenceResponseDto>
async updateGeofence(organizationId: string, id: string, dto: UpdateGeofenceDto): Promise<GeofenceResponseDto>
async deleteGeofence(organizationId: string, id: string): Promise<void>
```

Regras de negócio:
- `listAlerts`: filtrar sempre por `organizationId`; se `acknowledged=true`, where `acknowledgedAt IS NOT NULL`; se `acknowledged=false`, where `acknowledgedAt IS NULL`; suporte a `dateFrom/dateTo` em `createdAt`; incluir `vehicle` e `device` no select
- `getAlertStats`: contar total e não reconhecidos; agrupar por type e severity (queries separadas ou groupBy)
- `acknowledgeAlert`: verificar que o membro pertence à org; fazer `update` setando `acknowledgedAt = now()` e `acknowledgedBy = memberId`; throw `NotFoundException` se não encontrado
- `deleteGeofence`: `delete` físico (zonas não são entidades de negócio críticas); verificar que pertence à org

### 3.5 `telemetry-alerts.service.ts` — Geração de Alertas

Este serviço é chamado pelo `TrackerTcpService` a cada posição recebida. É um serviço puro que recebe os dados necessários e persiste alertas.

```typescript
@Injectable()
export class TelemetryAlertsService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsGateway: TelemetryAlertsGateway, // WebSocket gateway (ver seção 3.7)
  ) {}

  /**
   * Ponto de entrada principal: chamado pelo TrackerTcpService após receber posição.
   * Não lança exceção (never throws) — usa try/catch internamente.
   */
  async processPosition(params: {
    deviceId: string;
    organizationId: string;
    vehicleId: string | null;
    position: NormalizedPosition;
    prevIgnitionOn?: boolean | null; // estado anterior (vem do Redis ou contexto do socket)
    currentIgnitionOn?: boolean | null;
  }): Promise<void>

  /** Verifica velocidade. Só gera alerta se position.speed > vehicle.speedLimit. */
  private async checkSpeeding(params: { deviceId, vehicleId, orgId, position, speedLimit }): Promise<void>

  /** Detecta mudança de ignição ON->OFF ou OFF->ON. */
  private async checkIgnition(params: { deviceId, vehicleId, orgId, prevOn, currentOn, position }): Promise<void>

  /** Verifica todas as geofences ativas da org onde vehicleId está incluído (ou vehicleIds=[]).
      Para cada zona: calcula se posição atual está dentro E compara com estado anterior (Redis hash).
      Gera GEOFENCE_ENTER ou GEOFENCE_EXIT conforme transição. */
  private async checkGeofences(params: { deviceId, vehicleId, orgId, position }): Promise<void>

  /** Persiste o alerta e faz emit via WebSocket. */
  private async createAlert(data: {
    organizationId: string;
    vehicleId: string | null;
    deviceId: string;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>
}
```

**Estado de geofence no Redis**: usar hash key `telemetry:geofence:{deviceId}` → campo = geofenceId → valor = `"in"` ou `"out"`. Isso evita query ao banco para comparar estado anterior.

**Deduplicação de alertas**: antes de criar SPEEDING, verificar se já existe um alerta SPEEDING não reconhecido para o mesmo deviceId criado nos últimos 5 minutos. Se sim, não criar duplicata. Fazer isso via Redis (key `telemetry:alert:dedup:{deviceId}:{type}` com TTL de 5 minutos).

### 3.6 `geofence.utils.ts` — Geometria Pura

```typescript
/**
 * Point-in-polygon usando Ray Casting Algorithm.
 * @param point [lat, lng]
 * @param polygon array de [lat, lng] (mínimo 3 pontos)
 * @returns true se o ponto está dentro do polígono
 */
export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean

/**
 * Distância em metros entre dois pontos (haversine).
 */
export function haversineDistance(a: [number, number], b: [number, number]): number

/**
 * Verifica se ponto está dentro de um círculo.
 * @param point [lat, lng]
 * @param center [lat, lng]
 * @param radius metros
 */
export function pointInCircle(point: [number, number], center: [number, number], radius: number): boolean

/**
 * Despachante principal: dado um GeofenceZone (type + coordinates), retorna se o ponto está dentro.
 */
export function isPointInZone(point: [number, number], zone: { type: GeofenceType; coordinates: unknown }): boolean
```

### 3.7 `TelemetryAlertsGateway` (WebSocket)

Namespace: `/telemetry-alerts`

```typescript
@WebSocketGateway({ namespace: 'telemetry-alerts', cors: { origin: true } })
export class TelemetryAlertsGateway {
  @WebSocketServer() server: Server;

  // Mesma lógica de auth do TrackerPositionsGateway:
  // verifica JWT + membership na org
  async handleConnection(client: Socket): Promise<void>

  // Após auth, cliente entra em room: `org:{organizationId}`
  // TelemetryAlertsService chama: this.server.to(`org:${orgId}`).emit('telemetry:alert', alertDto)
  emitAlert(organizationId: string, alert: TelemetryAlertResponseDto): void
}
```

### 3.8 Job DEVICE_OFFLINE

Criar `telemetry-offline.cron.ts` dentro do módulo:

```typescript
@Injectable()
export class TelemetryOfflineCronService {
  @Cron('*/5 * * * *') // a cada 5 minutos
  async checkOfflineDevices(): Promise<void> {
    // Buscar todos os TrackerDevices com connectedAt != null
    // Para cada um, verificar se não recebeu posição nos últimos OFFLINE_THRESHOLD_MINUTES (default: 15 min)
    // Verificar última posição em DevicePosition (max recordedAt) ou via Redis lastPrefix
    // Se offline, criar alerta DEVICE_OFFLINE (com deduplicação: não criar se já existe alerta não reconhecido recente)
    // NUNCA sobrescrever connectedAt (isso é feito apenas pelo TCP server)
  }
}
```

Variável de ambiente: `DEVICE_OFFLINE_THRESHOLD_MINUTES` (default: 15)

### 3.9 `telemetry.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuthModule, TrackersModule], // TrackersModule exporta TRACKER_REDIS
  controllers: [TelemetryController],
  providers: [
    TelemetryService,
    TelemetryAlertsService,
    TelemetryAlertsGateway,
    TelemetryOfflineCronService,
  ],
  exports: [TelemetryAlertsService], // exportado para TrackersTcpModule
})
export class TelemetryModule {}
```

### 3.10 Integração com TCP Server

**Onde**: `TrackerTcpService.handleGT06Packet()` — no bloco `isGT06Location`.

**Como**: O `TrackerTcpService` já injeta serviços no construtor. Adicionar `TelemetryAlertsService` como dependência opcional (via `@Optional()` ou via módulo).

**Problema de dependência circular**: `TrackersTcpModule` importa `TrackersModule`; `TelemetryModule` também importa `TrackersModule`. Para evitar circular dependency, `TelemetryAlertsService` deve ser exportado por `TelemetryModule` e `TrackersTcpModule` deve importar `TelemetryModule`.

**Sequência de chamada no TCP handler:**

```typescript
// Em handleGT06Packet, após pushPosition:
if (position && ctx.deviceId && ctx.imei) {
  await this.redisWriter.pushPosition(ctx.deviceId, ctx.imei, position);

  // NOVO: disparar verificação de alertas (fire-and-forget com log de erro)
  if (this.telemetryAlertsService) {
    const device = await this.getDeviceContext(ctx.deviceId); // cache local no socket context
    this.telemetryAlertsService
      .processPosition({
        deviceId: ctx.deviceId,
        organizationId: device.organizationId,
        vehicleId: device.vehicle?.id ?? null,
        position,
        prevIgnitionOn: ctx.prevIgnitionOn,        // adicionar ao SocketContext
        currentIgnitionOn: extractIgnitionFromPosition(position), // null se protocolo não suporta
      })
      .catch(err => this.logger.warn(`Alert processing failed: ${err.message}`));
  }
}
```

**Adicionar ao `SocketContext`:**

```typescript
interface SocketContext {
  buffer: Buffer;
  deviceId: string | null;
  imei: string | null;
  protocol: "GT06" | null;
  deviceOrganizationId: string | null;   // NOVO: evitar query repetida
  deviceVehicleId: string | null;         // NOVO
  prevIgnitionOn: boolean | null;         // NOVO: estado anterior de ignição
}
```

**Cache de contexto do dispositivo**: após login GT06 bem-sucedido, popular `ctx.deviceOrganizationId` e `ctx.deviceVehicleId` para evitar query a cada posição.

**Extração de ignição**: o protocolo GT06 0x22/0xA0 inclui bits de status no `courseStatus` word. O bit relevante para ignição varia por firmware. Por ora, passar `currentIgnitionOn: null` (desconhecido) — o serviço ignora se null. Pode ser expandido futuramente quando o parsing de flags for implementado.

**Modificação no `TrackersTcpModule`:**

```typescript
@Module({
  imports: [TrackersModule, TelemetryModule], // ADICIONAR TelemetryModule
  providers: [TrackerTcpService, TrackerPersistCronService],
})
export class TrackersTcpModule {}
```

---

## 4. Frontend

### 4.1 Estrutura de arquivos

```
apps/web/app/dashboard/telemetry/
  page.tsx                  ← lista de alertas com tabs
  geofences/
    page.tsx                ← lista de zonas + formulário + mapa
  components/
    alert-table.tsx         ← DataTable de alertas
    alert-badge.tsx         ← badge de severidade
    geofence-form-dialog.tsx
    geofence-map.tsx        ← componente Leaflet
```

### 4.2 `apps/web/lib/api/telemetry.ts` — API Client

```typescript
import { externalApi } from '@/lib/frontend/api-client';

const base = (orgId: string) => `/api/organizations/${orgId}/telemetry`;

export const telemetryAPI = {
  listAlerts: (orgId: string, params?: ListAlertsParams) =>
    externalApi.get(`${base(orgId)}/alerts`, { params }),

  getAlertStats: (orgId: string) =>
    externalApi.get(`${base(orgId)}/alerts/stats`),

  acknowledgeAlert: (orgId: string, alertId: string) =>
    externalApi.patch(`${base(orgId)}/alerts/${alertId}/acknowledge`),

  listGeofences: (orgId: string) =>
    externalApi.get(`${base(orgId)}/geofences`),

  createGeofence: (orgId: string, data: CreateGeofencePayload) =>
    externalApi.post(`${base(orgId)}/geofences`, data),

  updateGeofence: (orgId: string, id: string, data: Partial<CreateGeofencePayload>) =>
    externalApi.patch(`${base(orgId)}/geofences/${id}`, data),

  deleteGeofence: (orgId: string, id: string) =>
    externalApi.delete(`${base(orgId)}/geofences/${id}`),
};
```

### 4.3 `apps/web/app/dashboard/telemetry/page.tsx`

**Componente `"use client"`.**

- Exibe título "Telemetria" com subtítulo
- Tabs: `Novos` (não reconhecidos) | `Reconhecidos`
- DataTable com colunas: Severidade (badge colorido), Tipo, Veículo, Mensagem, Data/Hora, Ações
- Filtros: tipo de alerta (select), veículo (select), período (date range)
- Botão "Reconhecer" em cada linha da aba "Novos"
- Ao reconhecer: chama API → atualiza lista otimisticamente
- WebSocket: conecta ao namespace `/telemetry-alerts`, escuta `telemetry:alert` → adiciona item ao topo da lista de novos
- Paginação: offset/limit com controles de página
- Loading state com `SkeletonTable`

**Badges de severidade:**
- `CRITICAL` → `bg-red-500`
- `WARNING` → `bg-yellow-500`
- `INFO` → `bg-blue-500`

**Tipos de alerta (i18n):**
- Chave: `telemetry.alertTypes.{TYPE}` (ver seção 4.6)

### 4.4 `apps/web/app/dashboard/telemetry/geofences/page.tsx`

**Componente `"use client"`.**

- Lista de zonas em cards ou tabela: Nome, Tipo (CIRCLE/POLYGON), Status (Ativo/Inativo), Alertas (entrar/sair), Ações
- Botão "Nova Zona" → abre `GeofencFormDialog`
- `GeofenceFormDialog`: formulário com campos nome, descrição, tipo (radio), e mapa interativo
- **Mapa (Leaflet via `react-leaflet`):**
  - Para CIRCLE: usuário clica no mapa para definir centro; slider para raio
  - Para POLYGON: usuário clica para adicionar vértices; clique no primeiro ponto fecha o polígono
  - Visualização das zonas existentes no mapa em layer separado
- Instalar: `react-leaflet`, `leaflet` (verificar se já existe no package.json de `apps/web`)
- Editar zona: pré-popula o formulário e mapa com coordenadas existentes
- Deletar zona: confirmação antes de deletar

**Nota sobre SSR**: componentes Leaflet devem ser importados com `dynamic(..., { ssr: false })` para evitar erros de hydration.

### 4.5 Badge de alertas não lidos no sidebar

**`apps/web/components/navigation/app-sidebar.tsx`** — adicionar item "Telemetria":

```tsx
// No mainNavigation, seção overview:
{
  name: t('navigation.items.telemetry'),
  href: '/dashboard/telemetry',
  icon: Bell,   // lucide-react
  current: pathname.startsWith('/dashboard/telemetry'),
  badge: unreadCount > 0 ? unreadCount : undefined,
}
```

**Hook `useUnreadAlerts`** em `apps/web/lib/hooks/use-unread-alerts.ts`:

```typescript
// Chama GET /alerts/stats a cada 60 segundos (polling simples)
// Retorna { count: number }
// Usa WebSocket como source primária para incremento em tempo real
export function useUnreadAlerts(orgId: string | undefined): { count: number }
```

**Renderização do badge no sidebar** (modificar `AppSidebar`):

```tsx
// Adicionar ao NavigationItem interface:
badge?: number;

// No JSX do item:
{item.badge != null && item.badge > 0 && (
  <Badge variant="destructive" className="ml-auto text-xs min-w-5 h-5">
    {item.badge > 99 ? '99+' : item.badge}
  </Badge>
)}
```

### 4.6 Chaves i18n em `pt.json`

Adicionar seção `telemetry` ao `apps/web/i18n/locales/pt.json`:

```json
"telemetry": {
  "title": "Telemetria",
  "description": "Alertas automáticos gerados pelos rastreadores.",
  "tabs": {
    "new": "Novos",
    "acknowledged": "Reconhecidos"
  },
  "alerts": {
    "noAlerts": "Nenhum alerta encontrado.",
    "acknowledge": "Reconhecer",
    "acknowledgeSuccess": "Alerta reconhecido.",
    "acknowledgeError": "Erro ao reconhecer alerta.",
    "columns": {
      "severity": "Severidade",
      "type": "Tipo",
      "vehicle": "Veículo",
      "message": "Mensagem",
      "createdAt": "Data/Hora",
      "actions": "Ações"
    },
    "filters": {
      "type": "Tipo de alerta",
      "vehicle": "Veículo",
      "dateFrom": "De",
      "dateTo": "Até",
      "allTypes": "Todos os tipos"
    }
  },
  "alertTypes": {
    "SPEEDING": "Excesso de velocidade",
    "HARSH_BRAKING": "Frenagem brusca",
    "RAPID_ACCELERATION": "Aceleração rápida",
    "GEOFENCE_ENTER": "Entrou na zona",
    "GEOFENCE_EXIT": "Saiu da zona",
    "DEVICE_OFFLINE": "Dispositivo offline",
    "LOW_BATTERY": "Bateria baixa",
    "IGNITION_ON": "Ignição ligada",
    "IGNITION_OFF": "Ignição desligada"
  },
  "alertSeverity": {
    "INFO": "Info",
    "WARNING": "Atenção",
    "CRITICAL": "Crítico"
  },
  "geofences": {
    "title": "Zonas de Geofence",
    "description": "Configure zonas geográficas para monitorar entradas e saídas.",
    "noZones": "Nenhuma zona configurada.",
    "newZone": "Nova Zona",
    "editZone": "Editar Zona",
    "deleteZone": "Excluir Zona",
    "deleteConfirm": "Tem certeza que deseja excluir a zona \"{{name}}\"? Esta ação não pode ser desfeita.",
    "createSuccess": "Zona criada com sucesso.",
    "updateSuccess": "Zona atualizada com sucesso.",
    "deleteSuccess": "Zona excluída com sucesso.",
    "form": {
      "name": "Nome da zona",
      "namePlaceholder": "Ex: Sede principal",
      "description": "Descrição",
      "type": "Tipo de zona",
      "typeCircle": "Circular",
      "typePolygon": "Poligonal",
      "radius": "Raio (metros)",
      "radiusHint": "Raio mínimo: 50 metros",
      "alertOnEnter": "Alertar ao entrar",
      "alertOnExit": "Alertar ao sair",
      "vehicles": "Veículos monitorados",
      "vehiclesHint": "Deixe vazio para monitorar todos os veículos",
      "mapInstructions": {
        "circle": "Clique no mapa para definir o centro da zona circular.",
        "polygon": "Clique no mapa para adicionar pontos. Clique no primeiro ponto para fechar o polígono."
      }
    },
    "columns": {
      "name": "Nome",
      "type": "Tipo",
      "status": "Status",
      "alertOnEnter": "Entrar",
      "alertOnExit": "Sair",
      "actions": "Ações"
    }
  }
},
"navigation": {
  "items": {
    "telemetry": "Telemetria"
  }
}
```

> Nota: as chaves de `navigation` já existem no arquivo, adicionar apenas a chave `telemetry` dentro de `navigation.items`.

---

## 5. Dependência de RBAC

**Placeholder**: enquanto o módulo RBAC (Wave 1) não está implementado, usar apenas `JwtAuthGuard` e verificar `organizationId` via query direta ao Prisma (padrão atual do codebase).

**Quando RBAC for implementado**, adicionar:

```typescript
// No controller:
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permission(Module.TELEMETRY, Action.VIEW)
@Get('alerts')
```

**Permissões do módulo TELEMETRY** (para seed do RBAC):

| Ação | Quem precisa |
|---|---|
| `VIEW` | OPERATOR, COMPANY_ADMIN, COMPANY_OWNER, VIEWER |
| `CREATE` | Interno (sistema gera alertas automaticamente) |
| `EDIT` | COMPANY_ADMIN, COMPANY_OWNER (para acknowledge) |
| `DELETE` | COMPANY_OWNER (para deletar geofences) |

---

## 6. Complexidade e Riscos

### Alto Risco

1. **Integração com TCP server**: o `TrackerTcpService` roda em processo separado (`TrackersTcpModule` — `tracker-main.ts`). O `TelemetryModule` precisa ser importado lá. Verificar se a arquitetura de módulos NestJS permite isso sem circular dependency. **Mitigação**: exportar apenas `TelemetryAlertsService` de `TelemetryModule`; não exportar `TelemetryController` ou outros providers desnecessários.

2. **Point-in-polygon em alta frequência**: cada posição recebida pode disparar verificação de N zonas ativas. Em orgs com muitos veículos e zonas, isso pode ser custoso. **Mitigação**: carregar zonas em cache (Redis hash `telemetry:geofences:{orgId}` com TTL de 60s); invalidar cache ao criar/editar/deletar zona.

3. **Deduplicação de alertas**: sem deduplicação, um veículo acima do limite de velocidade geraria centenas de alertas SPEEDING por hora. **Mitigação**: chave Redis com TTL (descrito na seção 3.5).

### Médio Risco

4. **Estado de geofence entre posições**: o estado "está dentro/fora" precisa persistir entre pacotes TCP. Usar Redis (chave por deviceId + geofenceId). Se Redis reiniciar, o estado é perdido e pode gerar alertas falsos de ENTER/EXIT. **Mitigação**: após reinício, tratar estado inicial como "desconhecido" e não gerar alertas na primeira posição recebida após o reinício (flag `firstPositionAfterRestart`).

5. **Leaflet no SSR Next.js**: Leaflet depende de `window` e `document`, causando erros no App Router. **Mitigação**: usar `dynamic(() => import('./components/geofence-map'), { ssr: false })`.

6. **Geração de alertas em processos separados**: o gateway WebSocket `TelemetryAlertsGateway` roda no processo HTTP, mas os alertas são gerados no processo TCP. Usar Redis Pub/Sub (padrão já existente em `tracker-positions`) para comunicação entre processos.

### Baixo Risco

7. **Ignição via GT06**: os bits de ignição no byte de status do GT06 variam por firmware. Por ora, `IGNITION_ON/OFF` não será gerado até que o parsing desses bits seja validado com hardware real.

8. **Coordenadas de geofence em JSON**: sem validação de coordenadas no banco (apenas no DTO). Garantir que a validação do DTO seja robusta (nested validators).

---

## 7. Ordem de Implementação

### Task 1 — Schema e Migration
**Arquivo**: `apps/api/prisma/schema.prisma`
1. Adicionar `speedLimit Float?` em `Vehicle`
2. Adicionar enums `AlertType`, `AlertSeverity`, `GeofenceType`
3. Criar models `TelemetryAlert` e `GeofenceZone` com todas as relações e índices
4. Adicionar relações inversas em `Vehicle`, `TrackerDevice`, `OrganizationMember`, `Organization`
5. Executar `npx prisma generate`
6. Criar arquivo de migration manual em `prisma/migrations/`

### Task 2 — Geometria e Utilities
**Arquivo**: `apps/api/src/telemetry/geofence.utils.ts`
1. Implementar `haversineDistance`
2. Implementar `pointInPolygon` (ray casting)
3. Implementar `pointInCircle`
4. Implementar `isPointInZone` (dispatcher)
5. Escrever testes unitários básicos (pontos conhecidos dentro e fora)

### Task 3 — DTOs
**Arquivo**: `apps/api/src/telemetry/telemetry.dto.ts`
1. Criar todos os DTOs conforme seção 3.2
2. Importar `class-validator` e `class-transformer` (já presentes no projeto)

### Task 4 — TelemetryService (CRUD)
**Arquivo**: `apps/api/src/telemetry/telemetry.service.ts`
1. `listAlerts` com filtros completos
2. `getAlertStats` com agrupamento
3. `acknowledgeAlert` com validação de membership
4. `listGeofences`
5. `createGeofence` com validação de coordenadas conforme tipo
6. `updateGeofence`
7. `deleteGeofence`

### Task 5 — TelemetryAlertsGateway
**Arquivo**: `apps/api/src/telemetry/telemetry-alerts.gateway.ts`
1. Copiar estrutura do `TrackerPositionsGateway` (mesmo padrão de auth)
2. Namespace: `/telemetry-alerts`
3. Ao conectar: cliente entra em room `org:{organizationId}`
4. Método público `emitAlert(orgId, alert)` chamado por `TelemetryAlertsService`
5. **Cross-process**: publicar no Redis channel `telemetry:alert:{orgId}` em vez de emitir diretamente; o gateway subscreve esse canal via Redis SUB (mesmo padrão de `TrackerPositionsStreamService`)

### Task 6 — TelemetryAlertsService
**Arquivo**: `apps/api/src/telemetry/telemetry-alerts.service.ts`
1. `processPosition` — orquestrador
2. `checkSpeeding` — buscar `speedLimit` do veículo (cacheado no contexto TCP)
3. `checkIgnition` — comparar `prevIgnitionOn` vs `currentIgnitionOn` (null = ignorar)
4. `checkGeofences` — carregar zonas da org (Redis cache ou Prisma); calcular `isPointInZone`; comparar com estado Redis `telemetry:geofence:{deviceId}`
5. `createAlert` — persistir no DB + publicar no Redis `telemetry:alert:{orgId}`
6. Deduplicação via Redis TTL

### Task 7 — TelemetryOfflineCronService
**Arquivo**: `apps/api/src/telemetry/telemetry-offline.cron.ts`
1. Cron a cada 5 minutos
2. Query: `TrackerDevice` com `connectedAt != null`
3. Para cada device: buscar `lastPosition` via `redisWriter.getLastPosition(deviceId)` (já existe)
4. Se `lastPosition.recordedAt` mais antigo que threshold → criar alerta DEVICE_OFFLINE
5. Deduplicação: não criar se existe alerta DEVICE_OFFLINE não reconhecido para o device nos últimos `OFFLINE_THRESHOLD_MINUTES * 2` minutos

### Task 8 — TelemetryModule e registro em AppModule
**Arquivo**: `apps/api/src/telemetry/telemetry.module.ts`
1. Criar módulo conforme seção 3.9
2. Adicionar `TelemetryModule` em `apps/api/src/app.module.ts`
3. Adicionar `TelemetryModule` em `apps/api/src/trackers/trackers-tcp.module.ts`
4. Injetar `TelemetryAlertsService` em `TrackerTcpService` (construtor)
5. Atualizar `SocketContext` com campos adicionais
6. Atualizar `handleGT06Packet` para chamar `processPosition`

### Task 9 — TelemetryController
**Arquivo**: `apps/api/src/telemetry/telemetry.controller.ts`
1. Todos os endpoints conforme seção 3.3
2. Usar `JwtAuthGuard` (placeholder para PermissionGuard)
3. Verificar que `organizationId` do JWT bate com `:orgId` do path (ou member tem acesso à org)

### Task 10 — Frontend: API Client
**Arquivo**: `apps/web/lib/api/telemetry.ts`
1. Criar todas as funções de API conforme seção 4.2
2. Criar tipos TypeScript de resposta (espelhar DTOs do backend)

### Task 11 — Frontend: Página de Alertas
**Arquivo**: `apps/web/app/dashboard/telemetry/page.tsx`
1. Tabs Novos / Reconhecidos
2. DataTable com `alert-table.tsx` component
3. Filtros (tipo, veículo, período)
4. Botão reconhecer com feedback
5. Paginação
6. WebSocket: conectar `/telemetry-alerts`, escutar `telemetry:alert`
7. Adicionar `buildTelemetryAlertsSocket` em `api-client.ts`

### Task 12 — Frontend: Página de Geofences
**Arquivo**: `apps/web/app/dashboard/telemetry/geofences/page.tsx`
1. Lista de zonas
2. Instalar `react-leaflet` e `leaflet` em `apps/web` se não presente
3. `GeofenceMap` component com `dynamic` import
4. `GeofenceFormDialog` com formulário + mapa
5. Lógica de desenho de círculo e polígono no mapa
6. CRUD completo conectado à API

### Task 13 — Frontend: Badge no Sidebar
**Arquivo**: `apps/web/components/navigation/app-sidebar.tsx`
1. Adicionar item "Telemetria" com ícone `Bell`
2. Criar hook `useUnreadAlerts` com polling de 60s
3. Renderizar badge com contagem
4. Atualizar `NavigationItem` interface para suportar `badge`

### Task 14 — i18n
**Arquivo**: `apps/web/i18n/locales/pt.json`
1. Adicionar todas as chaves da seção 4.6
2. Verificar que todas as chaves são consumidas nas páginas

---

## 8. Testes de Verificação

### 8.1 Testes de unidade — geometria (`geofence.utils.ts`)

```
[PASS] pointInPolygon: ponto no centro de quadrado → true
[PASS] pointInPolygon: ponto fora do quadrado → false
[PASS] pointInPolygon: ponto no vértice do quadrado → determinístico (edge case)
[PASS] pointInCircle: ponto a 50m do centro, raio=100m → true
[PASS] pointInCircle: ponto a 150m do centro, raio=100m → false
[PASS] haversineDistance: dois pontos conhecidos (ex: São Paulo → Rio) → dentro de margem 1%
```

### 8.2 Testes de integração — backend

```
[PASS] GET /api/organizations/:orgId/telemetry/alerts → retorna array vazio inicialmente
[PASS] GET /api/organizations/:orgId/telemetry/alerts?acknowledged=false → filtra corretamente
[PASS] PATCH /api/organizations/:orgId/telemetry/alerts/:id/acknowledge → seta acknowledgedAt
[PASS] PATCH acknowledge com alertId de outra org → 404
[PASS] GET /api/organizations/:orgId/telemetry/alerts/stats → retorna { total, unacknowledged, byType, bySeverity }
[PASS] POST /api/organizations/:orgId/telemetry/geofences (CIRCLE) → cria zona com coordinates.center e coordinates.radius
[PASS] POST /api/organizations/:orgId/telemetry/geofences (POLYGON) → cria zona com coordinates.points
[PASS] PATCH geofence/:id → atualiza campos
[PASS] DELETE geofence/:id → remove; GET seguinte retorna lista sem o item
[PASS] POST geofence com tipo CIRCLE sem radius → 400 (validação)
[PASS] POST geofence com POLYGON com 2 pontos → 400 (mínimo 3)
```

### 8.3 Testes do TelemetryAlertsService

```
[PASS] processPosition com speed=100, speedLimit=80 → cria alerta SPEEDING WARNING
[PASS] processPosition com speed=60, speedLimit=80 → NÃO cria alerta SPEEDING
[PASS] processPosition com speed=100, speedLimit=null → NÃO cria alerta SPEEDING
[PASS] processPosition com ignition ON→ON → NÃO cria alerta de ignição
[PASS] processPosition com ignition OFF→ON → cria alerta IGNITION_ON INFO
[PASS] processPosition com ignition ON→OFF → cria alerta IGNITION_OFF INFO
[PASS] processPosition dentro de zona CIRCLE (alertOnEnter=true) → cria GEOFENCE_ENTER WARNING
[PASS] processPosition dentro de zona CIRCLE, posição anterior também dentro → NÃO cria GEOFENCE_ENTER
[PASS] processPosition fora de zona, posição anterior dentro → cria GEOFENCE_EXIT INFO
[PASS] SPEEDING consecutivo em <5min → deduplicado, NÃO cria segundo alerta
```

### 8.4 Testes do job DEVICE_OFFLINE

```
[PASS] Dispositivo com lastPosition.recordedAt há 20min (threshold=15min) → cria alerta DEVICE_OFFLINE
[PASS] Dispositivo com lastPosition.recordedAt há 10min (threshold=15min) → NÃO cria alerta
[PASS] Dispositivo sem posição no Redis → verifica DevicePosition no banco; se vazio → cria alerta
[PASS] Alerta DEVICE_OFFLINE já existente não reconhecido → deduplicado, NÃO cria segundo
```

### 8.5 Verificação manual — Frontend

```
[CHECK] Página /dashboard/telemetry carrega sem erros
[CHECK] Tabs "Novos" e "Reconhecidos" alternam o filtro
[CHECK] Clicar "Reconhecer" → alerta some da aba "Novos" e aparece em "Reconhecidos"
[CHECK] Badge no sidebar mostra contagem correta de alertas não reconhecidos
[CHECK] Badge some quando todos os alertas são reconhecidos
[CHECK] Página /dashboard/telemetry/geofences carrega mapa (sem erro de SSR)
[CHECK] Criar zona CIRCLE: clicar no mapa → círculo aparece → salvar → aparece na lista
[CHECK] Criar zona POLYGON: clicar 3+ pontos → fechar polígono → salvar → aparece na lista
[CHECK] Deletar zona: confirmação aparece → confirmar → zona removida da lista
[CHECK] WebSocket: simular posição acima do speedLimit → alerta aparece em tempo real na página
```

### 8.6 Verificação de performance

```
[CHECK] Com 10 geofences ativas e 100 posições/minuto: CPU do processo TCP < 5% de overhead
[CHECK] Redis key `telemetry:geofences:{orgId}` tem TTL de 60s (verificar com TTL command)
[CHECK] Redis key `telemetry:alert:dedup:{deviceId}:SPEEDING` tem TTL de 300s
```

---

## Dependências externas a instalar

### Backend (`apps/api`)
Nenhuma nova dependência — tudo disponível via NestJS e Prisma existentes.

### Frontend (`apps/web`)
```bash
# Verificar se já existe; se não:
pnpm add react-leaflet leaflet
pnpm add -D @types/leaflet
```

### Variáveis de ambiente novas (`.env`)
```
DEVICE_OFFLINE_THRESHOLD_MINUTES=15
```

---

## Notas para o agente executor

1. **Não alterar** lógica existente de `TrackerTcpService.processBuffer` ou `handleGT06Packet` além das adições descritas. Toda a lógica nova é aditiva.
2. **Não criar** testes em arquivos `.spec.ts` a menos que o projeto já tenha uma suite de testes configurada — verificar se existe `jest.config.ts` antes.
3. **Sempre filtrar por `organizationId`** em toda query do `TelemetryService`.
4. **Fire-and-forget** para `processPosition` no TCP handler — nunca `await` sem try/catch, para não bloquear o processamento de pacotes.
5. O campo `speedLimit` em `Vehicle` deve ser editável pela UI existente de veículos — adicionar ao `UpdateVehicleDto` e ao formulário de edição de veículo (`vehicle-form-dialog.tsx`).
6. Ao criar a migration manualmente, testar localmente com `npx prisma migrate dev --name add_telemetry_module` antes de commitar o arquivo SQL gerado.
7. O `TelemetryAlertsGateway` deve seguir o mesmo padrão de Redis SUB que `TrackerPositionsStreamService` para suporte multi-processo. Não emitir diretamente do processo TCP.
