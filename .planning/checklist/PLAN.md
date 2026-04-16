# PLAN — Módulo CHECKLIST (Checklists Dinâmicos)

> Agente executor alvo: **Claude Haiku**
> Wave de implementação: **Wave 3 (Operação)** — requer RBAC implementado (Wave 1)
> Data do plano: 2026-04-16

---

## 1. Objetivo

Implementar um sistema de checklists dinâmicos para gestão de frotas:

- **Admins** criam templates de checklist com itens configuráveis (tipo, obrigatoriedade, ordem).
- **Operadores/Motoristas** preenchem checklists antes/após uso de veículos.
- **Relatórios** de conformidade por veículo, motorista, período e status.

Fluxo principal:
```
Admin cria Template → define itens (perguntas) com tipo e obrigatoriedade
Operador seleciona Template + Veículo → preenche respostas → submete Entry
Gestor visualiza Entries com filtros → verifica conformidade
```

---

## 2. Schema Prisma

### 2.1 Enums novos

Adicionar no final de `apps/api/prisma/schema.prisma`, antes dos modelos existentes de enum (após `InvitationStatus`):

```prisma
enum ItemType {
  YES_NO
  TEXT
  NUMBER
  PHOTO
  SELECT
  SIGNATURE

  @@map("ItemType")
}

enum EntryStatus {
  PENDING
  COMPLETED
  INCOMPLETE

  @@map("EntryStatus")
}
```

### 2.2 Modelos novos

Adicionar ao final de `apps/api/prisma/schema.prisma`:

```prisma
model ChecklistTemplate {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  description    String?
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization           @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  items        ChecklistTemplateItem[]
  entries      ChecklistEntry[]

  @@index([organizationId])
  @@map("checklist_templates")
}

model ChecklistTemplateItem {
  id         String   @id @default(cuid())
  templateId String
  order      Int
  label      String       // Pergunta/descrição do item
  type       ItemType
  required   Boolean  @default(true)
  options    String[] // Usado apenas quando type = SELECT
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  template ChecklistTemplate  @relation(fields: [templateId], references: [id], onDelete: Cascade)
  answers  ChecklistAnswer[]

  @@index([templateId])
  @@map("checklist_template_items")
}

model ChecklistEntry {
  id             String      @id @default(cuid())
  organizationId String
  templateId     String
  vehicleId      String
  driverId       String?     // ID do motorista (futuro módulo DRIVERS); opcional por enquanto
  memberId       String      // OrganizationMember.id — quem preencheu
  status         EntryStatus @default(PENDING)
  completedAt    DateTime?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  organization Organization           @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  template     ChecklistTemplate      @relation(fields: [templateId], references: [id])
  vehicle      Vehicle                @relation(fields: [vehicleId], references: [id])
  member       OrganizationMember     @relation(fields: [memberId], references: [id])
  answers      ChecklistAnswer[]

  @@index([organizationId])
  @@index([templateId])
  @@index([vehicleId])
  @@index([memberId])
  @@index([status])
  @@map("checklist_entries")
}

model ChecklistAnswer {
  id        String   @id @default(cuid())
  entryId   String
  itemId    String
  value     String?  // Resposta serializada (texto, "true"/"false", número como string, URL de foto)
  photoUrl  String?  // Campo dedicado para tipo PHOTO (URL; upload para storage é fase futura)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  entry ChecklistEntry        @relation(fields: [entryId], references: [id], onDelete: Cascade)
  item  ChecklistTemplateItem @relation(fields: [itemId], references: [id])

  @@unique([entryId, itemId])
  @@index([entryId])
  @@index([itemId])
  @@map("checklist_answers")
}
```

### 2.3 Relações inversas a adicionar nos modelos existentes

No modelo `Organization` (após `customers Customer[]`):
```prisma
  checklistTemplates ChecklistTemplate[]
  checklistEntries   ChecklistEntry[]
```

No modelo `Vehicle` (após `customer Customer?`):
```prisma
  checklistEntries ChecklistEntry[]
```

No modelo `OrganizationMember` (após `customers OrganizationMemberCustomer[]`):
```prisma
  checklistEntries ChecklistEntry[]
```

### 2.4 Migration

Após editar o schema, gerar a migration:
```bash
cd apps/api
npx prisma migrate dev --name add_checklist_module
```

---

## 3. Backend — `apps/api/src/checklist/`

### 3.1 Arquivos a criar

```
apps/api/src/checklist/
  checklist.module.ts
  checklist.controller.ts
  checklist.service.ts
  checklist.dto.ts
```

### 3.2 `checklist.dto.ts` — DTOs completos

