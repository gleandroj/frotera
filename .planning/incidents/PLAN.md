# Módulo INCIDENTS (Ocorrências) — Plano de Implementação

> Wave 4 — Eventos  
> Pré-requisito: RBAC (Wave 1), Drivers (Wave 2) devem estar implementados.  
> Este documento é executável por um agente Haiku. Siga as tarefas em ordem.

---

## 1. Objetivo

Registrar e acompanhar ocorrências operacionais da frota: acidentes, multas, furtos, avarias, vandalismo e outros. Cada ocorrência possui tipo, status com fluxo de transição, nível de gravidade e custo. Vinculada a veículo e/ou motorista, com suporte a anexos (URLs) e sinistro de seguro.

---

## 2. Schema Prisma

### 2.1 Enums

Adicionar ao arquivo `apps/api/prisma/schema.prisma`, após os enums existentes (`Role`, `InvitationStatus`, etc.):

```prisma
enum IncidentType {
  ACCIDENT
  THEFT
  FINE
  BREAKDOWN
  VANDALISM
  OTHER
}

enum IncidentStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum IncidentSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

### 2.2 Models

Adicionar ao `schema.prisma`, após o model `Notification`:

```prisma
model Incident {
  id              String           @id @default(cuid())
  organizationId  String
  vehicleId       String?
  driverId        String?
  createdById     String           // OrganizationMember.id
  type            IncidentType
  title           String
  description     String?
  date            DateTime
  location        String?
  status          IncidentStatus   @default(OPEN)
  severity        IncidentSeverity @default(LOW)
  cost            Float?
  insuranceClaim  Boolean          @default(false)
  claimNumber     String?
  notes           String?
  resolvedAt      DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  organization Organization          @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  vehicle      Vehicle?              @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  createdBy    OrganizationMember    @relation("IncidentCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  attachments  IncidentAttachment[]

  @@index([organizationId])
  @@index([vehicleId])
  @@index([driverId])
  @@index([status])
  @@index([type])
  @@index([date])
  @@map("incidents")
}

model IncidentAttachment {
  id         String   @id @default(cuid())
  incidentId String
  fileUrl    String
  fileType   String   // "image/jpeg", "application/pdf", etc.
  name       String
  createdAt  DateTime @default(now())

  incident Incident @relation(fields: [incidentId], references: [id], onDelete: Cascade)

  @@index([incidentId])
  @@map("incident_attachments")
}
```

### 2.3 Relações inversas a adicionar nos models existentes

No model `Vehicle`, adicionar:
```prisma
  incidents Incident[]
```

No model `OrganizationMember`, adicionar:
```prisma
  createdIncidents Incident[] @relation("IncidentCreatedBy")
```

### 2.4 Nota sobre driverId

O campo `driverId` é uma `String?` livre por enquanto (Wave 4 — o módulo Drivers é Wave 2). Quando o módulo Drivers for implementado, adicionar:
```prisma
  driver Driver? @relation(fields: [driverId], references: [id], onDelete: SetNull)
```
e a relação inversa no model `Driver`.

---

## 3. Migration Prisma

Após editar o schema, rodar:
```bash
cd apps/api
npx prisma migrate dev --name add_incidents_module
npx prisma generate
```

---

## 4. Backend — `apps/api/src/incidents/`

### 4.1 `incidents.dto.ts`

```typescript
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsDateString,
  IsNotEmpty,
  MaxLength,
  Min,
} from 'class-validator';
import { IncidentType, IncidentStatus, IncidentSeverity } from '@prisma/client';
import { Type } from 'class-transformer';

// ── CREATE ──────────────────────────────────────────────────────────────────

export class CreateIncidentDto {
  @IsEnum(IncidentType)
  type: IncidentType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cost?: number;

  @IsOptional()
  @IsBoolean()
  insuranceClaim?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  claimNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ── UPDATE ──────────────────────────────────────────────────────────────────

export class UpdateIncidentDto {
  @IsOptional()
  @IsEnum(IncidentType)
  type?: IncidentType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cost?: number;

