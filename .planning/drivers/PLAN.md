# PLAN.md — Módulo DRIVERS (Motoristas)

> Agente executor: Claude Haiku
> Data: 2026-04-16
> Dependência: Este módulo está na Wave 2. O módulo RBAC (Wave 1) ainda não foi implementado.
> Estratégia: implementar com `JwtAuthGuard` agora; adicionar `PermissionGuard` via placeholder comentado para quando o RBAC estiver pronto.

---

## 1. Objetivo

Implementar o módulo completo de cadastro e gestão de motoristas (Drivers) vinculados a organizações, empresas/filiais (Customer) e veículos. Inclui:

- CRUD de motoristas com soft delete (`active = false`)
- Histórico de vinculação motorista-veículo (`DriverVehicleAssignment`)
- Filtros por `organizationId` e `customerId` (respeitando escopo de acesso do membro)
- API REST seguindo convenções do projeto
- Frontend com DataTable, formulário de criação/edição e página de detalhe
- Chaves i18n em `pt.json`
- Entrada no sidebar de navegação

---

## 2. Schema Prisma — Novos Models

### Localização do arquivo
`apps/api/prisma/schema.prisma`

### Models a adicionar (ao final do arquivo, antes do fechamento)

```prisma
model Driver {
  id             String    @id @default(cuid())
  organizationId String
  customerId     String?   // FK para Customer (Empresa/Filial) — opcional
  name           String
  cpf            String?   // CPF — unique por organização (ver @@unique abaixo)
  cnh            String?   // Número da CNH
  cnhCategory    String?   // A, B, C, D, E
  cnhExpiry      DateTime? // Data de vencimento da CNH — para alertas futuros
  phone          String?
  email          String?
  photo          String?   // URL da foto — upload real em fase futura (S3/R2)
  active         Boolean   @default(true) // false = soft delete
  notes          String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  organization       Organization             @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  customer           Customer?                @relation(fields: [customerId], references: [id], onDelete: SetNull)
  vehicleAssignments DriverVehicleAssignment[]

  @@unique([organizationId, cpf]) // CPF único por organização (null não viola unique)
  @@index([organizationId])
  @@index([customerId])
  @@map("drivers")
}

model DriverVehicleAssignment {
  id        String    @id @default(cuid())
  driverId  String
  vehicleId String
  startDate DateTime  @default(now())
  endDate   DateTime? // null = vínculo ativo
  isPrimary Boolean   @default(false)
  createdAt DateTime  @default(now())

  driver  Driver  @relation(fields: [driverId], references: [id], onDelete: Cascade)
  vehicle Vehicle @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  @@index([driverId])
  @@index([vehicleId])
  @@map("driver_vehicle_assignments")
}
```

### Alterações em models existentes

**Customer** — adicionar relação reversa:
```prisma
// Adicionar dentro do model Customer, junto às outras relações:
drivers Driver[]
```

**Vehicle** — adicionar relação reversa:
```prisma
// Adicionar dentro do model Vehicle, junto às outras relações:
driverAssignments DriverVehicleAssignment[]
```

**Organization** — adicionar relação reversa:
```prisma
// Adicionar dentro do model Organization, junto às outras relações:
drivers Driver[]
```

### Migration
Após editar o schema, rodar:
```bash
cd apps/api
npx prisma migrate dev --name add_drivers_module
```

---

## 3. Backend — `apps/api/src/drivers/`

