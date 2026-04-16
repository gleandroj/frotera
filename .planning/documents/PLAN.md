# PLAN.md — Módulo DOCUMENTS (Documentos de Veículos)

> Plano executável por agente Haiku.
> Leia `ARCHITECTURE.md` antes de qualquer implementação.
> Wave 2 — pré-requisito: módulo RBAC (Wave 1) concluído.

---

## 1. Objetivo

Implementar o cadastro e controle de documentos de veículos (CRLV, seguro, licenças, inspeção, outros) com:

- CRUD completo de documentos por organização/veículo
- Controle de datas de emissão e vencimento
- Campo calculado `daysUntilExpiry` retornado na listagem e no endpoint dedicado
- Endpoint `GET /expiring` para documentos vencendo nos próximos X dias (default 30)
- Badge de status no frontend: VÁLIDO (verde), VENCENDO (amarelo, <30 dias), VENCIDO (vermelho)
- Upload de arquivo via `fileUrl: string` (URL externa — integração com storage S3/R2 é fase futura)
- Placeholder para RBAC com módulo `DOCUMENTS`

---

## 2. Schema Prisma

### 2.1 Novos tipos a adicionar em `apps/api/prisma/schema.prisma`

```prisma
// ── Enum ──────────────────────────────────────────────
enum DocumentType {
  CRLV
  INSURANCE
  LICENSE
  INSPECTION
  OTHER
}

// ── Model ─────────────────────────────────────────────
model VehicleDocument {
  id             String       @id @default(cuid())
  organizationId String
  vehicleId      String
  createdById    String       // OrganizationMember.id
  type           DocumentType
  title          String
  fileUrl        String?      // URL externa (placeholder — upload S3/R2 futuro)
  issueDate      DateTime?
  expiryDate     DateTime?    // null = sem vencimento
  notes          String?
  active         Boolean      @default(true) // soft delete
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  vehicle      Vehicle            @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  createdBy    OrganizationMember @relation(fields: [createdById], references: [id])

  @@index([organizationId])
  @@index([vehicleId])
  @@index([expiryDate])
  @@map("vehicle_documents")
}
```

### 2.2 Relações a adicionar nos models existentes

Em `Vehicle`:
```prisma
  documents VehicleDocument[]
```

Em `Organization`:
```prisma
  documents VehicleDocument[]
```

Em `OrganizationMember`:
```prisma
  createdDocuments VehicleDocument[]
```

### 2.3 Migration

Após editar o schema, gerar a migration com:
```bash
cd apps/api
npx prisma migrate dev --name add_vehicle_documents
```

Nunca usar `db push` em produção.

---

## 3. Backend — `apps/api/src/documents/`

### 3.1 Estrutura de arquivos

```
apps/api/src/documents/
  documents.module.ts
  documents.controller.ts
  documents.service.ts
  documents.dto.ts
```

---

### 3.2 `documents.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DocumentType {
  CRLV       = 'CRLV',
  INSURANCE  = 'INSURANCE',
  LICENSE    = 'LICENSE',
  INSPECTION = 'INSPECTION',
  OTHER      = 'OTHER',
}

export enum DocumentStatus {
  VALID    = 'VALID',    // expiryDate null OU daysUntilExpiry >= 30
  EXPIRING = 'EXPIRING', // 0 <= daysUntilExpiry < 30
  EXPIRED  = 'EXPIRED',  // daysUntilExpiry < 0
}

export class CreateDocumentDto {
  @ApiProperty()
  @IsString()
  vehicleId: string;

  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  expiryDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListDocumentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  /** ISO date string — retorna docs com expiryDate <= este valor */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryBefore?: string;
}

export class ExpiringQueryDto {
  /** Número de dias à frente para considerar "vencendo". Default: 30 */
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;
}