  @IsOptional()
  @IsBoolean()
  insuranceClaim?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  claimNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ── ATTACHMENT ───────────────────────────────────────────────────────────────

export class AddAttachmentDto {
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fileType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}

// ── QUERY FILTERS ────────────────────────────────────────────────────────────

export class IncidentFiltersDto {
  @IsOptional()
  @IsEnum(IncidentType)
  type?: IncidentType;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
```

### 4.2 `incidents.service.ts`

```typescript
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { IncidentStatus } from '@prisma/client';
import {
  CreateIncidentDto,
  UpdateIncidentDto,
  AddAttachmentDto,
  IncidentFiltersDto,
} from './incidents.dto';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── helpers ──────────────────────────────────────────────────────────────

  private async getMember(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this organization');
    return member;
  }

  private async findOrFail(id: string, organizationId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, organizationId },
      include: { attachments: true, vehicle: { select: { id: true, name: true, plate: true } } },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  // ── LIST ─────────────────────────────────────────────────────────────────

  async list(organizationId: string, filters: IncidentFiltersDto) {
    const {
      type,
      status,
      severity,
      vehicleId,
      driverId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { organizationId };
    if (type) where.type = type;
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (vehicleId) where.vehicleId = vehicleId;
    if (driverId) where.driverId = driverId;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [incidents, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        include: {
          attachments: true,
          vehicle: { select: { id: true, name: true, plate: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { incidents, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── CREATE ────────────────────────────────────────────────────────────────

  async create(userId: string, organizationId: string, dto: CreateIncidentDto) {
    const member = await this.getMember(userId, organizationId);

    // Validate vehicleId belongs to this org (if provided)
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, organizationId },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found in this organization');
    }

    return this.prisma.incident.create({
      data: {
        organizationId,
        createdById: member.id,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        date: new Date(dto.date),
        location: dto.location,
        severity: dto.severity,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        cost: dto.cost,
        insuranceClaim: dto.insuranceClaim ?? false,
        claimNumber: dto.claimNumber,
        notes: dto.notes,
        status: IncidentStatus.OPEN,
      },
      include: { attachments: true },
    });
  }

  // ── GET ONE ───────────────────────────────────────────────────────────────

  async findOne(organizationId: string, id: string) {
    return this.findOrFail(id, organizationId);
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  async update(organizationId: string, id: string, dto: UpdateIncidentDto) {
    await this.findOrFail(id, organizationId);

    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, organizationId },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found in this organization');
    }

    // Auto-set resolvedAt when status transitions to RESOLVED
    const resolvedAt =
      dto.status === IncidentStatus.RESOLVED ? new Date() : undefined;

    return this.prisma.incident.update({
      where: { id },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
        ...(resolvedAt !== undefined && { resolvedAt }),
      },
      include: { attachments: true },
    });
  }

  // ── DELETE ────────────────────────────────────────────────────────────────

  async remove(organizationId: string, id: string) {
    await this.findOrFail(id, organizationId);
    await this.prisma.incident.delete({ where: { id } });
    return { success: true };
  }

  // ── ATTACHMENTS ───────────────────────────────────────────────────────────

  async addAttachment(organizationId: string, incidentId: string, dto: AddAttachmentDto) {
    await this.findOrFail(incidentId, organizationId);
    return this.prisma.incidentAttachment.create({
      data: { incidentId, fileUrl: dto.fileUrl, fileType: dto.fileType, name: dto.name },
    });
  }

  async removeAttachment(organizationId: string, incidentId: string, attachmentId: string) {
    await this.findOrFail(incidentId, organizationId);
    const attachment = await this.prisma.incidentAttachment.findFirst({
      where: { id: attachmentId, incidentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.prisma.incidentAttachment.delete({ where: { id: attachmentId } });
    return { success: true };
  }

  // ── STATS ─────────────────────────────────────────────────────────────────

  async stats(organizationId: string, dateFrom?: string, dateTo?: string) {
    const dateFilter: any = {};
    if (dateFrom || dateTo) {
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
    }

    const baseWhere: any = { organizationId };
    if (Object.keys(dateFilter).length) baseWhere.date = dateFilter;

    const [
      byType,
      byStatus,
      costAgg,
      openCount,
    ] = await Promise.all([
      this.prisma.incident.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.incident.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.incident.aggregate({
        where: baseWhere,
        _sum: { cost: true },
      }),
      this.prisma.incident.count({
        where: { ...baseWhere, status: IncidentStatus.OPEN },
      }),
    ]);

    return {
      byType: byType.map((r) => ({ type: r.type, count: r._count._all })),
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      totalCost: costAgg._sum.cost ?? 0,
      openCount,
    };
  }
}
```

### 4.3 `incidents.controller.ts`

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import { IncidentsService } from './incidents.service';
import {
  AddAttachmentDto,
  CreateIncidentDto,
  IncidentFiltersDto,
  UpdateIncidentDto,
} from './incidents.dto';

@Controller('organizations/:organizationId/incidents')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  // GET /api/organizations/:orgId/incidents/stats
  // MUST be declared before /:id to avoid route conflict
  @Get('stats')
  stats(
    @Param('organizationId') organizationId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.stats(organizationId, dateFrom, dateTo);
  }

  // GET /api/organizations/:orgId/incidents
  @Get()
  list(
    @Param('organizationId') organizationId: string,
    @Query() filters: IncidentFiltersDto,
  ) {
    return this.service.list(organizationId, filters);
  }

  // POST /api/organizations/:orgId/incidents
  @Post()
  create(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.service.create(req.user.id, organizationId, dto);
  }

  // GET /api/organizations/:orgId/incidents/:id
  @Get(':id')
  findOne(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(organizationId, id);
  }

  // PATCH /api/organizations/:orgId/incidents/:id
  @Patch(':id')
  update(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.service.update(organizationId, id, dto);
  }

  // DELETE /api/organizations/:orgId/incidents/:id
  @Delete(':id')
  remove(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(organizationId, id);
  }

  // POST /api/organizations/:orgId/incidents/:id/attachments
  @Post(':id/attachments')
  addAttachment(
    @Param('organizationId') organizationId: string,
    @Param('id') incidentId: string,
    @Body() dto: AddAttachmentDto,
  ) {
    return this.service.addAttachment(organizationId, incidentId, dto);
  }

  // DELETE /api/organizations/:orgId/incidents/:id/attachments/:attachmentId
  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @Param('organizationId') organizationId: string,
    @Param('id') incidentId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.service.removeAttachment(organizationId, incidentId, attachmentId);
  }
}
```

### 4.4 `incidents.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
```

### 4.5 Registrar em `app.module.ts`

Adicionar ao array `imports` de `apps/api/src/app.module.ts`:
```typescript
import { IncidentsModule } from './incidents/incidents.module';
// ...
IncidentsModule,
```

### 4.6 Lógica de status — fluxo permitido

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
OPEN → RESOLVED (resolução direta permitida)
RESOLVED → CLOSED (fechamento após resolução)
```

Regra implementada no service: quando `dto.status === RESOLVED`, o campo `resolvedAt` é automaticamente preenchido com `new Date()`. Não há validação de transição obrigatória nesta fase — o frontend guiará o usuário com os botões corretos.

---

## 5. Frontend

### 5.1 API client — adicionar em `apps/web/lib/frontend/api-client.ts`

Adicionar após o bloco `vehiclesAPI` (ou no final do arquivo antes do export default):

```typescript
// ── INCIDENTS ────────────────────────────────────────────────────────────────

export interface Incident {
  id: string;
  organizationId: string;
  vehicleId: string | null;
  driverId: string | null;
  createdById: string;
  type: 'ACCIDENT' | 'THEFT' | 'FINE' | 'BREAKDOWN' | 'VANDALISM' | 'OTHER';
  title: string;
  description: string | null;
  date: string;
  location: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cost: number | null;
  insuranceClaim: boolean;
  claimNumber: string | null;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: IncidentAttachment[];
  vehicle?: { id: string; name: string | null; plate: string | null } | null;
}

export interface IncidentAttachment {
  id: string;
  incidentId: string;
  fileUrl: string;
  fileType: string;
  name: string;
  createdAt: string;
}

export interface IncidentStats {
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  totalCost: number;
  openCount: number;
}

export const incidentsAPI = {
  list: (
    orgId: string,
    params?: {
      type?: string;
      status?: string;
      severity?: string;
      vehicleId?: string;
      driverId?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    }
  ) => externalApi.get(`/api/organizations/${orgId}/incidents`, { params }),

  create: (orgId: string, data: Partial<Incident>) =>
    externalApi.post(`/api/organizations/${orgId}/incidents`, data),

  getOne: (orgId: string, id: string) =>
    externalApi.get(`/api/organizations/${orgId}/incidents/${id}`),

  update: (orgId: string, id: string, data: Partial<Incident>) =>
    externalApi.patch(`/api/organizations/${orgId}/incidents/${id}`, data),

  remove: (orgId: string, id: string) =>
    externalApi.delete(`/api/organizations/${orgId}/incidents/${id}`),

  addAttachment: (
    orgId: string,
    id: string,
    data: { fileUrl: string; fileType: string; name: string }
  ) =>
    externalApi.post(
      `/api/organizations/${orgId}/incidents/${id}/attachments`,
      data
    ),

  removeAttachment: (orgId: string, id: string, attachmentId: string) =>
    externalApi.delete(
      `/api/organizations/${orgId}/incidents/${id}/attachments/${attachmentId}`
    ),

  stats: (orgId: string, params?: { dateFrom?: string; dateTo?: string }) =>
    externalApi.get<IncidentStats>(
      `/api/organizations/${orgId}/incidents/stats`,
      { params }
    ),
};
```

### 5.2 Página de lista — `apps/web/app/dashboard/incidents/page.tsx`

**Estrutura visual:**
- Header com título "Ocorrências" + botão "Nova ocorrência"
- Cards de stats no topo:
  - Ocorrências abertas (count com ícone `AlertCircle`)
  - Custo total no período (valor monetário)
  - Breakdown por tipo (mini lista ou barra)
- Filtros em linha: tipo, status, severidade, intervalo de datas
- `DataTable` com colunas: título, tipo, veículo, data, status (badge colorido), gravidade (badge colorido), custo, ações

**Cores dos badges (usar `cn` e variantes de `Badge`):**

| Status | Classe Tailwind |
|---|---|
| OPEN | `bg-blue-100 text-blue-800` |
| IN_PROGRESS | `bg-yellow-100 text-yellow-800` |
| RESOLVED | `bg-green-100 text-green-800` |
| CLOSED | `bg-gray-100 text-gray-800` |

| Severity | Classe Tailwind |
|---|---|
| LOW | `bg-slate-100 text-slate-700` |
| MEDIUM | `bg-orange-100 text-orange-700` |
| HIGH | `bg-red-100 text-red-700` |
| CRITICAL | `bg-red-900 text-red-100` |

**Padrão de arquivo (seguir `apps/web/app/dashboard/vehicles/page.tsx`):**
```tsx
"use client";
import { useAuth } from "@/lib/hooks/use-auth";
import { incidentsAPI, type Incident } from "@/lib/frontend/api-client";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
// ... imports

export default function IncidentsPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  // estado local: incidents, loading, error, filters, stats
  // fetchIncidents via incidentsAPI.list(...)
  // fetchStats via incidentsAPI.stats(...)
  // ...
}
```

### 5.3 Página de criação — `apps/web/app/dashboard/incidents/new/page.tsx`

**Formulário com campos:**
- Tipo (select com ícone): ACCIDENT, THEFT, FINE, BREAKDOWN, VANDALISM, OTHER
- Título (input text, obrigatório)
- Descrição (textarea, opcional)
- Data (date picker, obrigatório)
- Localização (input text, opcional)
- Gravidade (select): LOW, MEDIUM, HIGH, CRITICAL
- Veículo (select dinâmico — busca via `vehiclesAPI.list(orgId)`)
- Motorista ID (input text opcional — placeholder para integração futura com módulo Drivers)
- Custo (input número, opcional)
- Sinistro de seguro (checkbox)
- Número do sinistro (input text, exibido se `insuranceClaim = true`)
- Observações (textarea, opcional)

**Comportamento:**
- Ao submeter: `incidentsAPI.create(orgId, dto)` → redirecionar para `/dashboard/incidents/[id]`
- Botão "Cancelar" → volta para lista `/dashboard/incidents`

### 5.4 Página de detalhe — `apps/web/app/dashboard/incidents/[id]/page.tsx`

**Layout:**
- Header: título da ocorrência + badge de status + badge de severidade + botão "Editar"
- Seção Info: tipo, data, veículo, motorista, local, custo, sinistro
- Seção Status Timeline:
  - Lista vertical de passos: OPEN → IN_PROGRESS → RESOLVED → CLOSED
  - Botão de ação para avançar status (ex: "Iniciar Atendimento", "Marcar como Resolvida", "Fechar")
  - Ao clicar: `incidentsAPI.update(orgId, id, { status: novoStatus })`
- Seção Anexos:
  - Lista de arquivos com ícone, nome, link para download
  - Formulário inline para adicionar novo anexo (campos: URL, tipo, nome)
  - Botão excluir em cada item
- Seção Observações (notas)

**Transições de status disponíveis por status atual:**

| Status atual | Ação disponível | Próximo status |
|---|---|---|
| OPEN | "Iniciar Atendimento" | IN_PROGRESS |
| OPEN | "Resolver" | RESOLVED |
| IN_PROGRESS | "Marcar como Resolvida" | RESOLVED |
| RESOLVED | "Fechar" | CLOSED |
| CLOSED | — | — |

### 5.5 Sidebar — `apps/web/components/navigation/app-sidebar.tsx`

Adicionar no array `items` da seção "Visão Geral" (ao lado de `vehicles` e `customers`):

```tsx
import { AlertCircle } from 'lucide-react';

// dentro de mainNavigation[0].items:
{
  name: t('navigation.items.incidents'),
  href: '/dashboard/incidents',
  icon: AlertCircle,
  current: pathname.startsWith('/dashboard/incidents'),
},
```

---

## 6. Internacionalização (i18n)

### 6.1 Adicionar ao `apps/web/i18n/locales/pt.json`

Adicionar dentro do objeto raiz, antes do fechamento `}` final:

```json
"incidents": {
  "title": "Ocorrências",
  "listDescription": "Registre e acompanhe acidentes, multas, furtos e avarias da frota.",
  "noIncidents": "Nenhuma ocorrência registrada.",
  "newIncident": "Nova Ocorrência",
  "editIncident": "Editar Ocorrência",
  "deleteIncident": "Excluir Ocorrência",
  "incidentNotFound": "Ocorrência não encontrada.",
  "backToIncidents": "← Voltar às ocorrências",
  "selectOrganization": "Selecione uma organização para ver as ocorrências.",
  "filterByType": "Filtrar por tipo...",
  "filterByStatus": "Filtrar por status...",
  "filterBySeverity": "Filtrar por gravidade...",
  "dateFrom": "Data inicial",
  "dateTo": "Data final",
  "openActionsMenu": "Abrir menu de ações",
  "stats": {
    "openIncidents": "Ocorrências Abertas",
    "totalCost": "Custo Total no Período",
    "byType": "Por Tipo"
  },
  "fields": {
    "type": "Tipo",
    "title": "Título",
    "description": "Descrição",
    "date": "Data",
    "location": "Local",
    "status": "Status",
    "severity": "Gravidade",
    "vehicle": "Veículo",
    "driver": "Motorista",
    "cost": "Custo",
    "insuranceClaim": "Sinistro de Seguro",
    "claimNumber": "Número do Sinistro",
    "notes": "Observações",
    "resolvedAt": "Resolvida em",
    "createdAt": "Criada em",
    "attachments": "Anexos"
  },
  "type": {
    "ACCIDENT": "Acidente",
    "THEFT": "Furto/Roubo",
    "FINE": "Multa",
    "BREAKDOWN": "Avaria",
    "VANDALISM": "Vandalismo",
    "OTHER": "Outro"
  },
  "status": {
    "OPEN": "Aberta",
    "IN_PROGRESS": "Em Andamento",
    "RESOLVED": "Resolvida",
    "CLOSED": "Fechada"
  },
  "severity": {
    "LOW": "Baixa",
    "MEDIUM": "Média",
    "HIGH": "Alta",
    "CRITICAL": "Crítica"
  },
  "statusActions": {
    "startProgress": "Iniciar Atendimento",
    "resolve": "Resolver",
    "markResolved": "Marcar como Resolvida",
    "close": "Fechar"
  },
  "timeline": {
    "title": "Linha do Tempo",
    "currentStatus": "Status Atual"
  },
  "attachments": {
    "add": "Adicionar Anexo",
    "fileUrl": "URL do Arquivo",
    "fileType": "Tipo do Arquivo",
    "fileName": "Nome do Arquivo",
    "noAttachments": "Nenhum anexo adicionado.",
    "download": "Baixar",
    "delete": "Excluir Anexo"
  },
  "form": {
    "titlePlaceholder": "Ex: Colisão traseira na Av. Paulista",
    "descriptionPlaceholder": "Descreva o que aconteceu...",
    "locationPlaceholder": "Ex: Av. Paulista, 1000 - São Paulo/SP",
    "costPlaceholder": "0,00",
    "claimNumberPlaceholder": "Ex: SIN-2024-001",
    "notesPlaceholder": "Observações adicionais...",
    "selectVehicle": "Selecionar veículo",
    "noVehicle": "Sem veículo",
    "selectType": "Selecionar tipo",
    "selectSeverity": "Selecionar gravidade"
  },
  "toast": {
    "created": "Ocorrência registrada com sucesso.",
    "updated": "Ocorrência atualizada com sucesso.",
    "deleted": "Ocorrência excluída.",
    "attachmentAdded": "Anexo adicionado.",
    "attachmentRemoved": "Anexo removido.",
    "statusUpdated": "Status atualizado para {{status}}.",
    "error": "Falha ao salvar ocorrência. Tente novamente."
  },
  "confirmDelete": {
    "title": "Excluir Ocorrência",
    "description": "Tem certeza que deseja excluir esta ocorrência? Esta ação não pode ser desfeita."
  }
}
```

### 6.2 Adicionar chave de navegação

Em `navigation.items`, adicionar:
```json
"incidents": "Ocorrências"
```

Em `pageTitle`, adicionar:
```json
"incidents": "Ocorrências"
```

---

## 7. RBAC — Placeholder PermissionGuard

O módulo RBAC ainda não está implementado (Wave 1). Enquanto isso, usar o padrão atual com `JwtAuthGuard + OrganizationMemberGuard`.

### 7.1 Preparação para RBAC futuro

Quando o módulo RBAC for implementado:

1. Importar `PermissionGuard` e o decorator `@Permission` no controller.
2. Adicionar nos endpoints:
   ```typescript
   // GET list, GET stats
   @Permission(Module.INCIDENTS, Action.VIEW)

   // POST create, POST attachments
   @Permission(Module.INCIDENTS, Action.CREATE)

   // PATCH update
   @Permission(Module.INCIDENTS, Action.EDIT)

   // DELETE remove, DELETE attachments
   @Permission(Module.INCIDENTS, Action.DELETE)
   ```
3. O enum `Module.INCIDENTS` já está definido em `ARCHITECTURE.md`.

### 7.2 Placeholder no controller (comentário)

Adicionar comentário no topo do controller:
```typescript
// TODO: When RBAC module is implemented, add:
// @UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
// and @Permission(Module.INCIDENTS, Action.VIEW/CREATE/EDIT/DELETE) per endpoint
```

---

## 8. Ordem de Implementação (Tasks Numeradas)

Execute as tasks nesta ordem exata para evitar erros de compilação e de migration.

### Task 1 — Schema Prisma
**Arquivo:** `apps/api/prisma/schema.prisma`
- [ ] Adicionar enums `IncidentType`, `IncidentStatus`, `IncidentSeverity`
- [ ] Adicionar model `Incident` com todos os campos e relações
- [ ] Adicionar model `IncidentAttachment`
- [ ] Adicionar relação inversa `incidents` no model `Vehicle`
- [ ] Adicionar relação inversa `createdIncidents` no model `OrganizationMember`

### Task 2 — Migration
```bash
cd apps/api
npx prisma migrate dev --name add_incidents_module
npx prisma generate
```
- [ ] Verificar que a migration gerou as tabelas `incidents` e `incident_attachments`
- [ ] Verificar que `prisma generate` completou sem erros

### Task 3 — DTO do backend
**Arquivo:** `apps/api/src/incidents/incidents.dto.ts` (criar novo)
- [ ] Criar `CreateIncidentDto`
- [ ] Criar `UpdateIncidentDto`
- [ ] Criar `AddAttachmentDto`
- [ ] Criar `IncidentFiltersDto`

### Task 4 — Service do backend
**Arquivo:** `apps/api/src/incidents/incidents.service.ts` (criar novo)
- [ ] Implementar `list()` com filtros
- [ ] Implementar `create()` com validação de vehicleId
- [ ] Implementar `findOne()` com 404 guard
- [ ] Implementar `update()` com lógica `resolvedAt`
- [ ] Implementar `remove()`
- [ ] Implementar `addAttachment()` e `removeAttachment()`
- [ ] Implementar `stats()` com groupBy

### Task 5 — Controller do backend
**Arquivo:** `apps/api/src/incidents/incidents.controller.ts` (criar novo)
- [ ] Definir todos os 8 endpoints (GET stats ANTES de GET :id)
- [ ] Aplicar `JwtAuthGuard` e `OrganizationMemberGuard`
- [ ] Adicionar comentário TODO RBAC

### Task 6 — Module do backend
**Arquivo:** `apps/api/src/incidents/incidents.module.ts` (criar novo)
- [ ] Importar `PrismaModule` e `AuthModule`
- [ ] Registrar controller e service

### Task 7 — Registrar no AppModule
**Arquivo:** `apps/api/src/app.module.ts`
- [ ] Importar `IncidentsModule`
- [ ] Adicionar ao array `imports`

### Task 8 — API client do frontend
**Arquivo:** `apps/web/lib/frontend/api-client.ts`
- [ ] Adicionar interfaces `Incident`, `IncidentAttachment`, `IncidentStats`
- [ ] Adicionar objeto `incidentsAPI` com todos os métodos

### Task 9 — Chaves i18n
**Arquivo:** `apps/web/i18n/locales/pt.json`
- [ ] Adicionar seção completa `incidents`
- [ ] Adicionar `navigation.items.incidents`
- [ ] Adicionar `pageTitle.incidents`

### Task 10 — Sidebar
**Arquivo:** `apps/web/components/navigation/app-sidebar.tsx`
- [ ] Importar ícone `AlertCircle` de `lucide-react`
- [ ] Adicionar item "Ocorrências" na seção "Visão Geral"

### Task 11 — Página de lista
**Arquivo:** `apps/web/app/dashboard/incidents/page.tsx` (criar novo)
- [ ] Cards de stats (abertos, custo total, por tipo)
- [ ] Filtros: tipo, status, severidade, data inicial, data final
- [ ] DataTable com colunas: título, tipo, veículo, data, status badge, severity badge, custo, ações
- [ ] Dialog/drawer de confirmação de delete

### Task 12 — Página de criação
**Arquivo:** `apps/web/app/dashboard/incidents/new/page.tsx` (criar novo)
- [ ] Formulário completo com todos os campos
- [ ] Select dinâmico de veículos
- [ ] Exibição condicional de `claimNumber` quando `insuranceClaim = true`
- [ ] Submit → create → redirect para detalhe

### Task 13 — Página de detalhe
**Arquivo:** `apps/web/app/dashboard/incidents/[id]/page.tsx` (criar novo)
- [ ] Seção de informações gerais
- [ ] Timeline de status com botões de transição
- [ ] Seção de anexos com formulário de adição e exclusão
- [ ] Seção de notas/observações

---

## 9. Testes de Verificação

### 9.1 Backend — API Tests (manual com curl ou Insomnia)

```bash
BASE="http://localhost:3001"
ORG_ID="<orgId>"
TOKEN="<jwt>"

# 1. Criar ocorrência
curl -X POST "$BASE/api/organizations/$ORG_ID/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"ACCIDENT","title":"Colisão teste","date":"2026-04-16","severity":"HIGH"}'
# Espera: 201 com id, status=OPEN, resolvedAt=null

# 2. Listar com filtro de status
curl "$BASE/api/organizations/$ORG_ID/incidents?status=OPEN" \
  -H "Authorization: Bearer $TOKEN"
# Espera: array com a ocorrência criada

# 3. Atualizar para RESOLVED
curl -X PATCH "$BASE/api/organizations/$ORG_ID/incidents/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"RESOLVED"}'
# Espera: resolvedAt != null

# 4. Stats
curl "$BASE/api/organizations/$ORG_ID/incidents/stats" \
  -H "Authorization: Bearer $TOKEN"
# Espera: byType, byStatus, totalCost, openCount

# 5. Adicionar anexo
curl -X POST "$BASE/api/organizations/$ORG_ID/incidents/<id>/attachments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileUrl":"https://example.com/file.pdf","fileType":"application/pdf","name":"Boletim de Ocorrência"}'
# Espera: attachment criado com id

# 6. Excluir ocorrência de outra org (deve retornar 404)
curl -X DELETE "$BASE/api/organizations/OUTRO_ORG_ID/incidents/<id>" \
  -H "Authorization: Bearer $TOKEN"
# Espera: 404 NotFoundException
```

### 9.2 Backend — Verificações de integridade

- [ ] `prisma.incident.findMany` filtra sempre por `organizationId` (sem cross-org leak)
- [ ] `resolvedAt` é preenchido automaticamente ao mudar status para `RESOLVED`
- [ ] `resolvedAt` NÃO é preenchido ao mudar para `CLOSED` (apenas quando `RESOLVED`)
- [ ] Criar ocorrência com `vehicleId` de outra org retorna 404
- [ ] Excluir incidente exclui em cascata os `IncidentAttachment` (via `onDelete: Cascade`)

### 9.3 Frontend — Checklist visual

- [ ] Sidebar exibe "Ocorrências" com ícone `AlertCircle`
- [ ] Página de lista renderiza sem erro quando não há ocorrências
- [ ] Badges de status usam cores corretas (azul=OPEN, amarelo=IN_PROGRESS, verde=RESOLVED, cinza=CLOSED)
- [ ] Badges de severity usam cores corretas (slate=LOW, laranja=MEDIUM, vermelho=HIGH, vermelho escuro=CRITICAL)
- [ ] Cards de stats mostram valores corretos
- [ ] Filtros funcionam independentemente
- [ ] Formulário de criação valida campos obrigatórios antes do submit
- [ ] Campo `claimNumber` só aparece quando `insuranceClaim` está marcado
- [ ] Página de detalhe exibe timeline de status corretamente
- [ ] Botão de transição de status não aparece quando status é CLOSED
- [ ] Adicionar/excluir anexo atualiza a lista sem reload da página

### 9.4 i18n

- [ ] Todas as chaves em `incidents.*` estão traduzidas em pt.json
- [ ] Nenhuma string hardcoded em inglês nos componentes React
- [ ] `navigation.items.incidents` retorna "Ocorrências"

---

## 10. Dependências e pré-requisitos

| Dependência | Status | Notas |
|---|---|---|
| `JwtAuthGuard` | Existente | `apps/api/src/auth/guards/jwt-auth.guard.ts` |
| `OrganizationMemberGuard` | Existente | `apps/api/src/organizations/guards/organization-member.guard.ts` |
| `PrismaModule` | Existente | Exporta `PrismaService` |
| `Vehicle` model | Existente | Adicionar relação `incidents` |
| `OrganizationMember` model | Existente | Adicionar relação `createdIncidents` |
| `DataTable` component | Existente | `apps/web/components/ui/data-table.tsx` |
| `Badge` component | Existente | `apps/web/components/ui/badge.tsx` |
| `useAuth` hook | Existente | Expõe `currentOrganization`, `user` |
| `useTranslation` hook | Existente | `apps/web/i18n/useTranslation.ts` |
| `incidentsAPI` | **A criar** | Task 8 |
| Módulo Drivers | **NÃO implementado** | `driverId` é String? livre por enquanto |
| RBAC / PermissionGuard | **NÃO implementado** | Placeholder comentado no controller |

---

## 11. Notas para o agente implementador

1. **Rota de stats antes de rota de :id** — a rota `GET /stats` deve ser declarada ANTES de `GET /:id` no controller, caso contrário o NestJS vai tentar resolver "stats" como um ID.

2. **`resolvedAt` no update** — só setar quando o status novo for exatamente `RESOLVED`. Não sobrescrever se o campo já existir (permitido deixar como está se já foi resolvida e mudou para CLOSED).

3. **`driverId` é String livre** — não há FK para Driver ainda. Não criar relação Prisma para Driver neste módulo; isso será feito quando o módulo Drivers for implementado.

4. **Sem soft delete** — para incidentes, o delete é físico. Os anexos são excluídos em cascata pelo banco via `onDelete: Cascade`.

5. **Uploads de arquivos** — apenas URL string nesta fase. Integração com S3/R2 é fase futura (conforme ARCHITECTURE.md).

6. **Filtro por `customerId`** — não é necessário nesta fase. O isolamento é por `organizationId`. Quando o módulo de escopo de customers for aplicado ao RBAC, ele poderá ser adicionado via join com Vehicle.

7. **`OrganizationMemberGuard`** — já valida que o usuário JWT é membro da `:organizationId` da rota. Não duplicar essa verificação no service.

8. **TypeScript estrito** — usar tipos Prisma importados de `@prisma/client` (ex: `IncidentType`, `IncidentStatus`, `IncidentSeverity`) em vez de strings literais.