### 3.1 `drivers.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
```

### 3.2 `drivers.dto.ts`

Importações necessárias: `class-validator`, `@nestjs/swagger`.

```typescript
import {
  IsString, IsOptional, IsBoolean, IsEmail,
  IsDateString, MaxLength, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDriverDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'CPF do motorista (único por organização)' })
  @IsOptional()
  @IsString()
  @MaxLength(14) // "000.000.000-00"
  cpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnh?: string;

  @ApiPropertyOptional({ enum: ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'] })
  @IsOptional()
  @IsString()
  cnhCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  cnhExpiry?: string; // ISO 8601 date string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'URL da foto do motorista' })
  @IsOptional()
  @IsString()
  photo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string | null; // null = desvincula da empresa

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnh?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnhCategory?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  cnhExpiry?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class AssignVehicleDto {
  @ApiProperty()
  @IsString()
  vehicleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class DriverVehicleAssignmentResponseDto {
  id: string;
  driverId: string;
  vehicleId: string;
  startDate: string;
  endDate?: string | null;
  isPrimary: boolean;
  vehicle?: {
    id: string;
    name?: string | null;
    plate?: string | null;
  };
}

export class DriverResponseDto {
  id: string;
  organizationId: string;
  customerId?: string | null;
  name: string;
  cpf?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  cnhExpiry?: string | null;
  phone?: string | null;
  email?: string | null;
  photo?: string | null;
  active: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string } | null;
  vehicleAssignments?: DriverVehicleAssignmentResponseDto[];
}

export class DriversListResponseDto {
  drivers: DriverResponseDto[];
}
```

### 3.3 `drivers.service.ts`

Lógica completa de negócio. Filtros por `organizationId` e `customerId` do membro.

```typescript
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomersService } from '@/customers/customers.service';
import type { OrganizationMember } from '@prisma/client';
import {
  AssignVehicleDto,
  CreateDriverDto,
  DriverResponseDto,
  DriverVehicleAssignmentResponseDto,
  UpdateDriverDto,
} from './drivers.dto';
import { ApiCode } from '@/common/api-codes.enum';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  // ── LIST ──────────────────────────────────────────────────────────────────

  async list(
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
    filterCustomerId?: string,
  ): Promise<DriverResponseDto[]> {
    const allowedCustomerIds = await this.customersService.getAllowedCustomerIds(
      member,
      organizationId,
    );

    // Se membro tem acesso restrito e não há clientes atribuídos, retorna vazio
    if (allowedCustomerIds !== null && allowedCustomerIds.length === 0) {
      return [];
    }

    // Se filtro por empresa foi passado, validar acesso
    if (filterCustomerId && allowedCustomerIds !== null) {
      if (!allowedCustomerIds.includes(filterCustomerId)) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }

    const where: any = {
      organizationId,
      // Incluir ativos e inativos na listagem (o frontend pode filtrar)
    };

    if (filterCustomerId) {
      where.customerId = filterCustomerId;
    } else if (allowedCustomerIds !== null) {
      // Motoristas sem empresa (customerId null) + motoristas das empresas permitidas
      where.OR = [
        { customerId: null },
        { customerId: { in: allowedCustomerIds } },
      ];
    }

    const rows = await this.prisma.driver.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      include: {
        customer: { select: { id: true, name: true } },
        vehicleAssignments: {
          where: { endDate: null }, // apenas vínculos ativos
          include: { vehicle: { select: { id: true, name: true, plate: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    return rows.map(this.toResponse);
  }

  // ── CREATE ────────────────────────────────────────────────────────────────

  async create(
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
    dto: CreateDriverDto,
  ): Promise<DriverResponseDto> {
    // Validar CPF único por organização
    if (dto.cpf) {
      const cpfNormalized = dto.cpf.trim();
      const existing = await this.prisma.driver.findFirst({
        where: { organizationId, cpf: cpfNormalized },
      });
      if (existing) {
        throw new ConflictException(ApiCode.COMMON_ALREADY_EXISTS);
      }
    }

    // Validar customerId se fornecido
    if (dto.customerId) {
      await this.validateCustomerAccess(dto.customerId, organizationId, member);
    }

    const driver = await this.prisma.driver.create({
      data: {
        organizationId,
        customerId: dto.customerId || null,
        name: dto.name.trim(),
        cpf: dto.cpf?.trim() || null,
        cnh: dto.cnh?.trim() || null,
        cnhCategory: dto.cnhCategory?.trim() || null,
        cnhExpiry: dto.cnhExpiry ? new Date(dto.cnhExpiry) : null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        photo: dto.photo?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
      include: {
        customer: { select: { id: true, name: true } },
        vehicleAssignments: {
          where: { endDate: null },
          include: { vehicle: { select: { id: true, name: true, plate: true } } },
        },
      },
    });

    return this.toResponse(driver);
  }

  // ── GET BY ID ─────────────────────────────────────────────────────────────

  async getById(
    driverId: string,
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
  ): Promise<DriverResponseDto> {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, organizationId },
      include: {
        customer: { select: { id: true, name: true } },
        vehicleAssignments: {
          include: { vehicle: { select: { id: true, name: true, plate: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);
    }

    // Verificar acesso via empresa do motorista
    if (driver.customerId) {
      await this.validateCustomerReadAccess(driver.customerId, organizationId, member);
    }

    return this.toResponse(driver);
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  async update(
    driverId: string,
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
    dto: UpdateDriverDto,
  ): Promise<DriverResponseDto> {
    const existing = await this.prisma.driver.findFirst({
      where: { id: driverId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);
    }

    // Verificar acesso à empresa atual
    if (existing.customerId) {
      await this.validateCustomerReadAccess(existing.customerId, organizationId, member);
    }

    // Validar novo customerId se fornecido
    if (dto.customerId !== undefined && dto.customerId !== null) {
      await this.validateCustomerAccess(dto.customerId, organizationId, member);
    }

    // Validar CPF único se alterado
    if (dto.cpf !== undefined && dto.cpf !== null && dto.cpf !== existing.cpf) {
      const cpfNormalized = dto.cpf.trim();
      const conflict = await this.prisma.driver.findFirst({
        where: { organizationId, cpf: cpfNormalized, NOT: { id: driverId } },
      });
      if (conflict) {
        throw new ConflictException(ApiCode.COMMON_ALREADY_EXISTS);
      }
    }

    const driver = await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.customerId !== undefined && { customerId: dto.customerId }),
        ...(dto.cpf !== undefined && { cpf: dto.cpf?.trim() || null }),
        ...(dto.cnh !== undefined && { cnh: dto.cnh?.trim() || null }),
        ...(dto.cnhCategory !== undefined && { cnhCategory: dto.cnhCategory }),
        ...(dto.cnhExpiry !== undefined && {
          cnhExpiry: dto.cnhExpiry ? new Date(dto.cnhExpiry) : null,
        }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
        ...(dto.photo !== undefined && { photo: dto.photo?.trim() || null }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
      },
      include: {
        customer: { select: { id: true, name: true } },
        vehicleAssignments: {
          include: { vehicle: { select: { id: true, name: true, plate: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    return this.toResponse(driver);
  }

  // ── DELETE (soft) ─────────────────────────────────────────────────────────

  async delete(
    driverId: string,
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
  ): Promise<void> {
    const existing = await this.prisma.driver.findFirst({
      where: { id: driverId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);
    }

    if (existing.customerId) {
      await this.validateCustomerReadAccess(existing.customerId, organizationId, member);
    }

    // Soft delete: marcar como inativo e encerrar vínculos ativos
    await this.prisma.$transaction([
      this.prisma.driverVehicleAssignment.updateMany({
        where: { driverId, endDate: null },
        data: { endDate: new Date() },
      }),
      this.prisma.driver.update({
        where: { id: driverId },
        data: { active: false },
      }),
    ]);
  }

  // ── ASSIGN VEHICLE ────────────────────────────────────────────────────────

  async assignVehicle(
    driverId: string,
    organizationId: string,
    dto: AssignVehicleDto,
  ): Promise<DriverVehicleAssignmentResponseDto> {
    // Verificar que motorista e veículo pertencem à mesma organização
    const [driver, vehicle] = await Promise.all([
      this.prisma.driver.findFirst({ where: { id: driverId, organizationId, active: true } }),
      this.prisma.vehicle.findFirst({ where: { id: dto.vehicleId, organizationId } }),
    ]);

    if (!driver) throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);
    if (!vehicle) throw new NotFoundException(ApiCode.VEHICLE_NOT_FOUND);

    // Verificar se já existe vínculo ativo com este veículo
    const existingActive = await this.prisma.driverVehicleAssignment.findFirst({
      where: { driverId, vehicleId: dto.vehicleId, endDate: null },
    });
    if (existingActive) {
      throw new ConflictException(ApiCode.COMMON_ALREADY_EXISTS);
    }

    // Se isPrimary = true, encerrar outros vínculos primários ativos deste motorista
    if (dto.isPrimary) {
      await this.prisma.driverVehicleAssignment.updateMany({
        where: { driverId, isPrimary: true, endDate: null },
        data: { endDate: new Date() },
      });
    }

    const assignment = await this.prisma.driverVehicleAssignment.create({
      data: {
        driverId,
        vehicleId: dto.vehicleId,
        isPrimary: dto.isPrimary ?? false,
        startDate: new Date(),
      },
      include: { vehicle: { select: { id: true, name: true, plate: true } } },
    });

    return this.toAssignmentResponse(assignment);
  }

  // ── UNASSIGN VEHICLE ──────────────────────────────────────────────────────

  async unassignVehicle(
    driverId: string,
    vehicleId: string,
    organizationId: string,
  ): Promise<void> {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, organizationId },
    });
    if (!driver) throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);

    const assignment = await this.prisma.driverVehicleAssignment.findFirst({
      where: { driverId, vehicleId, endDate: null },
    });
    if (!assignment) throw new NotFoundException(ApiCode.DRIVER_ASSIGNMENT_NOT_FOUND);

    await this.prisma.driverVehicleAssignment.update({
      where: { id: assignment.id },
      data: { endDate: new Date() },
    });
  }

  // ── HELPERS PRIVADOS ──────────────────────────────────────────────────────

  private async validateCustomerAccess(
    customerId: string,
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
  ): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);

    const allowedIds = await this.customersService.getAllowedCustomerIds(member, organizationId);
    if (allowedIds !== null && !allowedIds.includes(customerId)) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
  }

  private async validateCustomerReadAccess(
    customerId: string,
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
  ): Promise<void> {
    const allowedIds = await this.customersService.getAllowedCustomerIds(member, organizationId);
    if (allowedIds !== null && !allowedIds.includes(customerId)) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
  }

  private toResponse(driver: any): DriverResponseDto {
    return {
      id: driver.id,
      organizationId: driver.organizationId,
      customerId: driver.customerId,
      name: driver.name,
      cpf: driver.cpf,
      cnh: driver.cnh,
      cnhCategory: driver.cnhCategory,
      cnhExpiry: driver.cnhExpiry?.toISOString() ?? null,
      phone: driver.phone,
      email: driver.email,
      photo: driver.photo,
      active: driver.active,
      notes: driver.notes,
      createdAt: driver.createdAt.toISOString(),
      updatedAt: driver.updatedAt.toISOString(),
      customer: driver.customer ?? null,
      vehicleAssignments: driver.vehicleAssignments?.map(
        this.toAssignmentResponse.bind(this),
      ),
    };
  }

  private toAssignmentResponse(assignment: any): DriverVehicleAssignmentResponseDto {
    return {
      id: assignment.id,
      driverId: assignment.driverId,
      vehicleId: assignment.vehicleId,
      startDate: assignment.startDate.toISOString(),
      endDate: assignment.endDate?.toISOString() ?? null,
      isPrimary: assignment.isPrimary,
      vehicle: assignment.vehicle ?? undefined,
    };
  }
}
```

### 3.4 `drivers.controller.ts`

```typescript
import {
  Body, Controller, Delete, Get, Param, Patch, Post,
  Query, Request, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DriversService } from './drivers.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignVehicleDto,
  CreateDriverDto,
  DriverResponseDto,
  DriversListResponseDto,
  UpdateDriverDto,
} from './drivers.dto';

// TODO (Wave 1 — RBAC): Descomentar quando PermissionGuard estiver implementado
// import { PermissionGuard } from '../auth/guards/permission.guard';
// import { Permission } from '../auth/decorators/permission.decorator';
// import { Module as PermModule, Action } from '../auth/enums/permission.enum';

interface RequestWithUser extends ExpressRequest {
  user: { userId: string };
}

@ApiTags('drivers')
@Controller('organizations/:organizationId/drivers')
@UseGuards(JwtAuthGuard)
// TODO (Wave 1 — RBAC): @UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List drivers in an organization' })
  @ApiResponse({ status: 200, type: DriversListResponseDto })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.VIEW)
  async list(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Query('customerId') customerId?: string,
  ): Promise<DriversListResponseDto> {
    const member = await this.getMember(req.user.userId, organizationId);
    const drivers = await this.driversService.list(
      organizationId,
      member,
      customerId,
    );
    return { drivers };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new driver' })
  @ApiResponse({ status: 201, type: DriverResponseDto })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.CREATE)
  async create(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateDriverDto,
  ): Promise<DriverResponseDto> {
    const member = await this.getMember(req.user.userId, organizationId);
    return this.driversService.create(organizationId, member, dto);
  }

  @Get(':driverId')
  @ApiOperation({ summary: 'Get a driver by ID' })
  @ApiResponse({ status: 200, type: DriverResponseDto })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.VIEW)
  async getById(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
  ): Promise<DriverResponseDto> {
    const member = await this.getMember(req.user.userId, organizationId);
    return this.driversService.getById(driverId, organizationId, member);
  }

  @Patch(':driverId')
  @ApiOperation({ summary: 'Update a driver' })
  @ApiResponse({ status: 200, type: DriverResponseDto })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.EDIT)
  async update(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
    @Body() dto: UpdateDriverDto,
  ): Promise<DriverResponseDto> {
    const member = await this.getMember(req.user.userId, organizationId);
    return this.driversService.update(driverId, organizationId, member, dto);
  }

  @Delete(':driverId')
  @ApiOperation({ summary: 'Soft-delete a driver (sets active = false)' })
  @ApiResponse({ status: 204, description: 'Driver deactivated' })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.DELETE)
  async delete(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
  ): Promise<void> {
    const member = await this.getMember(req.user.userId, organizationId);
    return this.driversService.delete(driverId, organizationId, member);
  }

  @Post(':driverId/assign-vehicle')
  @ApiOperation({ summary: 'Assign a vehicle to a driver' })
  @ApiResponse({ status: 201 })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.EDIT)
  async assignVehicle(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
    @Body() dto: AssignVehicleDto,
  ) {
    return this.driversService.assignVehicle(driverId, organizationId, dto);
  }

  @Delete(':driverId/assign-vehicle/:vehicleId')
  @ApiOperation({ summary: 'Remove vehicle assignment from a driver' })
  @ApiResponse({ status: 204 })
  // TODO (Wave 1 — RBAC): @Permission(PermModule.DRIVERS, Action.EDIT)
  async unassignVehicle(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
  ): Promise<void> {
    return this.driversService.unassignVehicle(driverId, vehicleId, organizationId);
  }

  // ── HELPER ────────────────────────────────────────────────────────────────

  private async getMember(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      select: { id: true, customerRestricted: true },
    });
    if (!member) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('AUTH_FORBIDDEN');
    }
    return member;
  }
}
```

### 3.5 Registrar em `app.module.ts`

Adicionar ao array `imports`:
```typescript
import { DriversModule } from './drivers/drivers.module';