```typescript
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ItemType, EntryStatus } from "@prisma/client";

// ─── Template DTOs ────────────────────────────────────────────────────────────

export class ChecklistTemplateItemDto {
  @ApiProperty({ description: "Texto da pergunta/item" })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ enum: ItemType })
  @IsEnum(ItemType)
  type: ItemType;

  @ApiProperty({ default: true })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({ type: [String], description: "Opções para tipo SELECT" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiProperty({ description: "Ordem de exibição do item (inteiro positivo)" })
  @IsNumber()
  order: number;
}

export class CreateChecklistTemplateDto {
  @ApiProperty({ example: "Checklist Pré-Viagem" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ type: [ChecklistTemplateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistTemplateItemDto)
  items: ChecklistTemplateItemDto[];
}

export class UpdateChecklistTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: [ChecklistTemplateItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistTemplateItemDto)
  items?: ChecklistTemplateItemDto[];
}

export class ChecklistTemplateItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() templateId: string;
  @ApiProperty() label: string;
  @ApiProperty({ enum: ItemType }) type: ItemType;
  @ApiProperty() required: boolean;
  @ApiProperty({ type: [String] }) options: string[];
  @ApiProperty() order: number;
}

export class ChecklistTemplateResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiProperty() active: boolean;
  @ApiProperty({ type: [ChecklistTemplateItemResponseDto] }) items: ChecklistTemplateItemResponseDto[];
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

// ─── Entry DTOs ───────────────────────────────────────────────────────────────

export class ChecklistAnswerInputDto {
  @ApiProperty({ description: "ID do ChecklistTemplateItem" })
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiPropertyOptional({ description: "Valor serializado da resposta" })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ description: "URL da foto (para tipo PHOTO)" })
  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class CreateChecklistEntryDto {
  @ApiProperty({ description: "ID do ChecklistTemplate" })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: "ID do Vehicle" })
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @ApiPropertyOptional({ description: "ID do motorista (futuro módulo DRIVERS)" })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiProperty({ type: [ChecklistAnswerInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistAnswerInputDto)
  answers: ChecklistAnswerInputDto[];
}

export class UpdateChecklistEntryStatusDto {
  @ApiProperty({ enum: EntryStatus })
  @IsEnum(EntryStatus)
  status: EntryStatus;
}

export class ChecklistEntryFilterDto {
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() driverId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() memberId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() templateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(EntryStatus) status?: EntryStatus;
  @ApiPropertyOptional({ description: "ISO date string" }) @IsOptional() @IsString() dateFrom?: string;
  @ApiPropertyOptional({ description: "ISO date string" }) @IsOptional() @IsString() dateTo?: string;
}

export class ChecklistAnswerResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() entryId: string;
  @ApiProperty() itemId: string;
  @ApiPropertyOptional() value?: string | null;
  @ApiPropertyOptional() photoUrl?: string | null;
}

export class ChecklistEntryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() templateId: string;
  @ApiProperty() vehicleId: string;
  @ApiPropertyOptional() driverId?: string | null;
  @ApiProperty() memberId: string;
  @ApiProperty({ enum: EntryStatus }) status: EntryStatus;
  @ApiPropertyOptional() completedAt?: string | null;
  @ApiProperty({ type: [ChecklistAnswerResponseDto] }) answers: ChecklistAnswerResponseDto[];
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}
```