export class DocumentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() vehicleId: string;
  @ApiProperty() createdById: string;
  @ApiProperty({ enum: DocumentType }) type: DocumentType;
  @ApiProperty() title: string;
  @ApiPropertyOptional() fileUrl?: string | null;
  @ApiPropertyOptional() issueDate?: string | null;
  @ApiPropertyOptional() expiryDate?: string | null;
  @ApiPropertyOptional() notes?: string | null;
  @ApiProperty({ enum: DocumentStatus }) status: DocumentStatus;
  /** Dias até o vencimento. Negativo = já vencido. Null quando sem expiryDate. */
  @ApiPropertyOptional({ type: Number, nullable: true }) daysUntilExpiry: number | null;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class DocumentsListResponseDto {
  @ApiProperty({ type: [DocumentResponseDto] })
  documents: DocumentResponseDto[];
}
```

---

### 3.3 `documents.service.ts`

**Responsabilidades:**
- Filtrar sempre por `organizationId` (nunca omitir)
- Calcular `daysUntilExpiry` e `status` em `toResponse()` (campo derivado, não gravado no BD)
- Respeitar `active: true` em todas as queries (soft delete)
- Verificar que o `vehicleId` pertence à organização antes de criar/atualizar
- Verificar escopo de customer do membro quando aplicável (delegar a `CustomersService.getAllowedCustomerIds`)

```typescript
// Pseudo-código detalhado

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  // ── Helpers ──────────────────────────────────────────

  /** Calcula dias até vencimento. Retorna null se sem expiryDate. */
  private calcDaysUntilExpiry(expiryDate: Date | null): number | null {
    if (!expiryDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    return Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calcStatus(days: number | null): DocumentStatus {
    if (days === null) return DocumentStatus.VALID;
    if (days < 0)  return DocumentStatus.EXPIRED;
    if (days < 30) return DocumentStatus.EXPIRING;
    return DocumentStatus.VALID;
  }

  private toResponse(doc: VehicleDocumentFromPrisma): DocumentResponseDto {
    const days = this.calcDaysUntilExpiry(doc.expiryDate);
    return {
      id:             doc.id,
      organizationId: doc.organizationId,
      vehicleId:      doc.vehicleId,
      createdById:    doc.createdById,
      type:           doc.type as DocumentType,
      title:          doc.title,
      fileUrl:        doc.fileUrl ?? null,
      issueDate:      doc.issueDate?.toISOString() ?? null,
      expiryDate:     doc.expiryDate?.toISOString() ?? null,
      notes:          doc.notes ?? null,
      status:         this.calcStatus(days),
      daysUntilExpiry: days,
      createdAt:      doc.createdAt.toISOString(),
      updatedAt:      doc.updatedAt.toISOString(),
    };
  }

  /** Verifica que o vehicle pertence à org (lança NotFoundException se não). */
  private async assertVehicleBelongsToOrg(
    vehicleId: string,
    organizationId: string,
  ): Promise<void> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException(ApiCode.VEHICLE_NOT_FOUND);
  }

  // ── CRUD ─────────────────────────────────────────────

  async list(
    organizationId: string,
    query: ListDocumentsQueryDto,
    // allowedCustomerIds: string[] | null  ← futuro: filtrar por customer
  ): Promise<DocumentsListResponseDto> {
    const where: Prisma.VehicleDocumentWhereInput = {
      organizationId,
      active: true,
      ...(query.vehicleId && { vehicleId: query.vehicleId }),
      ...(query.type && { type: query.type }),
      ...(query.expiryBefore && {
        expiryDate: { lte: new Date(query.expiryBefore) },
      }),
    };
    const rows = await this.prisma.vehicleDocument.findMany({
      where,
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
    });
    return { documents: rows.map((r) => this.toResponse(r)) };
  }

  async create(
    organizationId: string,
    createdById: string,  // OrganizationMember.id
    dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    await this.assertVehicleBelongsToOrg(dto.vehicleId, organizationId);
    const doc = await this.prisma.vehicleDocument.create({
      data: {
        organizationId,
        vehicleId:  dto.vehicleId,
        createdById,
        type:       dto.type,
        title:      dto.title,
        fileUrl:    dto.fileUrl ?? null,
        issueDate:  dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        notes:      dto.notes ?? null,
      },
    });
    return this.toResponse(doc);
  }

  async getById(
    id: string,
    organizationId: string,
  ): Promise<DocumentResponseDto> {
    const doc = await this.prisma.vehicleDocument.findFirst({
      where: { id, organizationId, active: true },
    });
    if (!doc) throw new NotFoundException(ApiCode.DOCUMENT_NOT_FOUND);
    return this.toResponse(doc);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const existing = await this.prisma.vehicleDocument.findFirst({
      where: { id, organizationId, active: true },
    });
    if (!existing) throw new NotFoundException(ApiCode.DOCUMENT_NOT_FOUND);
    const doc = await this.prisma.vehicleDocument.update({
      where: { id },
      data: {
        ...(dto.type      !== undefined && { type:      dto.type }),
        ...(dto.title     !== undefined && { title:     dto.title }),
        ...(dto.fileUrl   !== undefined && { fileUrl:   dto.fileUrl }),
        ...(dto.notes     !== undefined && { notes:     dto.notes }),
        ...(dto.issueDate !== undefined && {
          issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        }),
        ...(dto.expiryDate !== undefined && {
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        }),
      },
    });
    return this.toResponse(doc);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const existing = await this.prisma.vehicleDocument.findFirst({
      where: { id, organizationId, active: true },
    });
    if (!existing) throw new NotFoundException(ApiCode.DOCUMENT_NOT_FOUND);
    // Soft delete
    await this.prisma.vehicleDocument.update({
      where: { id },
      data: { active: false },
    });
  }

  async listExpiring(
    organizationId: string,
    days: number = 30,
  ): Promise<DocumentsListResponseDto> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const future = new Date(now);
    future.setDate(future.getDate() + days);

    // Docs com expiryDate entre hoje (inclusive) e hoje+days (inclusive)
    // OU já vencidos (expiryDate < hoje) — depende do requisito.
    // Decisão: retornar apenas os que vencem nos próximos `days` dias,
    // incluindo os já vencidos (daysUntilExpiry negativo).
    const rows = await this.prisma.vehicleDocument.findMany({
      where: {
        organizationId,
        active: true,
        expiryDate: {
          not: null,
          lte: future,  // vence até hoje+days
        },
      },
      orderBy: [{ expiryDate: 'asc' }],
    });
    return { documents: rows.map((r) => this.toResponse(r)) };
  }
}
```

**Nota sobre `ApiCode`:** Adicionar `DOCUMENT_NOT_FOUND` ao enum em `apps/api/src/common/api-codes.enum.ts`.

---

### 3.4 `documents.controller.ts`

```typescript
@ApiTags('documents')
@Controller('organizations/:organizationId/documents')
@UseGuards(JwtAuthGuard /*, PermissionGuard — placeholder RBAC */)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // GET /api/organizations/:orgId/documents
  // Query: vehicleId?, type?, expiryBefore?
  @Get()
  async list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListDocumentsQueryDto,
  ): Promise<DocumentsListResponseDto>

  // GET /api/organizations/:orgId/documents/expiring
  // Query: days? (default 30)
  // IMPORTANTE: esta rota deve ser declarada ANTES de /:id para evitar conflito
  @Get('expiring')
  async listExpiring(
    @Param('organizationId') organizationId: string,
    @Query() query: ExpiringQueryDto,
  ): Promise<DocumentsListResponseDto>

  // POST /api/organizations/:orgId/documents
  @Post()
  @HttpCode(201)
  async create(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto>
  // Requer: buscar OrganizationMember pelo userId + organizationId para obter createdById

  // GET /api/organizations/:orgId/documents/:id
  @Get(':id')
  async getOne(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<DocumentResponseDto>

  // PATCH /api/organizations/:orgId/documents/:id
  @Patch(':id')
  async update(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto>

  // DELETE /api/organizations/:orgId/documents/:id
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<void>
}
```

**Obtenção do `createdById` no POST:**
```typescript
// No método create() do controller:
const member = await this.prisma.organizationMember.findFirst({
  where: { userId: req.user.userId, organizationId },
  select: { id: true },
});
if (!member) throw new ForbiddenException();
return this.documentsService.create(organizationId, member.id, dto);
```
Alternativa mais limpa: injetar `PrismaService` no controller apenas para essa consulta, ou criar um método auxiliar no `DocumentsService` que recebe `userId` e resolve internamente.

---

### 3.5 `documents.module.ts`

```typescript
@Module({
  imports: [PrismaModule, CustomersModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
```

Registrar em `app.module.ts`:
```typescript
imports: [
  // ...módulos existentes...
  DocumentsModule,
],
```

---

### 3.6 Novo `ApiCode` a adicionar

Em `apps/api/src/common/api-codes.enum.ts`:
```typescript
DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
VEHICLE_NOT_FOUND  = 'VEHICLE_NOT_FOUND',  // se ainda não existir
```

---

### 3.7 Placeholder de RBAC

O `PermissionGuard` ainda não existe (Wave 1). No controller, adicionar comentário:
```typescript
// TODO(RBAC): @UseGuards(PermissionGuard)
// TODO(RBAC): @Permission(Module.DOCUMENTS, Action.VIEW)   ← nos GETs
// TODO(RBAC): @Permission(Module.DOCUMENTS, Action.CREATE) ← no POST
// TODO(RBAC): @Permission(Module.DOCUMENTS, Action.EDIT)   ← no PATCH
// TODO(RBAC): @Permission(Module.DOCUMENTS, Action.DELETE) ← no DELETE
```

---

## 4. Frontend

### 4.1 Estrutura de arquivos a criar

```
apps/web/
  lib/
    frontend/
      api-client.ts               ← adicionar documentsAPI (seção 4.2)
  app/
    dashboard/
      documents/
        page.tsx                  ← lista geral com abas (seção 4.3)
        components/
          document-form-dialog.tsx  ← modal criar/editar (seção 4.4)
          document-status-badge.tsx ← badge VÁLIDO/VENCENDO/VENCIDO (seção 4.5)
      vehicles/
        [id]/
          documents/
            page.tsx              ← docs de um veículo específico (seção 4.6)
```

---

### 4.2 API client — adicionar ao `apps/web/lib/frontend/api-client.ts`

```typescript
// ── Types ──────────────────────────────────────────────

export type DocumentType = 'CRLV' | 'INSURANCE' | 'LICENSE' | 'INSPECTION' | 'OTHER';
export type DocumentStatus = 'VALID' | 'EXPIRING' | 'EXPIRED';

export interface VehicleDocument {
  id: string;
  organizationId: string;
  vehicleId: string;
  createdById: string;
  type: DocumentType;
  title: string;
  fileUrl?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  status: DocumentStatus;
  daysUntilExpiry: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentPayload {
  vehicleId: string;
  type: DocumentType;
  title: string;
  fileUrl?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface UpdateDocumentPayload {
  type?: DocumentType;
  title?: string;
  fileUrl?: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  notes?: string;
}

// ── API object ─────────────────────────────────────────

export const documentsAPI = {
  list: (organizationId: string, params?: {
    vehicleId?: string;
    type?: DocumentType;
    expiryBefore?: string;
  }) =>
    apiClient.get<{ documents: VehicleDocument[] }>(
      `/api/organizations/${organizationId}/documents`,
      { params }
    ),

  listExpiring: (organizationId: string, days = 30) =>
    apiClient.get<{ documents: VehicleDocument[] }>(
      `/api/organizations/${organizationId}/documents/expiring`,
      { params: { days } }
    ),

  getOne: (organizationId: string, id: string) =>
    apiClient.get<VehicleDocument>(
      `/api/organizations/${organizationId}/documents/${id}`
    ),

  create: (organizationId: string, payload: CreateDocumentPayload) =>
    apiClient.post<VehicleDocument>(
      `/api/organizations/${organizationId}/documents`,
      payload
    ),

  update: (organizationId: string, id: string, payload: UpdateDocumentPayload) =>
    apiClient.patch<VehicleDocument>(
      `/api/organizations/${organizationId}/documents/${id}`,
      payload
    ),

  remove: (organizationId: string, id: string) =>
    apiClient.delete(
      `/api/organizations/${organizationId}/documents/${id}`
    ),
};
```

---

### 4.3 Página lista geral — `apps/web/app/dashboard/documents/page.tsx`

```
Título: "Documentos"
Tabs: "Todos" | "A vencer" | "Vencidos"

- Aba "Todos":     documentsAPI.list(orgId)
- Aba "A vencer":  documentsAPI.listExpiring(orgId, 30)  → filtra status EXPIRING
- Aba "Vencidos":  documentsAPI.list(orgId) → filtra status EXPIRED  (ou listExpiring com dias=0 não serve — usar list e filtrar client-side por status=EXPIRED)

Colunas DataTable:
  | Status (badge)  | Título | Tipo | Placa do Veículo | Vencimento | Dias restantes | Ações |

Ações por linha:
  - Editar (abre DocumentFormDialog)
  - Excluir (confirm dialog)
  - Ver arquivo (abre fileUrl em nova aba, se presente)

Botão no topo: "Novo Documento" → abre DocumentFormDialog (modo criar)
```

**Implementação:**
- Usar `useAuth()` para obter `currentOrganization.id`
- Usar `useState` para a aba ativa
- `useEffect` recarrega ao trocar de aba
- Mostrar `SkeletonTable` durante loading (seguir padrão existente em `components/ui/skeleton-table.tsx`)

---

### 4.4 `document-form-dialog.tsx`

**Props:**
```typescript
interface DocumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: VehicleDocument | null; // null = criar
  organizationId: string;
  defaultVehicleId?: string | null;  // pré-seleciona veículo
  onSuccess: () => void;
}
```

**Campos do formulário:**

| Campo | Tipo | Obrigatório |
|---|---|---|
| `vehicleId` | Combobox (busca placa/nome) | Sim |
| `type` | Select (CRLV / Seguro / Licença / Inspeção / Outro) | Sim |
| `title` | Input text | Sim |
| `issueDate` | Input date | Não |
| `expiryDate` | Input date | Não |
| `fileUrl` | Input text (URL) | Não |
| `notes` | Textarea | Não |

**Validação com Zod + Formik:**
```typescript
const schema = z.object({
  vehicleId: z.string().min(1, t('documents.vehicleRequired')),
  type:      z.enum(['CRLV', 'INSURANCE', 'LICENSE', 'INSPECTION', 'OTHER']),
  title:     z.string().min(1, t('documents.titleRequired')),
  issueDate:  z.string().optional(),
  expiryDate: z.string().optional(),
  fileUrl:    z.string().url(t('documents.fileUrlInvalid')).optional().or(z.literal('')),
  notes:      z.string().optional(),
});
```

**Comportamento:**
- Ao abrir em modo criar: busca lista de veículos da org para o combobox
- Ao salvar: chama `documentsAPI.create()` ou `documentsAPI.update()`
- Toast de sucesso/erro (usar `sonner`)
- Fechar dialog após sucesso e chamar `onSuccess()`

---

### 4.5 `document-status-badge.tsx`

```typescript
import { Badge } from '@/components/ui/badge';
import type { DocumentStatus } from '@/lib/frontend/api-client';

const CONFIG: Record<DocumentStatus, { label: string; variant: string; className: string }> = {
  VALID:    { label: 'Válido',    variant: 'default',     className: 'bg-green-100 text-green-800 border-green-200' },
  EXPIRING: { label: 'Vencendo', variant: 'secondary',   className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  EXPIRED:  { label: 'Vencido',  variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200' },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const cfg = CONFIG[status];
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
```

Os labels devem usar i18n:
```typescript
label: t(`documents.status.${status.toLowerCase()}`)
// VALID    → "Válido"
// EXPIRING → "Vencendo"
// EXPIRED  → "Vencido"
```

---

### 4.6 Documentos por veículo — `apps/web/app/dashboard/vehicles/[id]/documents/page.tsx`

- Sub-rota de `/dashboard/vehicles/[id]/`
- Renderiza igual à lista geral, mas com `vehicleId` fixo no filtro
- Botão "Novo Documento" pré-seleciona o veículo atual
- Link "← Voltar ao veículo" (`/dashboard/vehicles/[id]`)
- Adicionar aba "Documentos" na página de detalhe do veículo (se `vehicles/[id]/page.tsx` existir com tabs — seguir o padrão de `vehicles.tabs`)

---

### 4.7 Sidebar — adicionar item "Documentos"

Em `apps/web/components/navigation/app-sidebar.tsx`, dentro da seção `overview`:

```typescript
// Importar FileText de lucide-react
import { Building, Building2, Car, FileText, Home, User, Users } from 'lucide-react';

// Adicionar ao array items da seção overview:
{
  name: t('navigation.items.documents'),
  href: '/dashboard/documents',
  icon: FileText,
  current: pathname.startsWith('/dashboard/documents'),
},
```

---

### 4.8 Chaves i18n — adicionar em `apps/web/i18n/locales/pt.json`

Adicionar a seção `documents` (e a chave `navigation.items.documents`):

```json
"documents": {
  "title": "Documentos",
  "listDescription": "Documentos dos veículos da frota. Controle vencimentos de CRLV, seguros e licenças.",
  "noDocuments": "Nenhum documento cadastrado.",
  "filterByTitle": "Filtrar por título...",
  "noResults": "Nenhum resultado.",
  "createDocument": "Novo Documento",
  "editDocument": "Editar Documento",
  "deleteDocument": "Excluir Documento",
  "openActionsMenu": "Abrir menu de ações",
  "viewFile": "Ver arquivo",
  "vehicleRequired": "Selecione o veículo.",
  "titleRequired": "Informe o título do documento.",
  "fileUrlInvalid": "Informe uma URL válida.",
  "tabs": {
    "all": "Todos",
    "expiring": "A vencer",
    "expired": "Vencidos"
  },
  "type": {
    "CRLV": "CRLV",
    "INSURANCE": "Seguro",
    "LICENSE": "Licença",
    "INSPECTION": "Inspeção",
    "OTHER": "Outro"
  },
  "status": {
    "valid": "Válido",
    "expiring": "Vencendo",
    "expired": "Vencido"
  },
  "fields": {
    "vehicle": "Veículo",
    "type": "Tipo",
    "title": "Título",
    "issueDate": "Data de Emissão",
    "expiryDate": "Data de Vencimento",
    "fileUrl": "URL do Arquivo",
    "fileUrlPlaceholder": "https://...",
    "notes": "Observações",
    "notesPlaceholder": "Informações adicionais...",
    "daysUntilExpiry": "Dias para vencer",
    "status": "Status"
  },
  "selectVehicle": "Selecione o veículo",
  "filterVehicle": "Buscar veículo...",
  "daysUntilExpiry": "{{days}} dia(s)",
  "expired": "Vencido",
  "noExpiry": "Sem vencimento",
  "backToVehicle": "← Voltar ao veículo",
  "backToDocuments": "← Voltar aos documentos",
  "confirmDelete": {
    "title": "Excluir documento",
    "description": "Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita."
  },
  "toastCreated": "Documento criado com sucesso.",
  "toastUpdated": "Documento atualizado com sucesso.",
  "toastDeleted": "Documento excluído com sucesso.",
  "toastError": "Falha ao salvar documento. Tente novamente."
}
```

Também adicionar em `navigation.items`:
```json
"documents": "Documentos"
```

---

## 5. Dependência de RBAC

O módulo DOCUMENTS usa o módulo `DOCUMENTS` do enum `Module` definido em `ARCHITECTURE.md`.

Enquanto RBAC (Wave 1) não estiver implementado:
- Proteger todos os endpoints apenas com `JwtAuthGuard`
- Não verificar permissões granulares
- Adicionar comentários `// TODO(RBAC)` em cada endpoint (ver seção 3.4)

Quando RBAC estiver pronto, adicionar:
```typescript
// Controller
@UseGuards(JwtAuthGuard, PermissionGuard)

// Métodos
@Permission(Module.DOCUMENTS, Action.VIEW)    // GET list, GET expiring, GET :id
@Permission(Module.DOCUMENTS, Action.CREATE)  // POST
@Permission(Module.DOCUMENTS, Action.EDIT)    // PATCH
@Permission(Module.DOCUMENTS, Action.DELETE)  // DELETE
```

---

## 6. Ordem de implementação (tasks numeradas)

### Task 1 — Schema Prisma + Migration
1. Abrir `apps/api/prisma/schema.prisma`
2. Adicionar enum `DocumentType` (se não existir)
3. Adicionar model `VehicleDocument` conforme seção 2.1
4. Adicionar relações em `Vehicle`, `Organization`, `OrganizationMember` (seção 2.2)
5. Rodar `npx prisma migrate dev --name add_vehicle_documents`
6. Rodar `npx prisma generate`
7. Verificar: `npx prisma validate` deve passar sem erros

### Task 2 — ApiCode + DTO
1. Adicionar `DOCUMENT_NOT_FOUND` (e `VEHICLE_NOT_FOUND` se ausente) em `api-codes.enum.ts`
2. Criar `apps/api/src/documents/documents.dto.ts` conforme seção 3.2

### Task 3 — Service
1. Criar `apps/api/src/documents/documents.service.ts` conforme seção 3.3
2. Implementar todos os métodos: `list`, `create`, `getById`, `update`, `remove`, `listExpiring`
3. Verificar que `toResponse()` calcula corretamente `daysUntilExpiry` e `status`

### Task 4 — Controller
1. Criar `apps/api/src/documents/documents.controller.ts` conforme seção 3.4
2. Atenção: declarar rota `GET expiring` ANTES de `GET :id` para evitar conflito de rota
3. Implementar obtenção de `createdById` via `OrganizationMember` no método `create()`

### Task 5 — Module + App registration
1. Criar `apps/api/src/documents/documents.module.ts` conforme seção 3.5
2. Importar `DocumentsModule` em `apps/api/src/app.module.ts`
3. Garantir que `CustomersModule` exporta `CustomersService` (verificar `customers.module.ts`)

### Task 6 — Testes manuais da API
1. Subir o servidor: `cd apps/api && npm run start:dev`
2. Executar cenários de verificação (seção 7)
3. Corrigir eventuais erros de tipos/validação

### Task 7 — API client frontend
1. Adicionar types e `documentsAPI` ao `apps/web/lib/frontend/api-client.ts` conforme seção 4.2

### Task 8 — i18n
1. Adicionar seção `documents` em `apps/web/i18n/locales/pt.json` conforme seção 4.8
2. Adicionar chave `navigation.items.documents`

### Task 9 — DocumentStatusBadge
1. Criar `apps/web/app/dashboard/documents/components/document-status-badge.tsx` conforme seção 4.5

### Task 10 — DocumentFormDialog
1. Criar `apps/web/app/dashboard/documents/components/document-form-dialog.tsx` conforme seção 4.4
2. Testar criação e edição com dados reais

### Task 11 — Página lista geral
1. Criar `apps/web/app/dashboard/documents/page.tsx` conforme seção 4.3
2. Implementar 3 abas: Todos / A vencer / Vencidos
3. Implementar DataTable com colunas e ações

### Task 12 — Sub-rota veículo
1. Criar `apps/web/app/dashboard/vehicles/[id]/documents/page.tsx` conforme seção 4.6
2. Verificar rota pai `apps/web/app/dashboard/vehicles/[id]/` e adicionar link/aba "Documentos"

### Task 13 — Sidebar
1. Editar `apps/web/components/navigation/app-sidebar.tsx`
2. Importar `FileText` do lucide-react
3. Adicionar item "Documentos" na seção overview conforme seção 4.7

### Task 14 — Revisão final
1. Testar fluxo completo: criar documento → ver badge → filtrar por aba → editar → excluir
2. Verificar que soft delete funciona (item desaparece da lista mas permanece no BD com `active: false`)
3. Verificar que `daysUntilExpiry` está correto para datas passadas (negativo), hoje (0) e futuras

---

## 7. Testes de verificação

### 7.1 Testes da API (curl ou Postman)

```bash
BASE="http://localhost:3001/api"
ORG_ID="<org_id>"
TOKEN="<jwt_token>"

# Criar documento
curl -X POST "$BASE/organizations/$ORG_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "<vehicle_id>",
    "type": "CRLV",
    "title": "CRLV 2025",
    "expiryDate": "2025-12-31"
  }'
# Esperado: 201 com DocumentResponseDto, status=VALID, daysUntilExpiry>=0

# Criar documento vencido
curl -X POST "$BASE/organizations/$ORG_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "<vehicle_id>",
    "type": "INSURANCE",
    "title": "Seguro expirado",
    "expiryDate": "2024-01-01"
  }'
# Esperado: status=EXPIRED, daysUntilExpiry<0

# Criar documento vencendo em breve
curl -X POST "$BASE/organizations/$ORG_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "<vehicle_id>",
    "type": "LICENSE",
    "title": "Licença vencendo",
    "expiryDate": "<data_em_15_dias>"
  }'
# Esperado: status=EXPIRING, 0 <= daysUntilExpiry < 30

# Listar todos
curl "$BASE/organizations/$ORG_ID/documents" \
  -H "Authorization: Bearer $TOKEN"
# Esperado: array com os 3 documentos criados

# Listar por vehicleId
curl "$BASE/organizations/$ORG_ID/documents?vehicleId=<vehicle_id>" \
  -H "Authorization: Bearer $TOKEN"

# Listar vencendo (próximos 30 dias)
curl "$BASE/organizations/$ORG_ID/documents/expiring" \
  -H "Authorization: Bearer $TOKEN"
# Esperado: documentos com expiryDate <= hoje+30, incluindo os vencidos

# Listar vencendo (próximos 7 dias)
curl "$BASE/organizations/$ORG_ID/documents/expiring?days=7" \
  -H "Authorization: Bearer $TOKEN"

# Atualizar documento
curl -X PATCH "$BASE/organizations/$ORG_ID/documents/<doc_id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "CRLV 2025 Atualizado", "fileUrl": "https://example.com/crlv.pdf"}'
# Esperado: 200 com documento atualizado

# Excluir documento (soft delete)
curl -X DELETE "$BASE/organizations/$ORG_ID/documents/<doc_id>" \
  -H "Authorization: Bearer $TOKEN"
# Esperado: 204 No Content

# Verificar que doc excluído não aparece na lista
curl "$BASE/organizations/$ORG_ID/documents" \
  -H "Authorization: Bearer $TOKEN"
# Esperado: doc deletado não aparece

# Tentar acessar doc de outra organização (cross-org)
curl "$BASE/organizations/<outro_org_id>/documents/<doc_id>" \
  -H "Authorization: Bearer $TOKEN"
# Esperado: 404 Not Found
```

### 7.2 Testes de negócio

| Cenário | Entrada | Esperado |
|---|---|---|
| `expiryDate` nulo | Sem expiryDate | `status=VALID`, `daysUntilExpiry=null` |
| Vencimento hoje | `expiryDate = hoje` | `daysUntilExpiry=0`, `status=EXPIRING` |
| Vencendo em 29 dias | `expiryDate = hoje+29` | `status=EXPIRING` |
| Vencendo em 30 dias | `expiryDate = hoje+30` | `status=VALID` |
| Já vencido | `expiryDate = ontem` | `status=EXPIRED`, `daysUntilExpiry=-1` |
| vehicleId inválido no POST | vehicleId de outra org | 404 NotFoundException |
| Cross-org access | `organizationId` errado na URL | 404 Not Found |

### 7.3 Verificações do frontend

- [ ] Badge verde aparece para documentos VALID
- [ ] Badge amarelo aparece para documentos EXPIRING (< 30 dias)
- [ ] Badge vermelho aparece para documentos EXPIRED
- [ ] Aba "A vencer" mostra apenas documentos com `status=EXPIRING`
- [ ] Aba "Vencidos" mostra apenas documentos com `status=EXPIRED`
- [ ] "Novo Documento" abre o dialog com campos vazios
- [ ] Editar preenche o formulário com dados existentes
- [ ] Excluir remove o item da lista após confirmação
- [ ] Sub-rota `/dashboard/vehicles/[id]/documents` mostra apenas docs do veículo
- [ ] Item "Documentos" aparece no sidebar e fica ativo quando na rota `/dashboard/documents`

---

## 8. Notas e restrições para o agente implementador

1. **Sempre filtrar por `organizationId`** — nenhuma query pode omitir esse filtro.
2. **Soft delete** — usar `active: false` ao excluir; todas as queries incluem `active: true`.
3. **`daysUntilExpiry` é campo calculado** — nunca gravar no banco; calcular sempre em runtime.
4. **Rota `GET /expiring` deve ser declarada antes de `GET /:id`** no controller NestJS para evitar que "expiring" seja interpretado como um `:id`.
5. **Upload de arquivo** — aceitar apenas `fileUrl: string`. Não implementar multipart/form-data nem integração com storage agora.
6. **Migrations** — usar `prisma migrate dev`, nunca `db push` em produção.
7. **Cross-org** — ao criar, verificar que o `vehicleId` pertence ao `organizationId` da URL.
8. **Sem `createdById` no DTO de criação** — resolver internamente via JWT userId → OrganizationMember.id.
9. **i18n** — todas as strings visíveis no frontend devem usar `t()` com chaves da seção `documents`.
10. **Ordenação padrão** — listar documentos por `expiryDate ASC NULLS LAST, createdAt DESC`.