// No array imports:
DriversModule,
```

### 3.6 Adicionar códigos de erro em `api-codes.enum.ts`

Localização: `apps/api/src/common/api-codes.enum.ts`

Adicionar as chaves:
```typescript
DRIVER_NOT_FOUND = 'DRIVER_NOT_FOUND',
DRIVER_ASSIGNMENT_NOT_FOUND = 'DRIVER_ASSIGNMENT_NOT_FOUND',
VEHICLE_NOT_FOUND = 'VEHICLE_NOT_FOUND',     // se ainda não existir
COMMON_ALREADY_EXISTS = 'COMMON_ALREADY_EXISTS', // se ainda não existir
```

---

## 4. Frontend — `apps/web/app/dashboard/drivers/`

### 4.1 `apps/web/lib/frontend/api-client.ts` — Novos tipos e API

Adicionar ao final do arquivo:

```typescript
// ── DRIVERS ──────────────────────────────────────────────────────────────────

export interface DriverVehicleAssignment {
  id: string;
  driverId: string;
  vehicleId: string;
  startDate: string;
  endDate?: string | null;
  isPrimary: boolean;
  vehicle?: {
    id: string;
    name?: string | null;
    plate?: string | null;
  };
}

export interface Driver {
  id: string;
  organizationId: string;
  customerId?: string | null;
  name: string;
  cpf?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  cnhExpiry?: string | null;
  phone?: string | null;
  email?: string | null;
  photo?: string | null;
  active: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string } | null;
  vehicleAssignments?: DriverVehicleAssignment[];
}