### 3.3 `checklist.service.ts` — Lógica de negócio

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { ApiCode } from "@/common/api-codes.enum";
import {
  CreateChecklistTemplateDto,
  UpdateChecklistTemplateDto,
  CreateChecklistEntryDto,
  UpdateChecklistEntryStatusDto,
  ChecklistEntryFilterDto,
  ChecklistTemplateResponseDto,
  ChecklistEntryResponseDto,
} from "./checklist.dto";

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Templates ──────────────────────────────────────────────────────────────

  async listTemplates(organizationId: string): Promise<ChecklistTemplateResponseDto[]> {
    const templates = await this.prisma.checklistTemplate.findMany({
      where: { organizationId },
      include: { items: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return templates.map(this.toTemplateResponse);
  }

  async createTemplate(
    organizationId: string,
    dto: CreateChecklistTemplateDto,
  ): Promise<ChecklistTemplateResponseDto> {
    const template = await this.prisma.checklistTemplate.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        active: dto.active ?? true,
        items: {
          create: dto.items.map((item) => ({
            label: item.label,
            type: item.type,
            required: item.required,
            options: item.options ?? [],
            order: item.order,
          })),
        },
      },
      include: { items: { orderBy: { order: "asc" } } },
    });
    return this.toTemplateResponse(template);
  }

  async getTemplate(
    templateId: string,
    organizationId: string,
  ): Promise<ChecklistTemplateResponseDto> {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId },
      include: { items: { orderBy: { order: "asc" } } },
    });
    if (!template) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);
    return this.toTemplateResponse(template);
  }

  async updateTemplate(
    templateId: string,
    organizationId: string,
    dto: UpdateChecklistTemplateDto,
  ): Promise<ChecklistTemplateResponseDto> {
    const existing = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId },
    });
    if (!existing) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);

    const template = await this.prisma.checklistTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.items !== undefined && {
          items: {
            // Estratégia: delete all + recreate (templates não têm histórico de itens individuais)
            deleteMany: {},
            create: dto.items.map((item) => ({
              label: item.label,
              type: item.type,
              required: item.required,
              options: item.options ?? [],
              order: item.order,
            })),
          },
        }),
      },
      include: { items: { orderBy: { order: "asc" } } },
    });
    return this.toTemplateResponse(template);
  }

  async deleteTemplate(templateId: string, organizationId: string): Promise<void> {
    const existing = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId },
      include: { entries: { take: 1 } },
    });
    if (!existing) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);

    // Soft delete: apenas desativar se houver entries vinculadas
    if (existing.entries.length > 0) {
      await this.prisma.checklistTemplate.update({
        where: { id: templateId },
        data: { active: false },
      });
    } else {
      await this.prisma.checklistTemplate.delete({ where: { id: templateId } });
    }
  }

  // ─── Entries ────────────────────────────────────────────────────────────────

  async listEntries(
    organizationId: string,
    filters: ChecklistEntryFilterDto,
  ): Promise<ChecklistEntryResponseDto[]> {
    const where: Record<string, unknown> = { organizationId };
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.driverId) where.driverId = filters.driverId;
    if (filters.memberId) where.memberId = filters.memberId;
    if (filters.templateId) where.templateId = filters.templateId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
      };
    }

    const entries = await this.prisma.checklistEntry.findMany({
      where,
      include: { answers: true },
      orderBy: { createdAt: "desc" },
    });
    return entries.map(this.toEntryResponse);
  }

  async createEntry(
    organizationId: string,
    memberId: string,
    dto: CreateChecklistEntryDto,
  ): Promise<ChecklistEntryResponseDto> {
    // 1. Validar template pertence à org e está ativo
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: dto.templateId, organizationId, active: true },
      include: { items: true },
    });
    if (!template) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);

    // 2. Validar veículo pertence à org
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, organizationId },
    });
    if (!vehicle) throw new NotFoundException(ApiCode.CHECKLIST_VEHICLE_NOT_FOUND);

    // 3. Validar itens required respondidos
    const answeredItemIds = new Set(dto.answers.map((a) => a.itemId));
    const requiredItems = template.items.filter((i) => i.required);
    const missingRequired = requiredItems.filter((i) => !answeredItemIds.has(i.id));
    if (missingRequired.length > 0) {
      throw new BadRequestException(ApiCode.CHECKLIST_REQUIRED_ITEMS_MISSING);
    }

    // 4. Validar que todos os itemIds das respostas existem no template
    const templateItemIds = new Set(template.items.map((i) => i.id));
    const invalidItems = dto.answers.filter((a) => !templateItemIds.has(a.itemId));
    if (invalidItems.length > 0) {
      throw new BadRequestException(ApiCode.CHECKLIST_INVALID_ITEM_ID);
    }

    // 5. Determinar status: COMPLETED se todos required respondidos, senão INCOMPLETE
    const allItemsAnswered = template.items.every((i) => answeredItemIds.has(i.id));
    const status = allItemsAnswered ? "COMPLETED" : "INCOMPLETE";

    const entry = await this.prisma.checklistEntry.create({
      data: {
        organizationId,
        templateId: dto.templateId,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId ?? null,
        memberId,
        status,
        completedAt: status === "COMPLETED" ? new Date() : null,
        answers: {
          create: dto.answers.map((a) => ({
            itemId: a.itemId,
            value: a.value ?? null,
            photoUrl: a.photoUrl ?? null,
          })),
        },
      },
      include: { answers: true },
    });
    return this.toEntryResponse(entry);
  }

  async getEntry(entryId: string, organizationId: string): Promise<ChecklistEntryResponseDto> {
    const entry = await this.prisma.checklistEntry.findFirst({
      where: { id: entryId, organizationId },
      include: { answers: true },
    });
    if (!entry) throw new NotFoundException(ApiCode.CHECKLIST_ENTRY_NOT_FOUND);
    return this.toEntryResponse(entry);
  }

  async updateEntryStatus(
    entryId: string,
    organizationId: string,
    dto: UpdateChecklistEntryStatusDto,
  ): Promise<ChecklistEntryResponseDto> {
    const existing = await this.prisma.checklistEntry.findFirst({
      where: { id: entryId, organizationId },
      include: { answers: true },
    });
    if (!existing) throw new NotFoundException(ApiCode.CHECKLIST_ENTRY_NOT_FOUND);

    const entry = await this.prisma.checklistEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        completedAt: dto.status === "COMPLETED" ? new Date() : existing.completedAt,
      },
      include: { answers: true },
    });
    return this.toEntryResponse(entry);
  }

  // ─── Mappers ─────────────────────────────────────────────────────────────────

  private toTemplateResponse(t: any): ChecklistTemplateResponseDto {
    return {
      id: t.id,
      organizationId: t.organizationId,
      name: t.name,
      description: t.description,
      active: t.active,
      items: (t.items ?? []).map((i: any) => ({
        id: i.id,
        templateId: i.templateId,
        label: i.label,
        type: i.type,
        required: i.required,
        options: i.options ?? [],
        order: i.order,
      })),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private toEntryResponse(e: any): ChecklistEntryResponseDto {
    return {
      id: e.id,
      organizationId: e.organizationId,
      templateId: e.templateId,
      vehicleId: e.vehicleId,
      driverId: e.driverId,
      memberId: e.memberId,
      status: e.status,
      completedAt: e.completedAt?.toISOString() ?? null,
      answers: (e.answers ?? []).map((a: any) => ({
        id: a.id,
        entryId: a.entryId,
        itemId: a.itemId,
        value: a.value,
        photoUrl: a.photoUrl,
      })),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }
}
```

### 3.4 `checklist.controller.ts` — Endpoints

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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request as ExpressRequest } from "express";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { OrganizationMemberGuard } from "@/organizations/guards/organization-member.guard";
import { ChecklistService } from "./checklist.service";
import {
  CreateChecklistTemplateDto,
  UpdateChecklistTemplateDto,
  CreateChecklistEntryDto,
  UpdateChecklistEntryStatusDto,
  ChecklistEntryFilterDto,
} from "./checklist.dto";
import { ForbiddenException } from "@nestjs/common";
import { ApiCode } from "@/common/api-codes.enum";

interface RequestWithMember extends ExpressRequest {
  user: { userId: string };
  organizationMember: { id: string; organizationId: string; role: string };
}

@ApiTags("checklist")
@Controller("organizations/:organizationId/checklist")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@ApiBearerAuth()
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  private requireAdminOrOwner(member: { role: string }) {
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
  }

  // ─── Templates ──────────────────────────────────────────────────────────────

  @Get("templates")
  @ApiOperation({ summary: "Listar templates de checklist da organização" })
  async listTemplates(@Param("organizationId") organizationId: string) {
    return this.checklistService.listTemplates(organizationId);
  }

  @Post("templates")
  @ApiOperation({ summary: "Criar template de checklist (admin)" })
  async createTemplate(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateChecklistTemplateDto,
    @Request() req: RequestWithMember,
  ) {
    // PLACEHOLDER: substituir por PermissionGuard(CHECKLIST, CREATE) quando RBAC implementado
    this.requireAdminOrOwner(req.organizationMember);
    return this.checklistService.createTemplate(organizationId, body);
  }

  @Get("templates/:templateId")
  @ApiOperation({ summary: "Buscar template por ID" })
  async getTemplate(
    @Param("organizationId") organizationId: string,
    @Param("templateId") templateId: string,
  ) {
    return this.checklistService.getTemplate(templateId, organizationId);
  }

  @Patch("templates/:templateId")
  @ApiOperation({ summary: "Atualizar template (admin)" })
  async updateTemplate(
    @Param("organizationId") organizationId: string,
    @Param("templateId") templateId: string,
    @Body() body: UpdateChecklistTemplateDto,
    @Request() req: RequestWithMember,
  ) {
    // PLACEHOLDER: substituir por PermissionGuard(CHECKLIST, EDIT)
    this.requireAdminOrOwner(req.organizationMember);
    return this.checklistService.updateTemplate(templateId, organizationId, body);
  }

  @Delete("templates/:templateId")
  @ApiOperation({ summary: "Excluir/desativar template (admin)" })
  async deleteTemplate(
    @Param("organizationId") organizationId: string,
    @Param("templateId") templateId: string,
    @Request() req: RequestWithMember,
  ) {
    // PLACEHOLDER: substituir por PermissionGuard(CHECKLIST, DELETE)
    this.requireAdminOrOwner(req.organizationMember);
    return this.checklistService.deleteTemplate(templateId, organizationId);
  }

  // ─── Entries ────────────────────────────────────────────────────────────────

  @Get("entries")
  @ApiOperation({ summary: "Listar entradas de checklist com filtros" })
  async listEntries(
    @Param("organizationId") organizationId: string,
    @Query() filters: ChecklistEntryFilterDto,
  ) {
    return this.checklistService.listEntries(organizationId, filters);
  }

  @Post("entries")
  @ApiOperation({ summary: "Criar e submeter checklist preenchido" })
  async createEntry(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateChecklistEntryDto,
    @Request() req: RequestWithMember,
  ) {
    // Qualquer membro pode criar entries (PLACEHOLDER: CHECKLIST:CREATE)
    return this.checklistService.createEntry(
      organizationId,
      req.organizationMember.id,
      body,
    );
  }

  @Get("entries/:entryId")
  @ApiOperation({ summary: "Buscar entrada de checklist por ID" })
  async getEntry(
    @Param("organizationId") organizationId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.checklistService.getEntry(entryId, organizationId);
  }

  @Patch("entries/:entryId")
  @ApiOperation({ summary: "Atualizar status da entrada" })
  async updateEntryStatus(
    @Param("organizationId") organizationId: string,
    @Param("entryId") entryId: string,
    @Body() body: UpdateChecklistEntryStatusDto,
    @Request() req: RequestWithMember,
  ) {
    this.requireAdminOrOwner(req.organizationMember);
    return this.checklistService.updateEntryStatus(entryId, organizationId, body);
  }
}
```

### 3.5 `checklist.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { PrismaModule } from "@/prisma/prisma.module";
import { forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChecklistController } from "./checklist.controller";
import { ChecklistService } from "./checklist.service";

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [ChecklistController],
  providers: [ChecklistService],
  exports: [ChecklistService],
})
export class ChecklistModule {}
```

### 3.6 Registrar no `app.module.ts`

Adicionar no array `imports` de `AppModule`:
```typescript
import { ChecklistModule } from "./checklist/checklist.module";
// ...
ChecklistModule,
```

### 3.7 Adicionar códigos de API em `api-codes.enum.ts`

```typescript
// Checklist
CHECKLIST_TEMPLATE_NOT_FOUND = "CHECKLIST_TEMPLATE_NOT_FOUND",
CHECKLIST_ENTRY_NOT_FOUND = "CHECKLIST_ENTRY_NOT_FOUND",
CHECKLIST_VEHICLE_NOT_FOUND = "CHECKLIST_VEHICLE_NOT_FOUND",
CHECKLIST_REQUIRED_ITEMS_MISSING = "CHECKLIST_REQUIRED_ITEMS_MISSING",
CHECKLIST_INVALID_ITEM_ID = "CHECKLIST_INVALID_ITEM_ID",
```

---

## 4. Frontend

### 4.1 Tipos e API client — adicionar em `apps/web/lib/frontend/api-client.ts`

```typescript
// ─── Checklist Types ──────────────────────────────────────────────────────────