export interface CreateDriverPayload {
  name: string;
  customerId?: string;
  cpf?: string;
  cnh?: string;
  cnhCategory?: string;
  cnhExpiry?: string;   // ISO 8601
  phone?: string;
  email?: string;
  photo?: string;
  notes?: string;
}

export interface UpdateDriverPayload {
  name?: string;
  customerId?: string | null;
  cpf?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  cnhExpiry?: string | null;
  phone?: string | null;
  email?: string | null;
  photo?: string | null;
  active?: boolean;
  notes?: string | null;
}

export const driversAPI = {
  list: (organizationId: string, params?: { customerId?: string | null }) =>
    externalApi.get<{ drivers: Driver[] }>(
      `/api/organizations/${organizationId}/drivers`,
      {
        params: params?.customerId
          ? { customerId: params.customerId }
          : undefined,
      }
    ),

  get: (organizationId: string, driverId: string) =>
    externalApi.get<Driver>(
      `/api/organizations/${organizationId}/drivers/${driverId}`
    ),

  create: (organizationId: string, payload: CreateDriverPayload) =>
    externalApi.post<Driver>(
      `/api/organizations/${organizationId}/drivers`,
      payload
    ),

  update: (organizationId: string, driverId: string, payload: UpdateDriverPayload) =>
    externalApi.patch<Driver>(
      `/api/organizations/${organizationId}/drivers/${driverId}`,
      payload
    ),

  delete: (organizationId: string, driverId: string) =>
    externalApi.delete(
      `/api/organizations/${organizationId}/drivers/${driverId}`
    ),

  assignVehicle: (
    organizationId: string,
    driverId: string,
    payload: { vehicleId: string; isPrimary?: boolean }
  ) =>
    externalApi.post(
      `/api/organizations/${organizationId}/drivers/${driverId}/assign-vehicle`,
      payload
    ),

  unassignVehicle: (organizationId: string, driverId: string, vehicleId: string) =>
    externalApi.delete(
      `/api/organizations/${organizationId}/drivers/${driverId}/assign-vehicle/${vehicleId}`
    ),
};
```

### 4.2 `apps/web/app/dashboard/drivers/columns.tsx`

```typescript
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreVertical, Pencil, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Driver } from "@/lib/frontend/api-client";

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export interface DriverColumnsOptions {
  onEdit: (driver: Driver) => void;
  onDelete: (driver: Driver) => void;
}