export type ItemType = "YES_NO" | "TEXT" | "NUMBER" | "PHOTO" | "SELECT" | "SIGNATURE";
export type EntryStatus = "PENDING" | "COMPLETED" | "INCOMPLETE";

export interface ChecklistTemplateItem {
  id: string;
  templateId: string;
  label: string;
  type: ItemType;
  required: boolean;
  options: string[];
  order: number;
}

export interface ChecklistTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  active: boolean;
  items: ChecklistTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistAnswer {
  id: string;
  entryId: string;
  itemId: string;
  value?: string | null;
  photoUrl?: string | null;
}

export interface ChecklistEntry {
  id: string;
  organizationId: string;
  templateId: string;
  vehicleId: string;
  driverId?: string | null;
  memberId: string;
  status: EntryStatus;
  completedAt?: string | null;
  answers: ChecklistAnswer[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateChecklistTemplatePayload {
  name: string;
  description?: string;
  active?: boolean;
  items: {
    label: string;
    type: ItemType;
    required: boolean;
    options?: string[];
    order: number;
  }[];
}

export interface CreateChecklistEntryPayload {
  templateId: string;
  vehicleId: string;
  driverId?: string;
  answers: { itemId: string; value?: string; photoUrl?: string }[];
}

export interface ChecklistEntryFilters {
  vehicleId?: string;
  driverId?: string;
  memberId?: string;
  templateId?: string;
  status?: EntryStatus;
  dateFrom?: string;
  dateTo?: string;
}

export const checklistAPI = {
  // Templates
  listTemplates: (organizationId: string) =>
    externalApi.get<ChecklistTemplate[]>(
      `/api/organizations/${organizationId}/checklist/templates`,
    ),
  createTemplate: (organizationId: string, payload: CreateChecklistTemplatePayload) =>
    externalApi.post<ChecklistTemplate>(
      `/api/organizations/${organizationId}/checklist/templates`,
      payload,
    ),
  getTemplate: (organizationId: string, templateId: string) =>
    externalApi.get<ChecklistTemplate>(
      `/api/organizations/${organizationId}/checklist/templates/${templateId}`,
    ),
  updateTemplate: (
    organizationId: string,
    templateId: string,
    payload: Partial<CreateChecklistTemplatePayload>,
  ) =>
    externalApi.patch<ChecklistTemplate>(
      `/api/organizations/${organizationId}/checklist/templates/${templateId}`,
      payload,
    ),
  deleteTemplate: (organizationId: string, templateId: string) =>
    externalApi.delete(
      `/api/organizations/${organizationId}/checklist/templates/${templateId}`,
    ),

  // Entries
  listEntries: (organizationId: string, filters?: ChecklistEntryFilters) =>
    externalApi.get<ChecklistEntry[]>(
      `/api/organizations/${organizationId}/checklist/entries`,
      { params: filters },
    ),
  createEntry: (organizationId: string, payload: CreateChecklistEntryPayload) =>
    externalApi.post<ChecklistEntry>(
      `/api/organizations/${organizationId}/checklist/entries`,
      payload,
    ),
  getEntry: (organizationId: string, entryId: string) =>
    externalApi.get<ChecklistEntry>(
      `/api/organizations/${organizationId}/checklist/entries/${entryId}`,
    ),
  updateEntryStatus: (
    organizationId: string,
    entryId: string,
    status: EntryStatus,
  ) =>
    externalApi.patch<ChecklistEntry>(
      `/api/organizations/${organizationId}/checklist/entries/${entryId}`,
      { status },
    ),
};
```

### 4.2 Arquivos de página a criar

#### `apps/web/app/dashboard/checklist/page.tsx`
Página principal com duas abas: **Templates** e **Entradas**.
- Aba Templates: `DataTable` com colunas (Nome, Status Ativo, N. de Itens, Criado em, Ações).
  - Ações: Editar → `/dashboard/checklist/templates/[id]`, Preencher → `/dashboard/checklist/fill/[templateId]`, Excluir (confirm dialog).
  - Botão "Novo Template" visível apenas para ADMIN/OWNER → `/dashboard/checklist/templates/new`.
- Aba Entradas: `DataTable` com filtros (vehicleId, status, dateFrom, dateTo) e colunas (Template, Veículo, Preenchido por, Status, Data).

```typescript
// Estrutura geral do componente:
"use client";
// Importar checklistAPI, useAuth, useTranslation, DataTable, Tabs
// useState para aba ativa (templates | entries)
// Carregar dados com useEffect
// Renderizar abas com <Tabs> do shadcn/ui
```

#### `apps/web/app/dashboard/checklist/templates/new/page.tsx`
Formulário de criação de template com drag-and-drop de itens.

Componentes necessários:
- Campo nome e descrição do template.
- Toggle "Ativo".
- Lista de itens com drag-and-drop (usar `@dnd-kit/sortable` — **verificar se já está instalado no projeto**; se não, instalar: `npm install @dnd-kit/core @dnd-kit/sortable`).
- Botão "Adicionar Item" que abre painel de configuração inline:
  - `label` (input texto)
  - `type` (Select: YES_NO | TEXT | NUMBER | PHOTO | SELECT | SIGNATURE)
  - `required` (Checkbox)
  - `options` (input tag separado por vírgula — visível apenas quando type=SELECT)
- Ao salvar: `checklistAPI.createTemplate(...)` → redirect para `/dashboard/checklist`.

```typescript
// Interface do estado de item no form:
interface FormItem {
  tempId: string; // para key do DnD antes de ter ID real
  label: string;
  type: ItemType;
  required: boolean;
  options: string[];
}
```

#### `apps/web/app/dashboard/checklist/templates/[id]/page.tsx`
Idêntico ao de criação, mas carrega o template existente e chama `updateTemplate`.
- Buscar template via `checklistAPI.getTemplate(orgId, params.id)`.
- Pre-popular form com dados existentes.
- Itens existentes têm `id` real; ao salvar, enviar todos os itens (backend faz delete+recreate).

#### `apps/web/app/dashboard/checklist/fill/[templateId]/page.tsx`
Formulário dinâmico de preenchimento de checklist.

Lógica:
1. Buscar template: `checklistAPI.getTemplate(orgId, templateId)`.
2. Buscar veículos disponíveis: `vehiclesAPI.list(orgId)`.
3. Renderizar selector de veículo e, opcionalmente, motorista (campo texto livre até módulo DRIVERS existir).
4. Renderizar items do template dinamicamente por tipo:
   - `YES_NO` → `<RadioGroup>` com Sim/Não
   - `TEXT` → `<Textarea>`
   - `NUMBER` → `<Input type="number">`
   - `PHOTO` → `<Input type="url" placeholder="URL da foto">`
   - `SELECT` → `<Select>` com as opções do item
   - `SIGNATURE` → `<Input type="url" placeholder="URL da assinatura">` (placeholder)
5. Ao submeter: validar required no client, chamar `checklistAPI.createEntry(...)`.
6. Toast de sucesso → redirect para `/dashboard/checklist?tab=entries`.

```typescript
// Estado do formulário de resposta:
interface AnswerState {
  [itemId: string]: string; // valor como string em todos os tipos
}
```

#### `apps/web/app/dashboard/checklist/entries/[id]/page.tsx`
Visualização read-only de uma entrada preenchida.

- Buscar entry: `checklistAPI.getEntry(orgId, entryId)`.
- Buscar template relacionado para exibir labels dos itens.
- Exibir cabeçalho: Template, Veículo, Preenchido por, Status (Badge colorido), Data.
- Exibir tabela de respostas: Item | Tipo | Resposta.
  - YES_NO: exibir "Sim" / "Não" em vez de "true"/"false".
  - PHOTO: exibir link clicável ou miniatura.
- Admin/Owner pode alterar status via dropdown (COMPLETED / INCOMPLETE).

### 4.3 Chaves i18n a adicionar em `apps/web/i18n/locales/pt.json`

Adicionar seção `"checklist"` após a seção `"notifications"`:

```json
"checklist": {
  "title": "Checklists",
  "templates": "Templates",
  "entries": "Entradas",
  "newTemplate": "Novo Template",
  "editTemplate": "Editar Template",
  "templateName": "Nome do Template",
  "templateNamePlaceholder": "Ex: Checklist Pré-Viagem",
  "templateDescription": "Descrição",
  "templateDescriptionPlaceholder": "Descreva o propósito do template",
  "templateActive": "Ativo",
  "templateItems": "Itens do Checklist",
  "addItem": "Adicionar Item",
  "removeItem": "Remover Item",
  "itemLabel": "Pergunta / Descrição do Item",
  "itemLabelPlaceholder": "Ex: Os pneus estão calibrados?",
  "itemType": "Tipo de Resposta",
  "itemRequired": "Obrigatório",
  "itemOptions": "Opções (separadas por vírgula)",
  "itemTypes": {
    "YES_NO": "Sim / Não",
    "TEXT": "Texto Livre",
    "NUMBER": "Número",
    "PHOTO": "Foto (URL)",
    "SELECT": "Seleção Múltipla",
    "SIGNATURE": "Assinatura (URL)"
  },
  "dragToReorder": "Arraste para reordenar",
  "noTemplates": "Nenhum template cadastrado.",
  "noEntries": "Nenhuma entrada registrada.",
  "fillChecklist": "Preencher Checklist",
  "selectVehicle": "Selecionar Veículo",
  "selectVehiclePlaceholder": "Selecione o veículo",
  "vehicleRequired": "Selecione um veículo.",
  "driverOptional": "Motorista (opcional)",
  "driverPlaceholder": "Nome do motorista",
  "submitChecklist": "Enviar Checklist",
  "submitting": "Enviando...",
  "entryStatus": {
    "PENDING": "Pendente",
    "COMPLETED": "Concluído",
    "INCOMPLETE": "Incompleto"
  },
  "entryDetail": "Detalhe da Entrada",
  "answeredBy": "Preenchido por",
  "answeredAt": "Preenchido em",
  "vehicle": "Veículo",
  "template": "Template",
  "itemCount": "{{count}} item(s)",
  "requiredItemsMissing": "Preencha todos os itens obrigatórios.",
  "confirmDeleteTemplate": {
    "title": "Excluir Template",
    "description": "Templates com entradas vinculadas serão apenas desativados, não excluídos. Continuar?"
  },
  "toastCreated": "Template criado com sucesso.",
  "toastUpdated": "Template atualizado com sucesso.",
  "toastDeleted": "Template excluído/desativado.",
  "toastEntryCreated": "Checklist enviado com sucesso.",
  "toastEntryUpdated": "Status da entrada atualizado.",
  "toastError": "Erro ao processar operação. Tente novamente.",
  "filterByVehicle": "Filtrar por veículo...",
  "filterByStatus": "Filtrar por status",
  "filterByDate": "Filtrar por data",
  "allStatuses": "Todos os status",
  "columns": {
    "name": "Nome",
    "active": "Ativo",
    "itemCount": "Itens",
    "createdAt": "Criado em",
    "template": "Template",
    "vehicle": "Veículo",
    "member": "Preenchido por",
    "status": "Status",
    "date": "Data"
  }
}
```

Adicionar também em `navigation.items`:
```json
"checklist": "Checklists"
```

### 4.4 Adicionar "Checklist" no Sidebar

Editar `apps/web/components/navigation/app-sidebar.tsx`:

1. Adicionar import:
```typescript
import { ClipboardList } from "lucide-react";
```

2. No array `mainNavigation`, na seção `overview`, adicionar após `vehicles`:
```typescript
{
  name: t('navigation.items.checklist'),
  href: "/dashboard/checklist",
  icon: ClipboardList,
  current: pathname.startsWith("/dashboard/checklist"),
},
```

---

## 5. Considerações Especiais

### Renderização dinâmica do formulário de preenchimento

O componente de fill usa o campo `type` de cada `ChecklistTemplateItem` para renderizar o input correto. A ordem de renderização segue o campo `order` (ordenado ASC). Pseudocódigo:

```tsx
{template.items.sort((a, b) => a.order - b.order).map(item => (
  <div key={item.id}>
    <label>{item.label}{item.required && <span>*</span>}</label>
    {item.type === "YES_NO" && <RadioGroup ... />}
    {item.type === "TEXT" && <Textarea ... />}
    {item.type === "NUMBER" && <Input type="number" ... />}
    {item.type === "PHOTO" && <Input type="url" placeholder="URL da foto" ... />}
    {item.type === "SELECT" && <Select options={item.options} ... />}
    {item.type === "SIGNATURE" && <Input type="url" placeholder="URL da assinatura" ... />}
  </div>
))}
```

### Serialização das respostas

Todas as respostas são salvas no campo `value` como `string`:
- `YES_NO`: `"true"` ou `"false"`
- `TEXT`: texto literal
- `NUMBER`: número como string (ex: `"42"`)
- `PHOTO`: URL como string (campo dedicado `photoUrl` também preenchido)
- `SELECT`: valor selecionado como string
- `SIGNATURE`: URL como string

### Soft delete de templates

Se o template tem entries vinculadas, o DELETE apenas seta `active = false`. Isso impede quebrar histórico de entradas. O frontend deve comunicar isso na confirm dialog.

### Validação de itens required

Feita tanto no **backend** (service lança `BadRequestException`) quanto no **frontend** (antes de submeter o form, verificar itens required sem resposta e exibir mensagem de erro inline).

---

## 6. Dependência de RBAC

O módulo RBAC ainda não está implementado (Wave 1). Por isso, usar a verificação de role existente (`OWNER` | `ADMIN` | `MEMBER`) como **placeholder**.

Quando o RBAC for implementado, substituir:
- `this.requireAdminOrOwner(req.organizationMember)` → `@Permission(Module.CHECKLIST, Action.CREATE)`
- `@Permission(Module.CHECKLIST, Action.EDIT)` nos endpoints de update de templates
- `@Permission(Module.CHECKLIST, Action.DELETE)` no endpoint de delete de templates

Roles esperadas do RBAC para este módulo:
| Role | Permissão |
|------|-----------|
| COMPANY_OWNER / COMPANY_ADMIN | CHECKLIST: VIEW, CREATE, EDIT, DELETE |
| OPERATOR | CHECKLIST: VIEW, CREATE, EDIT |
| DRIVER | CHECKLIST: CREATE |
| VIEWER | CHECKLIST: VIEW |

---

## 7. Ordem de Implementação (Tasks Numeradas)

### Task 1 — Schema Prisma e Migration
**Arquivo:** `apps/api/prisma/schema.prisma`
1. Adicionar enums `ItemType` e `EntryStatus`.
2. Adicionar modelos `ChecklistTemplate`, `ChecklistTemplateItem`, `ChecklistEntry`, `ChecklistAnswer`.
3. Adicionar relações inversas em `Organization`, `Vehicle`, `OrganizationMember`.
4. Rodar: `cd apps/api && npx prisma migrate dev --name add_checklist_module`.
5. Verificar: `npx prisma studio` → confirmar 4 novas tabelas criadas.

### Task 2 — API Codes
**Arquivo:** `apps/api/src/common/api-codes.enum.ts`
1. Adicionar os 5 novos códigos de erro (`CHECKLIST_*`).

### Task 3 — Backend: DTO
**Arquivo:** `apps/api/src/checklist/checklist.dto.ts` (criar)
1. Implementar todos os DTOs conforme seção 3.2.
2. Verificar imports de `class-validator`, `class-transformer`, `@nestjs/swagger`.

### Task 4 — Backend: Service
**Arquivo:** `apps/api/src/checklist/checklist.service.ts` (criar)
1. Implementar `ChecklistService` conforme seção 3.3.
2. Cobrir todos os métodos: `listTemplates`, `createTemplate`, `getTemplate`, `updateTemplate`, `deleteTemplate`, `listEntries`, `createEntry`, `getEntry`, `updateEntryStatus`.

### Task 5 — Backend: Controller
**Arquivo:** `apps/api/src/checklist/checklist.controller.ts` (criar)
1. Implementar `ChecklistController` conforme seção 3.4.
2. Mapear todos os 9 endpoints.

### Task 6 — Backend: Module + Registro
**Arquivos:** `apps/api/src/checklist/checklist.module.ts` (criar) + `apps/api/src/app.module.ts` (editar)
1. Criar `ChecklistModule` conforme seção 3.5.
2. Adicionar `ChecklistModule` ao `AppModule`.
3. Verificar compilação: `cd apps/api && npm run build` sem erros.

### Task 7 — Frontend: API Client
**Arquivo:** `apps/web/lib/frontend/api-client.ts`
1. Adicionar interfaces TypeScript de tipos.
2. Adicionar objeto `checklistAPI` com todos os métodos.

### Task 8 — Frontend: i18n
**Arquivo:** `apps/web/i18n/locales/pt.json`
1. Adicionar seção `"checklist"` conforme seção 4.3.
2. Adicionar `"checklist": "Checklists"` em `navigation.items`.

### Task 9 — Frontend: Sidebar
**Arquivo:** `apps/web/components/navigation/app-sidebar.tsx`
1. Importar `ClipboardList` de lucide-react.
2. Adicionar item de navegação "Checklist".

### Task 10 — Frontend: Página Principal (Abas)
**Arquivo:** `apps/web/app/dashboard/checklist/page.tsx` (criar)
1. Implementar página com `<Tabs>` (Templates / Entradas).
2. DataTable de templates com colunas: nome, ativo, itemCount, createdAt, ações.
3. DataTable de entries com colunas + filtros.

### Task 11 — Frontend: Página New Template
**Arquivo:** `apps/web/app/dashboard/checklist/templates/new/page.tsx` (criar)
1. Verificar se `@dnd-kit/sortable` está instalado (se não, instalar).
2. Implementar formulário com DnD de itens.
3. Lógica de adicionar/remover/reordenar itens.
4. Submit com `checklistAPI.createTemplate`.

### Task 12 — Frontend: Página Edit Template
**Arquivo:** `apps/web/app/dashboard/checklist/templates/[id]/page.tsx` (criar)
1. Carregar template existente via `checklistAPI.getTemplate`.
2. Reutilizar lógica de formulário da Task 11 (extrair componente `TemplateForm` se necessário).
3. Submit com `checklistAPI.updateTemplate`.

### Task 13 — Frontend: Página de Preenchimento
**Arquivo:** `apps/web/app/dashboard/checklist/fill/[templateId]/page.tsx` (criar)
1. Buscar template e lista de veículos.
2. Renderizar form dinâmico por `ItemType`.
3. Validação client-side de required.
4. Submit com `checklistAPI.createEntry`.

### Task 14 — Frontend: Página de Visualização de Entry
**Arquivo:** `apps/web/app/dashboard/checklist/entries/[id]/page.tsx` (criar)
1. Buscar entry + template relacionado.
2. Exibir respostas com formatação por tipo.
3. Admin/Owner: dropdown de alteração de status.

---

## 8. Testes de Verificação

### Backend (manual via Swagger ou curl)

```
# 1. Auth — obter token JWT
POST /api/auth/login { email, password }

# 2. Templates
POST   /api/organizations/:orgId/checklist/templates
  Body: { name: "Pré-Viagem", items: [{ label: "Pneus OK?", type: "YES_NO", required: true, order: 1 }] }
  → Esperar 201 com template criado e items

GET    /api/organizations/:orgId/checklist/templates
  → Esperar array com 1 template

GET    /api/organizations/:orgId/checklist/templates/:id
  → Esperar template com items

PATCH  /api/organizations/:orgId/checklist/templates/:id
  Body: { name: "Pré-Viagem v2", items: [{ label: "Pneus OK?", type: "YES_NO", required: true, order: 1 }, { label: "Km", type: "NUMBER", required: true, order: 2 }] }
  → Esperar template atualizado com 2 items

# 3. Entries — criar com required preenchido
POST   /api/organizations/:orgId/checklist/entries
  Body: { templateId: "...", vehicleId: "...", answers: [{ itemId: "...", value: "true" }, { itemId: "...", value: "120500" }] }
  → Esperar 201 com status: "COMPLETED"

# 4. Entries — criar sem required → deve falhar
POST   /api/organizations/:orgId/checklist/entries
  Body: { templateId: "...", vehicleId: "...", answers: [] }
  → Esperar 400 com CHECKLIST_REQUIRED_ITEMS_MISSING

# 5. Entries — filtros
GET    /api/organizations/:orgId/checklist/entries?status=COMPLETED
  → Esperar apenas entries COMPLETED

GET    /api/organizations/:orgId/checklist/entries?vehicleId=...
  → Esperar apenas entries do veículo especificado

# 6. Delete template com entries → deve desativar, não excluir
DELETE /api/organizations/:orgId/checklist/templates/:id
  → Esperar 200; buscar template → active: false (não 404)

# 7. Delete template sem entries → deve excluir
  → Esperar 200; buscar template → 404
```

### Frontend (checklist visual)

1. Navegar para `/dashboard/checklist` → ver abas Templates / Entradas.
2. Clicar "Novo Template" → preencher nome + 3 itens de tipos diferentes → salvar → ver na lista.
3. Clicar "Preencher" em um template → selecionar veículo → preencher respostas → enviar → ver na aba Entradas com status COMPLETED.
4. Tentar enviar sem preencher item required → ver mensagem de erro inline.
5. Clicar na entry → ver detalhe com todas as respostas formatadas.
6. Admin: alterar status da entry → ver badge atualizado.
7. Editar template → adicionar item → salvar → verificar que entries anteriores ainda existem.
8. Excluir template com entries → confirmar → template aparece como inativo na lista.

### Verificação de isolamento multi-org

- Criar template na Org A.
- Tentar acessar `/api/organizations/ORG_B_ID/checklist/templates/TEMPLATE_ORG_A_ID` → esperar 404.
- Criar entry na Org A com vehicleId de Org B → esperar 404 (veículo não encontrado).

---

## 9. Dependências e Notas Finais

### Pacotes NPM (frontend)
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop dos itens no form de template.
  - Verificar: `cat apps/web/package.json | grep dnd-kit`.
  - Se ausente: `cd apps/web && npm install @dnd-kit/core @dnd-kit/sortable`.

### Integração futura (não implementar agora)
- **Módulo DRIVERS**: quando implementado, `driverId` em `ChecklistEntry` deve ser FK real para `Driver`. Por ora, campo é `String?` livre ou ID de membro.
- **Upload de fotos**: campo `photoUrl` aceita URL; integração com S3/R2 em fase futura (conforme nota 8 do ARCHITECTURE.md).
- **RBAC**: substituir guards placeholder por `@Permission(Module.CHECKLIST, Action.*)` quando Wave 1 for concluída.
- **Relatórios**: exportação PDF/CSV dos entries por período — fase futura.
- **Notificações**: alertar admin quando entry INCOMPLETE for submetida — integrar com `NotificationsModule` existente em fase futura.

### Padrões a seguir (do projeto existente)
- Sempre filtrar por `organizationId` em todas as queries Prisma.
- Usar `toISOString()` para serializar datas no backend.
- Guards: `JwtAuthGuard` + `OrganizationMemberGuard` em todos os endpoints.
- Frontend: `useAuth()` para obter `currentOrganization.id`.
- i18n: sempre usar `t("checklist.chave")` — nunca strings hardcoded em pt-BR.
- DataTable: usar o componente `<DataTable>` de `@/components/ui/data-table` — padrão do projeto.