export function getDriverColumns(
  t: TFunction,
  options: DriverColumnsOptions,
): ColumnDef<Driver>[] {
  const { onEdit, onDelete } = options;

  return [
    {
      accessorKey: "name",
      meta: { labelKey: "common.name" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("common.name")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "cpf",
      meta: { labelKey: "drivers.cpf" },
      header: t("drivers.cpf"),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.cpf ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "cnhCategory",
      meta: { labelKey: "drivers.cnhCategory" },
      header: t("drivers.cnhCategory"),
      cell: ({ row }) => (
        <span>{row.original.cnhCategory ?? "—"}</span>
      ),
    },
    {
      id: "customer",
      accessorFn: (row) => row.customer?.name ?? "",
      meta: { labelKey: "drivers.customer" },
      header: t("drivers.customer"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.customer?.name ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "active",
      meta: { labelKey: "common.status" },
      header: t("common.status"),
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "default" : "secondary"}>
          {row.original.active ? t("common.active") : t("common.inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">{t("common.actions")}</div>,
      cell: ({ row }) => {
        const driver = row.original;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("drivers.openActionsMenu")}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/drivers/${driver.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    {t("common.view")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(driver)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(driver)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
```

### 4.3 `apps/web/app/dashboard/drivers/driver-form-dialog.tsx`

Componente de formulário baseado no padrão de `vehicle-form-dialog.tsx`. Usa Formik + Zod + shadcn/ui.

```typescript
"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { z } from "zod";
import { toFormikValidationSchema } from "zod-formik-adapter";
import { toast } from "sonner";
import {
  driversAPI, customersAPI,
  type Driver, type Customer,
  type CreateDriverPayload, type UpdateDriverPayload,
} from "@/lib/frontend/api-client";

const CNH_CATEGORIES = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"] as const;

interface DriverFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver | null;
  organizationId: string;
  onSuccess: () => void;
  defaultCustomerId?: string | null;
}

interface DriverFormValues {
  name: string;
  customerId: string;
  cpf: string;
  cnh: string;
  cnhCategory: string;
  cnhExpiry: string;   // YYYY-MM-DD
  phone: string;
  email: string;
  photo: string;
  notes: string;
  active: boolean;
}

function getInitialValues(driver: Driver | null, defaultCustomerId?: string | null): DriverFormValues {
  return {
    name: driver?.name ?? "",
    customerId: driver?.customerId ?? defaultCustomerId ?? "",
    cpf: driver?.cpf ?? "",
    cnh: driver?.cnh ?? "",
    cnhCategory: driver?.cnhCategory ?? "",
    cnhExpiry: driver?.cnhExpiry ? driver.cnhExpiry.substring(0, 10) : "",
    phone: driver?.phone ?? "",
    email: driver?.email ?? "",
    photo: driver?.photo ?? "",
    notes: driver?.notes ?? "",
    active: driver?.active ?? true,
  };
}

function buildSchema(t: (k: string) => string) {
  return z.object({
    name: z.string().min(1, t("drivers.nameRequired")),
    customerId: z.string().optional(),
    cpf: z.string().optional(),
    cnh: z.string().optional(),
    cnhCategory: z.string().optional(),
    cnhExpiry: z.string().optional(),
    phone: z.string().optional(),
    email: z.union([z.string().email(t("drivers.emailInvalid")), z.literal("")]).optional(),
    photo: z.string().optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  });
}

export function DriverFormDialog({
  open, onOpenChange, driver, organizationId, onSuccess, defaultCustomerId,
}: DriverFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!driver;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoadingCustomers(true);
    customersAPI
      .list(organizationId)
      .then((res) => setCustomers(res.data?.customers ?? []))
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [open, organizationId]);

  const handleSubmit = (values: DriverFormValues, { setStatus }: any) => {
    setStatus(undefined);

    const payload = {
      name: values.name.trim(),
      customerId: values.customerId || undefined,
      cpf: values.cpf.trim() || undefined,
      cnh: values.cnh.trim() || undefined,
      cnhCategory: values.cnhCategory || undefined,
      cnhExpiry: values.cnhExpiry || undefined,
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      photo: values.photo.trim() || undefined,
      notes: values.notes.trim() || undefined,
    };

    const promise = isEdit
      ? driversAPI.update(organizationId, driver!.id, payload as UpdateDriverPayload)
      : driversAPI.create(organizationId, payload as CreateDriverPayload);

    return promise
      .then(() => {
        toast.success(isEdit ? t("drivers.toastUpdated") : t("drivers.toastCreated"));
        onSuccess();
        onOpenChange(false);
      })
      .catch((err: any) => {
        const message = err?.response?.data?.message ?? t("drivers.toastError");
        setStatus(message);
        toast.error(message);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("drivers.editDriver") : t("drivers.createDriver")}
          </DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={getInitialValues(driver, defaultCustomerId)}
          validationSchema={toFormikValidationSchema(buildSchema(t))}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ values, setFieldValue, isSubmitting, errors, touched, status }) => (
            <Form className="space-y-6" noValidate>
              {status && (
                <p className="text-destructive text-sm" role="alert">{status}</p>
              )}

              {/* Seção: Dados Pessoais */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b pb-1">
                  {t("drivers.sectionPersonal")}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="driver-name">{t("common.name")} *</Label>
                    <Field
                      as={Input}
                      id="driver-name"
                      name="name"
                      placeholder={t("drivers.namePlaceholder")}
                      className={errors.name && touched.name ? "border-destructive" : ""}
                    />
                    <ErrorMessage name="name" component="div" className="text-destructive text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver-cpf">{t("drivers.cpf")}</Label>
                    <Field
                      as={Input}
                      id="driver-cpf"
                      name="cpf"
                      placeholder="000.000.000-00"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver-phone">{t("common.phone")}</Label>
                    <Field as={Input} id="driver-phone" name="phone" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="driver-email">{t("common.email")}</Label>
                    <Field
                      as={Input}
                      id="driver-email"
                      name="email"
                      type="email"
                      className={errors.email && touched.email ? "border-destructive" : ""}
                    />
                    <ErrorMessage name="email" component="div" className="text-destructive text-sm" />
                  </div>
                </div>

                {/* Empresa vinculada */}
                <div className="space-y-2">
                  <Label>{t("drivers.customer")}</Label>
                  <Popover open={customerComboboxOpen} onOpenChange={setCustomerComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        disabled={loadingCustomers}
                        className={cn(
                          "w-full justify-between font-normal h-10",
                          !values.customerId && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">
                          {values.customerId
                            ? customers.find((c) => c.id === values.customerId)?.name
                              ?? t("drivers.selectCustomer")
                            : t("drivers.selectCustomer")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t("drivers.filterCustomer")} className="h-9" />
                        <CommandList>
                          <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value=""
                              onSelect={() => {
                                setFieldValue("customerId", "");
                                setCustomerComboboxOpen(false);
                              }}
                            >
                              {t("drivers.noCustomer")}
                            </CommandItem>
                            {customers.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={() => {
                                  setFieldValue("customerId", c.id);
                                  setCustomerComboboxOpen(false);
                                }}
                              >
                                <span
                                  style={{ paddingLeft: (c.depth ?? 0) * 12 }}
                                  className="inline-block"
                                >
                                  {c.name}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Seção: CNH */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b pb-1">{t("drivers.sectionCnh")}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="driver-cnh">{t("drivers.cnh")}</Label>
                    <Field as={Input} id="driver-cnh" name="cnh" className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver-cnhCategory">{t("drivers.cnhCategory")}</Label>
                    <Select
                      value={values.cnhCategory}
                      onValueChange={(v) => setFieldValue("cnhCategory", v)}
                    >
                      <SelectTrigger id="driver-cnhCategory">
                        <SelectValue placeholder={t("drivers.selectCnhCategory")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t("drivers.noCnhCategory")}</SelectItem>
                        {CNH_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver-cnhExpiry">{t("drivers.cnhExpiry")}</Label>
                    <Field
                      as={Input}
                      id="driver-cnhExpiry"
                      name="cnhExpiry"
                      type="date"
                    />
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label htmlFor="driver-notes">{t("drivers.notes")}</Label>
                <Field
                  as={Textarea}
                  id="driver-notes"
                  name="notes"
                  placeholder={t("drivers.notesPlaceholder")}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? isEdit ? t("common.updating") : t("common.creating")
                    : isEdit ? t("common.update") : t("common.create")}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
```

### 4.4 `apps/web/app/dashboard/drivers/delete-driver-dialog.tsx`

```typescript
"use client";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/i18n/useTranslation";
import { driversAPI, type Driver } from "@/lib/frontend/api-client";
import { toast } from "sonner";
import { useState } from "react";

interface DeleteDriverDialogProps {
  driver: Driver | null;
  organizationId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteDriverDialog({
  driver, organizationId, onOpenChange, onSuccess,
}: DeleteDriverDialogProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!driver) return;
    setLoading(true);
    try {
      await driversAPI.delete(organizationId, driver.id);
      toast.success(t("drivers.toastDeleted"));
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("drivers.toastError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={!!driver} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("drivers.confirmDelete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("drivers.confirmDelete.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading}>
            {loading ? t("common.loading") : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 4.5 `apps/web/app/dashboard/drivers/page.tsx`

```typescript
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { useAuth } from "@/lib/hooks/use-auth";
import { driversAPI, type Driver } from "@/lib/frontend/api-client";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getDriverColumns } from "./columns";
import { DriverFormDialog } from "./driver-form-dialog";
import { DeleteDriverDialog } from "./delete-driver-dialog";

export default function DriversPage() {
  const { t } = useTranslation();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [deleteDriver, setDeleteDriver] = useState<Driver | null>(null);

  const fetchDrivers = useCallback(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    driversAPI
      .list(currentOrganization.id, { customerId: selectedCustomerId ?? undefined })
      .then((res) => setDrivers(res.data?.drivers ?? []))
      .catch((err) => setError(err?.response?.data?.message ?? t("common.error")))
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, selectedCustomerId, t]);

  useEffect(() => {
    if (!currentOrganization?.id) { setLoading(false); return; }
    fetchDrivers();
  }, [currentOrganization?.id, fetchDrivers]);

  const columns = useMemo(
    () => getDriverColumns(t, { onEdit: setEditDriver, onDelete: setDeleteDriver }),
    [t],
  );

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("navigation.items.drivers")}
        </h1>
        <p className="text-muted-foreground">{t("drivers.selectOrganization")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("navigation.items.drivers")}
          </h1>
          <p className="text-muted-foreground">{t("drivers.listDescription")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("drivers.createDriver")}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <DataTable
        columns={columns}
        data={drivers}
        loading={loading}
        filterColumn="name"
        filterPlaceholder={t("drivers.filterByName")}
      />

      <DriverFormDialog
        open={createOpen || !!editDriver}
        onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditDriver(null); } }}
        driver={editDriver}
        organizationId={currentOrganization.id}
        onSuccess={fetchDrivers}
        defaultCustomerId={selectedCustomerId}
      />

      <DeleteDriverDialog
        driver={deleteDriver}
        organizationId={currentOrganization.id}
        onOpenChange={(o) => { if (!o) setDeleteDriver(null); }}
        onSuccess={fetchDrivers}
      />
    </div>
  );
}
```

### 4.6 `apps/web/app/dashboard/drivers/[driverId]/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/i18n/useTranslation";
import { useAuth } from "@/lib/hooks/use-auth";
import { driversAPI, type Driver } from "@/lib/frontend/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { DriverFormDialog } from "../driver-form-dialog";
import { Pencil, ArrowLeft } from "lucide-react";
import { SkeletonTable } from "@/components/ui/skeleton-table";

export default function DriverDetailPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const params = useParams<{ driverId: string }>();
  const router = useRouter();

  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchDriver = () => {
    if (!currentOrganization?.id || !params.driverId) return;
    setLoading(true);
    driversAPI
      .get(currentOrganization.id, params.driverId)
      .then((res) => setDriver(res.data))
      .catch(() => setError(t("drivers.driverNotFound")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDriver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id, params.driverId]);

  if (loading) return <SkeletonTable />;

  if (error || !driver) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">{error ?? t("drivers.driverNotFound")}</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/drivers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("drivers.backToDrivers")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/drivers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{driver.name}</h1>
            <p className="text-muted-foreground">{t("drivers.driverInformation")}</p>
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          {t("common.edit")}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("drivers.sectionPersonal")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label={t("common.name")} value={driver.name} />
            <InfoRow label={t("drivers.cpf")} value={driver.cpf} mono />
            <InfoRow label={t("common.phone")} value={driver.phone} />
            <InfoRow label={t("common.email")} value={driver.email} />
            <InfoRow
              label={t("common.status")}
              value={
                <Badge variant={driver.active ? "default" : "secondary"}>
                  {driver.active ? t("common.active") : t("common.inactive")}
                </Badge>
              }
            />
            <InfoRow
              label={t("drivers.customer")}
              value={driver.customer?.name}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("drivers.sectionCnh")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label={t("drivers.cnh")} value={driver.cnh} mono />
            <InfoRow label={t("drivers.cnhCategory")} value={driver.cnhCategory} />
            <InfoRow
              label={t("drivers.cnhExpiry")}
              value={
                driver.cnhExpiry
                  ? new Date(driver.cnhExpiry).toLocaleDateString("pt-BR")
                  : undefined
              }
            />
          </CardContent>
        </Card>

        {driver.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t("drivers.notes")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{driver.notes}</p>
            </CardContent>
          </Card>
        )}

        {driver.vehicleAssignments && driver.vehicleAssignments.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t("drivers.vehicleAssignments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {driver.vehicleAssignments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <span className="font-mono">{a.vehicle?.plate ?? a.vehicleId}</span>
                    <span className="text-muted-foreground">
                      {a.vehicle?.name ?? ""}
                    </span>
                    {a.isPrimary && (
                      <Badge variant="outline">{t("drivers.primary")}</Badge>
                    )}
                    {!a.endDate && (
                      <Badge variant="default">{t("drivers.assignmentActive")}</Badge>
                    )}
                    {a.endDate && (
                      <Badge variant="secondary">{t("drivers.assignmentEnded")}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <DriverFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        driver={driver}
        organizationId={currentOrganization!.id}
        onSuccess={() => { setEditOpen(false); fetchDriver(); }}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: React.ReactNode | null;
  mono?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono" : ""}>
        {value ?? t("common.notAvailable")}
      </span>
    </div>
  );
}
```

### 4.7 Sidebar — `apps/web/components/navigation/app-sidebar.tsx`

**Alterações necessárias:**

1. Adicionar import do ícone `UserRound` de `lucide-react`
2. Adicionar chave i18n `navigation.items.drivers` em `pt.json`
3. Inserir item na seção `overview` do `mainNavigation`:

```typescript
// Adicionar ao import de ícones (linha existente com Car, Building, etc.):
import { Building, Building2, Car, Home, User, UserRound, Users } from "lucide-react";

// Adicionar no array items da seção overview, após o item "vehicles":
{
  name: t('navigation.items.drivers'),
  href: "/dashboard/drivers",
  icon: UserRound,
  current: pathname.startsWith("/dashboard/drivers"),
},
```

---

## 5. i18n — Chaves a adicionar em `apps/web/i18n/locales/pt.json`

Adicionar a seção `"drivers"` no objeto raiz do JSON (após a seção `"customers"`, por exemplo):

```json
"drivers": {
  "selectOrganization": "Selecione uma organização para ver os motoristas.",
  "listDescription": "Lista de motoristas. Gerencie vínculos com empresas e veículos.",
  "noDrivers": "Nenhum motorista cadastrado nesta organização.",
  "createDriver": "Novo motorista",
  "editDriver": "Editar motorista",
  "deleteDriver": "Excluir motorista",
  "driverNotFound": "Motorista não encontrado.",
  "driverInformation": "Informações do motorista",
  "backToDrivers": "← Voltar aos motoristas",
  "openActionsMenu": "Abrir menu de ações",
  "filterByName": "Filtrar por nome...",
  "nameRequired": "Informe o nome do motorista.",
  "namePlaceholder": "Nome completo",
  "emailInvalid": "Email inválido.",
  "cpf": "CPF",
  "cnh": "CNH",
  "cnhCategory": "Categoria CNH",
  "cnhExpiry": "Vencimento da CNH",
  "selectCnhCategory": "Selecione a categoria",
  "noCnhCategory": "Sem categoria",
  "customer": "Empresa",
  "selectCustomer": "Selecione a empresa",
  "filterCustomer": "Buscar empresa...",
  "noCustomer": "Nenhum (sem empresa)",
  "notes": "Observações",
  "notesPlaceholder": "Informações adicionais sobre o motorista...",
  "sectionPersonal": "Dados Pessoais",
  "sectionCnh": "Habilitação (CNH)",
  "vehicleAssignments": "Veículos vinculados",
  "primary": "Principal",
  "assignmentActive": "Ativo",
  "assignmentEnded": "Encerrado",
  "confirmDelete": {
    "title": "Excluir motorista",
    "description": "Tem certeza que deseja excluir este motorista? O registro será inativado (não removido permanentemente)."
  },
  "toastCreated": "Motorista criado com sucesso.",
  "toastUpdated": "Motorista atualizado com sucesso.",
  "toastDeleted": "Motorista inativado com sucesso.",
  "toastError": "Falha ao salvar motorista. Tente novamente."
}
```

Também adicionar em `"navigation.items"`:
```json
"drivers": "Motoristas"
```

---

## 6. RBAC — Integração futura (Wave 1)

Quando o módulo RBAC estiver implementado (Wave 1), realizar as seguintes ações no `DriversController`:

1. **Importar** `PermissionGuard` de `../auth/guards/permission.guard`
2. **Importar** `Permission` decorator de `../auth/decorators/permission.decorator`
3. **Importar** os enums `Module` e `Action` de `../auth/enums/permission.enum`
4. **Adicionar** `PermissionGuard` no `@UseGuards` do controller
5. **Descomentar** os decorators `@Permission(Module.DRIVERS, Action.XXX)` em cada endpoint

Cada endpoint mapeia para:

| Endpoint | Module | Action |
|---|---|---|
| `GET /drivers` | `DRIVERS` | `VIEW` |
| `POST /drivers` | `DRIVERS` | `CREATE` |
| `GET /drivers/:id` | `DRIVERS` | `VIEW` |
| `PATCH /drivers/:id` | `DRIVERS` | `EDIT` |
| `DELETE /drivers/:id` | `DRIVERS` | `DELETE` |
| `POST /drivers/:id/assign-vehicle` | `DRIVERS` | `EDIT` |
| `DELETE /drivers/:id/assign-vehicle/:vehicleId` | `DRIVERS` | `EDIT` |

O enum `Module.DRIVERS` já está definido no `ARCHITECTURE.md` e deve estar presente no schema do RBAC.

---

## 7. Ordem de Implementação (Tasks Numeradas)

Execute as tasks nesta ordem exata. Cada task deve ser verificada antes de avançar.

### TASK 1 — Schema Prisma
- [ ] 1.1 Adicionar models `Driver` e `DriverVehicleAssignment` no `schema.prisma`
- [ ] 1.2 Adicionar relações reversas em `Customer`, `Vehicle` e `Organization`
- [ ] 1.3 Rodar `npx prisma migrate dev --name add_drivers_module` em `apps/api/`
- [ ] 1.4 Verificar que a migration foi gerada sem erros e o client foi regenerado

### TASK 2 — Códigos de API
- [ ] 2.1 Adicionar `DRIVER_NOT_FOUND`, `DRIVER_ASSIGNMENT_NOT_FOUND` em `apps/api/src/common/api-codes.enum.ts`
- [ ] 2.2 Verificar se `VEHICLE_NOT_FOUND` e `COMMON_ALREADY_EXISTS` já existem; adicionar se não

### TASK 3 — Backend: DTOs
- [ ] 3.1 Criar `apps/api/src/drivers/drivers.dto.ts` com todos os DTOs descritos na seção 3.2

### TASK 4 — Backend: Service
- [ ] 4.1 Criar `apps/api/src/drivers/drivers.service.ts` conforme seção 3.3
- [ ] 4.2 Garantir que todas as queries filtram por `organizationId`

### TASK 5 — Backend: Controller
- [ ] 5.1 Criar `apps/api/src/drivers/drivers.controller.ts` conforme seção 3.4
- [ ] 5.2 Verificar que todos os endpoints têm o guard `JwtAuthGuard`
- [ ] 5.3 Verificar que os placeholders RBAC estão comentados com TODO

### TASK 6 — Backend: Module + Registration
- [ ] 6.1 Criar `apps/api/src/drivers/drivers.module.ts` conforme seção 3.1
- [ ] 6.2 Adicionar `DriversModule` ao array `imports` de `apps/api/src/app.module.ts`
- [ ] 6.3 Rodar `pnpm --filter api build` (ou `tsc --noEmit`) para verificar compilação

### TASK 7 — Frontend: API Client
- [ ] 7.1 Adicionar interfaces `Driver`, `DriverVehicleAssignment`, `CreateDriverPayload`, `UpdateDriverPayload` em `api-client.ts`
- [ ] 7.2 Adicionar objeto `driversAPI` em `api-client.ts`

### TASK 8 — Frontend: i18n
- [ ] 8.1 Adicionar seção `"drivers"` completa em `apps/web/i18n/locales/pt.json`
- [ ] 8.2 Adicionar `"drivers": "Motoristas"` em `navigation.items`
- [ ] 8.3 Verificar JSON válido após edição (sem trailing commas ou syntax errors)

### TASK 9 — Frontend: Componentes
- [ ] 9.1 Criar `apps/web/app/dashboard/drivers/columns.tsx`
- [ ] 9.2 Criar `apps/web/app/dashboard/drivers/driver-form-dialog.tsx`
- [ ] 9.3 Criar `apps/web/app/dashboard/drivers/delete-driver-dialog.tsx`

### TASK 10 — Frontend: Páginas
- [ ] 10.1 Criar `apps/web/app/dashboard/drivers/page.tsx` (lista)
- [ ] 10.2 Criar `apps/web/app/dashboard/drivers/[driverId]/page.tsx` (detalhe)

### TASK 11 — Frontend: Sidebar
- [ ] 11.1 Adicionar `UserRound` ao import de ícones em `app-sidebar.tsx`
- [ ] 11.2 Adicionar item `Motoristas` na seção `overview` do sidebar

### TASK 12 — Verificação final
- [ ] 12.1 Executar todos os testes de verificação descritos na seção 8
- [ ] 12.2 Garantir que não há TypeScript errors (`tsc --noEmit`)

---

## 8. Testes de Verificação

### 8.1 Backend (via curl ou Postman/Insomnia)

Assumindo servidor rodando em `http://localhost:3001` e token JWT válido:

```bash
ORG_ID="<id da organização>"
TOKEN="Bearer <access_token>"

# 1. Listar motoristas (deve retornar { drivers: [] } inicialmente)
curl -H "Authorization: $TOKEN" \
  "http://localhost:3001/api/organizations/$ORG_ID/drivers"

# 2. Criar motorista
curl -X POST -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"João Silva","cpf":"123.456.789-00","cnhCategory":"B"}' \
  "http://localhost:3001/api/organizations/$ORG_ID/drivers"
# Esperado: 201 com objeto driver

# 3. Listar novamente — deve aparecer João Silva
curl -H "Authorization: $TOKEN" \
  "http://localhost:3001/api/organizations/$ORG_ID/drivers"

# 4. Atualizar motorista
DRIVER_ID="<id do motorista criado>"
curl -X PATCH -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":"11999998888"}' \
  "http://localhost:3001/api/organizations/$ORG_ID/drivers/$DRIVER_ID"
# Esperado: 200 com phone atualizado

# 5. Soft delete
curl -X DELETE -H "Authorization: $TOKEN" \
  "http://localhost:3001/api/organizations/$ORG_ID/drivers/$DRIVER_ID"
# Esperado: 200 ou 204; driver.active = false no banco

# 6. CPF duplicado — deve retornar 409
curl -X POST -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Outro","cpf":"123.456.789-00"}' \
  "http://localhost:3001/api/organizations/$ORG_ID/drivers"
# Esperado: 409 Conflict

# 7. Cross-org protection — usar orgId diferente
# Esperado: 403 Forbidden
```

### 8.2 Frontend (manual — browser)

1. Navegar para `/dashboard/drivers`
   - Verificar que a página carrega sem erros
   - Verificar que o item "Motoristas" está ativo no sidebar
2. Clicar em "Novo motorista"
   - Preencher nome (obrigatório) e demais campos
   - Salvar — deve aparecer na lista
3. Clicar em "Editar" via menu de ações
   - Modificar campo e salvar
   - Verificar que a alteração aparece na tabela
4. Clicar em "Visualizar" via menu de ações
   - Verificar página de detalhe `/dashboard/drivers/[id]`
   - Verificar botão "Editar" na página de detalhe
5. Clicar em "Excluir" via menu de ações
   - Confirmar no dialog
   - Verificar que o motorista some da lista (soft delete — `active = false`)
6. Filtrar pelo nome na barra de pesquisa da DataTable
7. Verificar responsividade em tela menor (640px)

### 8.3 Verificações de qualidade

```bash
# No diretório raiz do projeto:

# TypeScript backend
cd apps/api && npx tsc --noEmit

# TypeScript frontend
cd apps/web && npx tsc --noEmit

# JSON válido
node -e "JSON.parse(require('fs').readFileSync('apps/web/i18n/locales/pt.json', 'utf8'))"
```

---

## 9. Notas para o Agente Executor

1. **Prisma types**: após rodar `prisma migrate dev`, o Prisma Client será regenerado. Se houver erros de tipo `Driver` not found, rodar `npx prisma generate` manualmente.

2. **`ApiCode.VEHICLE_NOT_FOUND`**: verificar se existe antes de criar. Buscar em `apps/api/src/common/api-codes.enum.ts`.

3. **`useAuth().selectedCustomerId`**: este hook já existe e já é usado em `vehicles/page.tsx`. Reutilizar o mesmo padrão.

4. **`SkeletonTable`**: componente já existe em `apps/web/components/ui/skeleton-table.tsx`. Importar diretamente.

5. **`DataTable`**: já existe em `apps/web/components/ui/data-table.tsx`. Verificar props disponíveis (especialmente `filterColumn` e `filterPlaceholder`) antes de usar — podem variar do exemplo acima.

6. **`AlertDialog`**: usado no `delete-driver-dialog.tsx`. Importar de `@/components/ui/alert-dialog` (shadcn/ui).

7. **Soft delete vs. hard delete**: o `DELETE /drivers/:id` faz soft delete (active = false). Se o frontend quiser mostrar motoristas inativos no futuro, adicionar query param `includeInactive=true` ao endpoint de listagem.

8. **Foto do motorista**: o campo `photo` aceita apenas URL por enquanto. Upload real (S3/R2/Cloudflare R2) é fase futura — não implementar agora.

9. **CNH Expiry**: armazenada como `DateTime` no Prisma. O frontend envia ISO 8601 string (`YYYY-MM-DD`). A conversão `new Date(dto.cnhExpiry)` no service está correta para datas sem horário (midnight UTC).

10. **Paginação**: não incluída nesta versão. Se a lista de motoristas crescer muito, o próximo passo natural é adicionar paginação no service (skip/take) e no DataTable.
