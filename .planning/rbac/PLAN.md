# PLAN.md — Módulo RBAC / Roles
> RS Frotas — Wave 1 (Fundação)
> Lido e executado por agente Haiku. Siga cada task **na ordem exata**. Não pule steps. Não tome decisões de arquitetura — tudo já está decidido aqui.

---

## 1. Objetivo e Contexto

### Por que este módulo existe
Atualmente todos os membros de uma organização têm uma de três roles fixas (`OWNER`, `ADMIN`, `MEMBER`) definidas num enum do Prisma. Isso é insuficiente para o sistema de gestão de frotas porque:
- Não há controle granular de quais funcionalidades cada usuário pode acessar
- Não existe diferença entre um motorista (só preenche checklist) e um operador (vê frota)
- Não há como criar roles customizadas por organização
- Não existe conceito de "usuário de sistema" (suporte RS Frotas) que acessa múltiplas orgs

### O que o módulo resolve
1. Substitui o enum `Role` (OWNER/ADMIN/MEMBER) em `OrganizationMember` por uma FK para um model `Role` com permissões granulares
2. Adiciona o campo `User.isSystemUser` para usuários de suporte
3. Cria roles padrão do sistema (COMPANY_OWNER, COMPANY_ADMIN, OPERATOR, VIEWER, DRIVER)
4. Adiciona `@Permission` decorator e `PermissionGuard` para proteger endpoints futuros
5. Cria API REST para gerenciar roles (`/organizations/:orgId/roles`)
6. Atualiza o frontend `/team` para exibir nome da role ao invés do enum

### Impacto em outros módulos
- TODOS os módulos futuros (FUEL, CHECKLIST, etc.) dependem de `PermissionGuard`
- Este módulo deve ser implementado ANTES de qualquer outro módulo Wave 2+
- A migração deve ser zero-downtime: dados existentes são preservados

---

## 2. Schema Prisma — Mudanças Exatas

### 2.1 Novos enums a adicionar no `schema.prisma`

Adicione APÓS o enum `InvitationStatus` existente (linha 236 do arquivo atual):

```prisma
enum RoleModule {
  VEHICLES
  TRACKING
  COMPANIES
  USERS
  REPORTS
  DRIVERS
  DOCUMENTS
  FUEL
  CHECKLIST
  INCIDENTS
  TELEMETRY
  FINANCIAL

  @@map("role_module")
}

enum RoleAction {
  VIEW
  CREATE
  EDIT
  DELETE

  @@map("role_action")
}

enum RoleScope {
  ALL
  ASSIGNED

  @@map("role_scope")
}
```

> ATENÇÃO: Use nomes `RoleModule`, `RoleAction`, `RoleScope` (com prefixo "Role") para evitar conflito com nomes genéricos que podem existir futuramente. Os `@@map` garantem que no banco o nome seja sem prefixo.

### 2.2 Novo model `Role`

Adicione APÓS o enum `RoleScope` (antes de `model Notification`):

```prisma
model Role {
  id             String   @id @default(cuid())
  organizationId String?
  name           String
  description    String?
  isSystem       Boolean  @default(false)
  color          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization?      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  permissions  RolePermission[]
  members      OrganizationMember[]

  @@index([organizationId])
  @@map("roles")
}
```

### 2.3 Novo model `RolePermission`

Adicione APÓS o model `Role`:

```prisma
model RolePermission {
  id      String     @id @default(cuid())
  roleId  String
  module  RoleModule
  actions RoleAction[]
  scope   RoleScope  @default(ALL)

  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([roleId, module])
  @@map("role_permissions")
}
```

### 2.4 Alteração em `model User`

Encontre o bloco do model `User` (linha 10-33 atual). Adicione `isSystemUser` APÓS a linha `isSuperAdmin Boolean @default(false)`:

```prisma
  // Admin access
  isSuperAdmin Boolean @default(false)
  isSystemUser Boolean @default(false)  // ← ADICIONAR ESTA LINHA
```

### 2.5 Alteração em `model Organization`

Encontre o bloco do model `Organization`. Adicione a relação com roles na seção de Relations:

```prisma
  // Relations
  memberships    OrganizationMember[]
  invitations    Invitation[]
  notifications  Notification[]
  vehicles       Vehicle[]
  trackerDevices TrackerDevice[]
  customers      Customer[]
  roles          Role[]           // ← ADICIONAR ESTA LINHA
```

### 2.6 Alteração em `model OrganizationMember`

ATENÇÃO: Esta é a mudança mais crítica. O campo `role Role @default(MEMBER)` será substituído por `roleId String` + relação. O enum `Role` PERMANECE no schema porque é usado em `model Invitation`.

Substituir o model `OrganizationMember` inteiro por:

```prisma
model OrganizationMember {
  id                 String   @id @default(cuid())
  roleId             String
  userId             String
  organizationId     String
  customerRestricted Boolean  @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  role         Role         @relation(fields: [roleId], references: [id])
  customers    OrganizationMemberCustomer[]

  @@unique([userId, organizationId])
  @@map("organizationMembers")
}
```

> O campo antigo era: `role Role @default(MEMBER)`
> O campo novo é: `roleId String` + `role Role @relation(...)`
> O enum `Role` (OWNER/ADMIN/MEMBER) continua existindo para `model Invitation`

### 2.7 Estado final do enum `Role` (MANTER SEM ALTERAÇÃO)

```prisma
enum Role {
  OWNER
  ADMIN
  MEMBER
}
```

Este enum é mantido porque `model Invitation` ainda usa `role Role @default(MEMBER)`. A migração completa do `Invitation` é fora do escopo deste plano.

---

## 3. Migration Strategy

### 3.1 Ordem das migrations

Execute exatamente nesta ordem:

**Migration 1:** Criar tabelas novas (roles, role_permissions) e adicionar isSystemUser
- Cria tabelas `roles` e `role_permissions`
- Adiciona coluna `isSystemUser` em `users`
- Adiciona coluna `roleId` em `organizationMembers` (NULLABLE temporariamente)

**Migration 2:** Popular dados (feito via seed — ver seção 4)
- Cria as 5 roles do sistema com suas permissões

**Migration 3:** Migrar dados existentes
- Para cada `OrganizationMember` com `role = 'OWNER'` → atribuir roleId da role `COMPANY_OWNER`
- Para cada `OrganizationMember` com `role = 'ADMIN'` → atribuir roleId da role `COMPANY_ADMIN`
- Para cada `OrganizationMember` com `role = 'MEMBER'` → atribuir roleId da role `VIEWER`

**Migration 4:** Tornar `roleId` NOT NULL e remover coluna `role` (enum) de `organizationMembers`

### 3.2 Arquivo de migration manual

O agente deve criar o arquivo de migration SQL manualmente porque o Prisma não consegue criar uma migration que seja ao mesmo tempo:
1. Adiciona coluna nullable
2. Popula com dados
3. Torna a coluna NOT NULL

O arquivo deve ser criado em: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_rbac_roles/migration.sql`

Conteúdo do migration SQL (etapas 1, 3 e 4 — etapa 2 é o seed):

```sql
-- Step 1: Add isSystemUser to users
ALTER TABLE "users" ADD COLUMN "isSystemUser" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Create roles table
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create role_permissions table
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" "role_module" NOT NULL,
    "actions" "role_action"[],
    "scope" "role_scope" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- Step 4: Create enums
CREATE TYPE "role_module" AS ENUM ('VEHICLES', 'TRACKING', 'COMPANIES', 'USERS', 'REPORTS', 'DRIVERS', 'DOCUMENTS', 'FUEL', 'CHECKLIST', 'INCIDENTS', 'TELEMETRY', 'FINANCIAL');
CREATE TYPE "role_action" AS ENUM ('VIEW', 'CREATE', 'EDIT', 'DELETE');
CREATE TYPE "role_scope" AS ENUM ('ALL', 'ASSIGNED');

-- Step 5: Add indexes and constraints for roles
CREATE INDEX "roles_organizationId_idx" ON "roles"("organizationId");
ALTER TABLE "roles" ADD CONSTRAINT "roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 6: Add constraints for role_permissions
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_module_key" UNIQUE ("roleId", "module");

-- Step 7: Add nullable roleId to organizationMembers
ALTER TABLE "organizationMembers" ADD COLUMN "roleId" TEXT;

-- NOTE: After running seed to populate roles, run the data migration script (seed --migrate-roles)
-- Then run the final steps below:

-- Step 8 (run AFTER seed): Set roleId based on current role enum
-- UPDATE "organizationMembers" SET "roleId" = (
--   SELECT id FROM roles WHERE name = 'Dono da Empresa' AND "isSystem" = true LIMIT 1
-- ) WHERE role = 'OWNER';
-- UPDATE "organizationMembers" SET "roleId" = (
--   SELECT id FROM roles WHERE name = 'Administrador' AND "isSystem" = true LIMIT 1
-- ) WHERE role = 'ADMIN';
-- UPDATE "organizationMembers" SET "roleId" = (
--   SELECT id FROM roles WHERE name = 'Visualizador' AND "isSystem" = true LIMIT 1
-- ) WHERE role = 'MEMBER';

-- Step 9 (run AFTER data migration): Make roleId NOT NULL
-- ALTER TABLE "organizationMembers" ALTER COLUMN "roleId" SET NOT NULL;
-- ALTER TABLE "organizationMembers" ADD CONSTRAINT "organizationMembers_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON UPDATE CASCADE;

-- Step 10 (run AFTER Step 9): Remove old role column
-- ALTER TABLE "organizationMembers" DROP COLUMN "role";
```

> IMPORTANTE: Os Steps 8-10 (comentados) são executados pela função `migrateExistingRoles()` no seed.ts, não diretamente neste SQL.

---

## 4. Seed — Roles Padrão do Sistema

### 4.1 Definição completa das roles padrão

| Chave interna | name (pt-BR) | isSystem | color |
|---|---|---|---|
| `COMPANY_OWNER` | Dono da Empresa | true | `#7C3AED` (roxo) |
| `COMPANY_ADMIN` | Administrador | true | `#2563EB` (azul) |
| `OPERATOR` | Operador | true | `#059669` (verde) |
| `VIEWER` | Visualizador | true | `#6B7280` (cinza) |
| `DRIVER` | Motorista | true | `#D97706` (âmbar) |

### 4.2 Permissões por role (tabela completa)

**COMPANY_OWNER** — escopo ALL em tudo:
```
VEHICLES:   VIEW, CREATE, EDIT, DELETE — scope: ALL
TRACKING:   VIEW — scope: ALL
COMPANIES:  VIEW, CREATE, EDIT, DELETE — scope: ALL
USERS:      VIEW, CREATE, EDIT — scope: ALL  (sem DELETE intencional — owner não deleta outro owner)
REPORTS:    VIEW — scope: ALL
DRIVERS:    VIEW, CREATE, EDIT, DELETE — scope: ALL
DOCUMENTS:  VIEW, CREATE, EDIT, DELETE — scope: ALL
FUEL:       VIEW, CREATE, EDIT, DELETE — scope: ALL
CHECKLIST:  VIEW, CREATE, EDIT, DELETE — scope: ALL
INCIDENTS:  VIEW, CREATE, EDIT, DELETE — scope: ALL
TELEMETRY:  VIEW — scope: ALL
FINANCIAL:  VIEW, CREATE, EDIT, DELETE — scope: ALL
```

**COMPANY_ADMIN** — sem gestão de roles, sem delete de usuários:
```
VEHICLES:   VIEW, CREATE, EDIT — scope: ALL
TRACKING:   VIEW — scope: ALL
COMPANIES:  VIEW, CREATE, EDIT — scope: ALL
USERS:      VIEW, CREATE — scope: ALL
REPORTS:    VIEW — scope: ALL
DRIVERS:    VIEW, CREATE, EDIT — scope: ALL
DOCUMENTS:  VIEW, CREATE, EDIT — scope: ALL
FUEL:       VIEW, CREATE, EDIT — scope: ALL
CHECKLIST:  VIEW, CREATE, EDIT — scope: ALL
INCIDENTS:  VIEW, CREATE, EDIT — scope: ALL
TELEMETRY:  VIEW — scope: ALL
FINANCIAL:  VIEW, CREATE, EDIT — scope: ALL
```

**OPERATOR** — acesso operacional básico:
```
VEHICLES:   VIEW — scope: ALL
TRACKING:   VIEW — scope: ALL
COMPANIES:  VIEW — scope: ALL
CHECKLIST:  VIEW, CREATE, EDIT — scope: ALL
FUEL:       VIEW, CREATE — scope: ALL
INCIDENTS:  VIEW, CREATE — scope: ALL
DRIVERS:    VIEW — scope: ALL
```
(USERS, REPORTS, DOCUMENTS, TELEMETRY, FINANCIAL: sem acesso)

**VIEWER** — somente leitura:
```
VEHICLES:   VIEW — scope: ASSIGNED
TRACKING:   VIEW — scope: ASSIGNED
COMPANIES:  VIEW — scope: ASSIGNED
REPORTS:    VIEW — scope: ASSIGNED
DRIVERS:    VIEW — scope: ASSIGNED
FUEL:       VIEW — scope: ASSIGNED
CHECKLIST:  VIEW — scope: ASSIGNED
INCIDENTS:  VIEW — scope: ASSIGNED
```
(USERS, DOCUMENTS, TELEMETRY, FINANCIAL: sem acesso)

**DRIVER** — motorista, acesso próprio apenas:
```
CHECKLIST:  CREATE — scope: ASSIGNED
FUEL:       CREATE — scope: ASSIGNED
INCIDENTS:  VIEW, CREATE — scope: ASSIGNED
```
(todos os outros módulos: sem acesso)

### 4.3 Código a adicionar em `apps/api/prisma/seed.ts`

Adicione as seguintes funções e adicione chamada no `main()`. O arquivo seed.ts atual está em `/Users/gabrielleandrojuniorsiqueira/Projects/gleandroj/rs-frotas/apps/api/prisma/seed.ts`.

Adicione este import no topo do arquivo (após os imports existentes):
```typescript
// Adicionar após: import * as bcrypt from "bcrypt";
// Nenhum import adicional necessário — PrismaClient já está importado
```

Adicione estas funções antes do `main()`:

```typescript
// ============================================================
// RBAC: System Roles Seed
// ============================================================

type RoleKey = 'COMPANY_OWNER' | 'COMPANY_ADMIN' | 'OPERATOR' | 'VIEWER' | 'DRIVER';

interface RoleDefinition {
  name: string;
  description: string;
  color: string;
  permissions: Array<{
    module: string;
    actions: string[];
    scope: string;
  }>;
}

const SYSTEM_ROLES: Record<RoleKey, RoleDefinition> = {
  COMPANY_OWNER: {
    name: 'Dono da Empresa',
    description: 'Acesso total à organização. Gerencia todos os módulos.',
    color: '#7C3AED',
    permissions: [
      { module: 'VEHICLES',  actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'TRACKING',  actions: ['VIEW'],                          scope: 'ALL' },
      { module: 'COMPANIES', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'USERS',     actions: ['VIEW','CREATE','EDIT'],          scope: 'ALL' },
      { module: 'REPORTS',   actions: ['VIEW'],                          scope: 'ALL' },
      { module: 'DRIVERS',   actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'DOCUMENTS', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'FUEL',      actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'CHECKLIST', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'INCIDENTS', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'TELEMETRY', actions: ['VIEW'],                          scope: 'ALL' },
      { module: 'FINANCIAL', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
    ],
  },
  COMPANY_ADMIN: {
    name: 'Administrador',
    description: 'Administrador da organização. Sem gestão de roles e sem deletar usuários.',
    color: '#2563EB',
    permissions: [
      { module: 'VEHICLES',  actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'TRACKING',  actions: ['VIEW'],                 scope: 'ALL' },
      { module: 'COMPANIES', actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'USERS',     actions: ['VIEW','CREATE'],        scope: 'ALL' },
      { module: 'REPORTS',   actions: ['VIEW'],                 scope: 'ALL' },
      { module: 'DRIVERS',   actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'DOCUMENTS', actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'FUEL',      actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'CHECKLIST', actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'INCIDENTS', actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'TELEMETRY', actions: ['VIEW'],                 scope: 'ALL' },
      { module: 'FINANCIAL', actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
    ],
  },
  OPERATOR: {
    name: 'Operador',
    description: 'Acesso operacional. Vê frotas e rastreamento, preenche checklists e abastecimentos.',
    color: '#059669',
    permissions: [
      { module: 'VEHICLES',  actions: ['VIEW'],                 scope: 'ALL' },
      { module: 'TRACKING',  actions: ['VIEW'],                 scope: 'ALL' },
      { module: 'COMPANIES', actions: ['VIEW'],                 scope: 'ALL' },
      { module: 'DRIVERS',   actions: ['VIEW'],                 scope: 'ALL' },
      { module: 'CHECKLIST', actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'FUEL',      actions: ['VIEW','CREATE'],        scope: 'ALL' },
      { module: 'INCIDENTS', actions: ['VIEW','CREATE'],        scope: 'ALL' },
    ],
  },
  VIEWER: {
    name: 'Visualizador',
    description: 'Somente leitura. Acessa dados do seu escopo de empresas.',
    color: '#6B7280',
    permissions: [
      { module: 'VEHICLES',  actions: ['VIEW'], scope: 'ASSIGNED' },
      { module: 'TRACKING',  actions: ['VIEW'], scope: 'ASSIGNED' },
      { module: 'COMPANIES', actions: ['VIEW'], scope: 'ASSIGNED' },
      { module: 'REPORTS',   actions: ['VIEW'], scope: 'ASSIGNED' },
      { module: 'DRIVERS',   actions: ['VIEW'], scope: 'ASSIGNED' },
      { module: 'FUEL',      actions: ['VIEW'], scope: 'ASSIGNED' },
      { module: 'CHECKLIST', actions: ['VIEW'], scope: 'ASSIGNED' },
      { module: 'INCIDENTS', actions: ['VIEW'], scope: 'ASSIGNED' },
    ],
  },
  DRIVER: {
    name: 'Motorista',
    description: 'Motorista. Preenche checklists e abastecimentos próprios.',
    color: '#D97706',
    permissions: [
      { module: 'CHECKLIST', actions: ['CREATE'],        scope: 'ASSIGNED' },
      { module: 'FUEL',      actions: ['CREATE'],        scope: 'ASSIGNED' },
      { module: 'INCIDENTS', actions: ['VIEW','CREATE'], scope: 'ASSIGNED' },
    ],
  },
};

async function seedSystemRoles(): Promise<Record<RoleKey, string>> {
  console.log("🔐 Seeding System Roles...");

  const roleIds: Partial<Record<RoleKey, string>> = {};

  for (const [key, def] of Object.entries(SYSTEM_ROLES) as [RoleKey, RoleDefinition][]) {
    // Check if role already exists (global system role: organizationId IS NULL)
    const existing = await prisma.role.findFirst({
      where: { name: def.name, isSystem: true, organizationId: null },
    });

    if (existing) {
      console.log(`   ✓ Role already exists: ${def.name}`);
      roleIds[key] = existing.id;
      continue;
    }

    const role = await prisma.role.create({
      data: {
        name: def.name,
        description: def.description,
        color: def.color,
        isSystem: true,
        organizationId: null, // Global system role
        permissions: {
          create: def.permissions.map((p) => ({
            module: p.module as any,
            actions: p.actions as any,
            scope: p.scope as any,
          })),
        },
      },
    });

    console.log(`   ✅ Role created: ${def.name} (${role.id})`);
    roleIds[key] = role.id;
  }

  return roleIds as Record<RoleKey, string>;
}

async function migrateExistingRoles(roleIds: Record<RoleKey, string>): Promise<void> {
  console.log("🔄 Migrating existing OrganizationMember roles...");

  // Count members that need migration (those without roleId)
  const membersWithoutRole = await prisma.organizationMember.findMany({
    where: { roleId: null } as any, // roleId may be nullable before migration
  });

  if (membersWithoutRole.length === 0) {
    console.log("   ✓ No members need migration (all have roleId set)");
    return;
  }

  console.log(`   Found ${membersWithoutRole.length} members to migrate`);

  // We need to use raw SQL because the old `role` column no longer exists in Prisma schema
  // but may still exist in the database during migration
  const rawMembers = await prisma.$queryRaw<Array<{ id: string; role: string }>>`
    SELECT id, role FROM "organizationMembers" WHERE "roleId" IS NULL
  `;

  const roleMapping: Record<string, string> = {
    'OWNER': roleIds.COMPANY_OWNER,
    'ADMIN': roleIds.COMPANY_ADMIN,
    'MEMBER': roleIds.VIEWER,
  };

  let migrated = 0;
  for (const member of rawMembers) {
    const targetRoleId = roleMapping[member.role];
    if (!targetRoleId) {
      console.warn(`   ⚠️  Unknown role '${member.role}' for member ${member.id}, defaulting to VIEWER`);
    }
    await prisma.$executeRaw`
      UPDATE "organizationMembers"
      SET "roleId" = ${targetRoleId ?? roleIds.VIEWER}
      WHERE id = ${member.id}
    `;
    migrated++;
  }

  console.log(`   ✅ Migrated ${migrated} members`);
}
```

Modifique a função `main()` existente para chamar as novas funções. Encontre o bloco `async function main()` e adicione após `await seedAppSettings()`:

```typescript
  // Seed System Roles (RBAC)
  console.log("🔐 Seeding System Roles (RBAC)");
  console.log("-------------------------------");
  const roleIds = await seedSystemRoles();
  console.log("");

  // Migrate existing OrganizationMember roles
  console.log("🔄 Migrating existing member roles");
  console.log("-----------------------------------");
  await migrateExistingRoles(roleIds);
  console.log("");
```

Também atualize o seed do admin no `seedAdminUser()` para usar `roleId` ao invés de `role`:

Na função `seedAdminUser()`, encontre:
```typescript
  const organization = await prisma.organization.create({
    data: {
      ...
      memberships: {
        create: {
          userId: adminUser.id,
          role: "OWNER",
        },
      },
    },
```

Substitua por (o roleId será obtido dinamicamente via seed de roles):
```typescript
  // Get COMPANY_OWNER role id (must exist before calling this function)
  const ownerRole = await prisma.role.findFirst({
    where: { name: 'Dono da Empresa', isSystem: true, organizationId: null },
  });

  const organization = await prisma.organization.create({
    data: {
      name: `${orgName}`,
      description: "Organização padrão do administrador",
      currency: "BRL",
      memberships: {
        create: {
          userId: adminUser.id,
          roleId: ownerRole?.id ?? '', // Will be set by migration if empty
        },
      },
    },
  });
```

> NOTA: A função `seedAdminUser()` deve ser chamada APÓS `seedSystemRoles()` no `main()`. Altere a ordem no main para: 1) seedAppSettings, 2) seedSystemRoles, 3) migrateExistingRoles, 4) seedAdminUser.

---

## 5. Backend — Arquivos a Criar/Modificar

### 5.1 Novo módulo: `apps/api/src/roles/`

Criar 4 arquivos:

#### `apps/api/src/roles/roles.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
```

#### `apps/api/src/roles/roles.dto.ts`
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Mirror the Prisma enums — keep in sync with schema.prisma
export enum RoleModuleEnum {
  VEHICLES  = 'VEHICLES',
  TRACKING  = 'TRACKING',
  COMPANIES = 'COMPANIES',
  USERS     = 'USERS',
  REPORTS   = 'REPORTS',
  DRIVERS   = 'DRIVERS',
  DOCUMENTS = 'DOCUMENTS',
  FUEL      = 'FUEL',
  CHECKLIST = 'CHECKLIST',
  INCIDENTS = 'INCIDENTS',
  TELEMETRY = 'TELEMETRY',
  FINANCIAL = 'FINANCIAL',
}

export enum RoleActionEnum {
  VIEW   = 'VIEW',
  CREATE = 'CREATE',
  EDIT   = 'EDIT',
  DELETE = 'DELETE',
}

export enum RoleScopeEnum {
  ALL      = 'ALL',
  ASSIGNED = 'ASSIGNED',
}

export class PermissionDto {
  @ApiProperty({ enum: RoleModuleEnum })
  @IsEnum(RoleModuleEnum)
  module: RoleModuleEnum;

  @ApiProperty({ enum: RoleActionEnum, isArray: true })
  @IsArray()
  @IsEnum(RoleActionEnum, { each: true })
  actions: RoleActionEnum[];

  @ApiProperty({ enum: RoleScopeEnum })
  @IsEnum(RoleScopeEnum)
  scope: RoleScopeEnum;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Financeiro' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Acesso ao módulo financeiro' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#EF4444' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color e.g. #FF0000' })
  color?: string;

  @ApiProperty({ type: () => [PermissionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions: PermissionDto[];
}

export class UpdateRoleDto {
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
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color e.g. #FF0000' })
  color?: string;

  @ApiPropertyOptional({ type: () => [PermissionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];
}

export class RolePermissionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: RoleModuleEnum })
  module: RoleModuleEnum;

  @ApiProperty({ enum: RoleActionEnum, isArray: true })
  actions: RoleActionEnum[];

  @ApiProperty({ enum: RoleScopeEnum })
  scope: RoleScopeEnum;
}

export class RoleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  isSystem: boolean;

  @ApiPropertyOptional()
  color?: string | null;

  @ApiPropertyOptional()
  organizationId?: string | null;

  @ApiProperty({ type: () => [RolePermissionResponseDto] })
  permissions: RolePermissionResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class RolesListResponseDto {
  @ApiProperty({ type: () => [RoleResponseDto] })
  roles: RoleResponseDto[];
}

export class RoleCreatedResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => RoleResponseDto })
  role: RoleResponseDto;
}

export class RoleUpdatedResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => RoleResponseDto })
  role: RoleResponseDto;
}

export class RoleDeletedResponseDto {
  @ApiProperty()
  message: string;
}
```

#### `apps/api/src/roles/roles.service.ts`
```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRoleDto,
  RoleCreatedResponseDto,
  RoleDeletedResponseDto,
  RoleResponseDto,
  RolesListResponseDto,
  RoleUpdatedResponseDto,
  UpdateRoleDto,
} from './roles.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  private formatRole(role: any): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      color: role.color,
      organizationId: role.organizationId,
      permissions: role.permissions.map((p: any) => ({
        id: p.id,
        module: p.module,
        actions: p.actions,
        scope: p.scope,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  /**
   * List all roles available for an organization:
   * - Global system roles (organizationId IS NULL)
   * - Org-specific roles (organizationId = orgId)
   */
  async getRoles(
    userId: string,
    organizationId: string,
  ): Promise<RolesListResponseDto> {
    // Verify user is member of org
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
    });
    if (!membership) {
      throw new ForbiddenException('AUTH_FORBIDDEN');
    }

    const roles = await this.prisma.role.findMany({
      where: {
        OR: [
          { organizationId: null },       // global system roles
          { organizationId },             // org-specific roles
        ],
      },
      include: { permissions: true },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });

    return { roles: roles.map(this.formatRole) };
  }

  /**
   * Get one role by id. Must belong to org or be global.
   */
  async getRole(
    userId: string,
    organizationId: string,
    roleId: string,
  ): Promise<RoleResponseDto> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
    });
    if (!membership) {
      throw new ForbiddenException('AUTH_FORBIDDEN');
    }

    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ organizationId: null }, { organizationId }],
      },
      include: { permissions: true },
    });

    if (!role) throw new NotFoundException('ROLE_NOT_FOUND');
    return this.formatRole(role);
  }

  /**
   * Create a custom role for an organization.
   * Only OWNER-tier members can create roles (checked via role permissions USERS:EDIT).
   * System roles (isSystem=true) cannot be created via this endpoint.
   */
  async createRole(
    userId: string,
    organizationId: string,
    data: CreateRoleDto,
  ): Promise<RoleCreatedResponseDto> {
    // Must be COMPANY_OWNER or COMPANY_ADMIN (check USERS module EDIT permission)
    await this.requireUsersEditPermission(userId, organizationId);

    // Check if name already exists in this org
    const existing = await this.prisma.role.findFirst({
      where: { name: data.name, organizationId },
    });
    if (existing) {
      throw new BadRequestException('ROLE_NAME_ALREADY_EXISTS');
    }

    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        isSystem: false,
        organizationId,
        permissions: {
          create: data.permissions.map((p) => ({
            module: p.module as any,
            actions: p.actions as any,
            scope: p.scope as any,
          })),
        },
      },
      include: { permissions: true },
    });

    return { message: 'ROLE_CREATED_SUCCESSFULLY', role: this.formatRole(role) };
  }

  /**
   * Update a role. Cannot update system roles.
   */
  async updateRole(
    userId: string,
    organizationId: string,
    roleId: string,
    data: UpdateRoleDto,
  ): Promise<RoleUpdatedResponseDto> {
    await this.requireUsersEditPermission(userId, organizationId);

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId },
      include: { permissions: true },
    });

    if (!role) throw new NotFoundException('ROLE_NOT_FOUND');
    if (role.isSystem) throw new ForbiddenException('ROLE_SYSTEM_CANNOT_MODIFY');

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedRole = await tx.role.update({
        where: { id: roleId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.color !== undefined && { color: data.color }),
        },
      });

      if (data.permissions !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        await tx.rolePermission.createMany({
          data: data.permissions.map((p) => ({
            roleId,
            module: p.module as any,
            actions: p.actions as any,
            scope: p.scope as any,
          })),
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: { permissions: true },
      });
    });

    return { message: 'ROLE_UPDATED_SUCCESSFULLY', role: this.formatRole(updated) };
  }

  /**
   * Delete a role. Cannot delete system roles. Cannot delete if any member has this role.
   */
  async deleteRole(
    userId: string,
    organizationId: string,
    roleId: string,
  ): Promise<RoleDeletedResponseDto> {
    await this.requireUsersEditPermission(userId, organizationId);

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId },
    });

    if (!role) throw new NotFoundException('ROLE_NOT_FOUND');
    if (role.isSystem) throw new ForbiddenException('ROLE_SYSTEM_CANNOT_DELETE');

    // Check if any member uses this role
    const membersWithRole = await this.prisma.organizationMember.count({
      where: { roleId, organizationId },
    });
    if (membersWithRole > 0) {
      throw new BadRequestException('ROLE_IN_USE_CANNOT_DELETE');
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    return { message: 'ROLE_DELETED_SUCCESSFULLY' };
  }

  /**
   * Helper: verify the calling user has USERS module EDIT permission.
   * This is used to gate role management operations.
   */
  private async requireUsersEditPermission(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      include: {
        role: { include: { permissions: true } },
      },
    });

    if (!membership) throw new ForbiddenException('AUTH_FORBIDDEN');

    const usersPerm = membership.role.permissions.find(
      (p) => p.module === 'USERS',
    );
    const canEdit = usersPerm?.actions?.includes('EDIT') ?? false;
    if (!canEdit) throw new ForbiddenException('AUTH_FORBIDDEN');
  }
}
```

#### `apps/api/src/roles/roles.controller.ts`
```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateRoleDto,
  RoleCreatedResponseDto,
  RoleDeletedResponseDto,
  RoleResponseDto,
  RolesListResponseDto,
  RoleUpdatedResponseDto,
  UpdateRoleDto,
} from './roles.dto';
import { RolesService } from './roles.service';

interface RequestWithUser extends ExpressRequest {
  user: { userId: string };
}

@ApiTags('roles')
@Controller('organizations/:organizationId/roles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles for an organization (system + custom)' })
  @ApiResponse({ status: 200, type: RolesListResponseDto })
  async getRoles(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
  ): Promise<RolesListResponseDto> {
    return this.rolesService.getRoles(req.user.userId, organizationId);
  }

  @Get(':roleId')
  @ApiOperation({ summary: 'Get a specific role' })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  async getRole(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('roleId') roleId: string,
  ): Promise<RoleResponseDto> {
    return this.rolesService.getRole(req.user.userId, organizationId, roleId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom role for the organization' })
  @ApiResponse({ status: 201, type: RoleCreatedResponseDto })
  async createRole(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Body() body: CreateRoleDto,
  ): Promise<RoleCreatedResponseDto> {
    return this.rolesService.createRole(req.user.userId, organizationId, body);
  }

  @Patch(':roleId')
  @ApiOperation({ summary: 'Update a custom role' })
  @ApiResponse({ status: 200, type: RoleUpdatedResponseDto })
  async updateRole(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('roleId') roleId: string,
    @Body() body: UpdateRoleDto,
  ): Promise<RoleUpdatedResponseDto> {
    return this.rolesService.updateRole(req.user.userId, organizationId, roleId, body);
  }

  @Delete(':roleId')
  @ApiOperation({ summary: 'Delete a custom role (cannot delete system roles)' })
  @ApiResponse({ status: 200, type: RoleDeletedResponseDto })
  async deleteRole(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('roleId') roleId: string,
  ): Promise<RoleDeletedResponseDto> {
    return this.rolesService.deleteRole(req.user.userId, organizationId, roleId);
  }
}
```

### 5.2 Novo decorator: `apps/api/src/auth/decorators/permission.decorator.ts`

Criar o arquivo:
```typescript
import { SetMetadata } from '@nestjs/common';
import { RoleModuleEnum, RoleActionEnum } from '../../roles/roles.dto';

export const PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
  module: RoleModuleEnum;
  action: RoleActionEnum;
}

/**
 * Decorator to declare required permission for a route.
 * Used together with PermissionGuard.
 *
 * @example
 * @Permission(RoleModuleEnum.FUEL, RoleActionEnum.CREATE)
 * @Post()
 * async createFuelLog() {}
 */
export const Permission = (module: RoleModuleEnum, action: RoleActionEnum) =>
  SetMetadata(PERMISSION_KEY, { module, action } as RequiredPermission);
```

### 5.3 Novo guard: `apps/api/src/auth/guards/permission.guard.ts`

Criar o arquivo:
```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger('PermissionGuard');

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permission from decorator metadata
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @Permission decorator, allow access (guard is opt-in per route)
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (!user?.userId) {
      throw new ForbiddenException('AUTH_FORBIDDEN');
    }

    // organizationId must come from route param
    const organizationId = request.params?.organizationId;
    if (!organizationId) {
      this.logger.warn('PermissionGuard: organizationId not found in route params');
      throw new ForbiddenException('AUTH_FORBIDDEN');
    }

    // Super admin bypasses all permission checks
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { isSuperAdmin: true },
    });
    if (userRecord?.isSuperAdmin) return true;

    // Get member's role and permissions
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: user.userId, organizationId },
      include: {
        role: {
          include: { permissions: true },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('AUTH_FORBIDDEN');
    }

    // Check permission
    const perm = membership.role.permissions.find(
      (p) => p.module === required.module,
    );

    const hasPermission = perm?.actions?.includes(required.action as any) ?? false;

    if (!hasPermission) {
      this.logger.warn(
        `Permission denied: user ${user.userId} needs ${required.module}:${required.action} in org ${organizationId}`,
      );
      throw new ForbiddenException('AUTH_FORBIDDEN');
    }

    return true;
  }
}
```

### 5.4 Adicionar `RolesModule` ao `app.module.ts`

Arquivo: `apps/api/src/app.module.ts`

Adicionar import:
```typescript
import { RolesModule } from './roles/roles.module';
```

Adicionar `RolesModule` no array `imports` do `@Module`:
```typescript
  imports: [
    // ... imports existentes ...
    RolesModule,  // ← ADICIONAR
  ],
```

### 5.5 Modificações em `members.dto.ts`

Arquivo: `apps/api/src/members/members.dto.ts`

**REMOVER** o enum `OrganizationRole` existente:
```typescript
// REMOVER ESTE BLOCO:
export enum OrganizationRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}
```

**ADICIONAR** novos tipos no início do arquivo (após os imports):
```typescript
import { RoleResponseDto } from '../roles/roles.dto';

/**
 * OrganizationRole enum é mantido APENAS para compatibilidade com o model Invitation
 * e com código legado. NÃO usar para OrganizationMember (que agora usa roleId FK).
 */
export enum OrganizationRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}
```

Modificar `CreateMemberDto`:
- **REMOVER** o campo `role: OrganizationRole`
- **ADICIONAR** o campo `roleId: string` com validação

```typescript
export class CreateMemberDto {
  @ApiProperty({ description: 'Email address for the new user', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password for the new user', example: 'securepassword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Role ID to assign to the new member' })
  @IsString()
  roleId: string;

  @ApiPropertyOptional({ description: 'Whether the member is restricted to specific customers' })
  @IsOptional()
  @IsBoolean()
  customerRestricted?: boolean;

  @ApiPropertyOptional({
    description: 'Customer IDs the member can access (when customerRestricted is true)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customerIds?: string[];
}
```

Modificar `UpdateMemberDto`:
- **REMOVER** o campo `role?: OrganizationRole`
- **ADICIONAR** o campo `roleId?: string`

```typescript
export class UpdateMemberDto {
  @ApiPropertyOptional({ description: 'Role ID to assign' })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional({ description: 'Whether member is restricted to specific customers' })
  @IsOptional()
  @IsBoolean()
  customerRestricted?: boolean;

  // ... manter customerIds, name, email, newPassword iguais
}
```

Modificar `MemberResponseDto`:
- **REMOVER** `role: OrganizationRole`
- **ADICIONAR** `role: RoleResponseDto`

```typescript
export class MemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: () => RoleResponseDto })
  role: RoleResponseDto;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty({ description: 'Whether member is restricted to specific customers' })
  customerRestricted: boolean;

  @ApiProperty({
    description: 'Customers the member has access to (when customerRestricted)',
    type: 'array',
    items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
  })
  customers: { id: string; name: string }[];

  @ApiProperty()
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  };
}
```

### 5.6 Modificações em `members.service.ts`

Arquivo: `apps/api/src/members/members.service.ts`

**Mudança 1:** Em `getMembers()`, adicionar `role: { include: { permissions: true } }` no include do findMany:
```typescript
    let members = await this.prisma.organizationMember.findMany({
      where: { organizationId, user: { isSuperAdmin: false, isSystemUser: false } }, // ← Adicionar isSystemUser: false
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
        role: { include: { permissions: true } },   // ← ADICIONAR
        customers: { include: { customer: true } },
      },
      orderBy: { createdAt: "asc" },
    });
```

**Mudança 2:** Em `getMembers()`, no return do map, substituir `role: member.role as OrganizationRole` por:
```typescript
      memberships: members.map((member) => ({
        id: member.id,
        role: {                                           // ← Substituir pela role completa
          id: member.role.id,
          name: member.role.name,
          description: member.role.description,
          isSystem: member.role.isSystem,
          color: member.role.color,
          organizationId: member.role.organizationId,
          permissions: member.role.permissions.map((p) => ({
            id: p.id,
            module: p.module,
            actions: p.actions,
            scope: p.scope,
          })),
          createdAt: member.role.createdAt,
          updatedAt: member.role.updatedAt,
        },
        joinedAt: member.createdAt,
        customerRestricted: member.customerRestricted,
        customers: member.customers?.map((mc) => ({ id: mc.customer.id, name: mc.customer.name })) ?? [],
        user: member.user,
      })),
```

**Mudança 3:** Em `createMember()`, substituir verificação de autorização (atualmente checa `role: { in: ["OWNER", "ADMIN"] }`):
```typescript
    // Caller must have USERS module CREATE permission
    const userMembership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      include: { role: { include: { permissions: true } } },
    });

    if (!userMembership) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    const usersPerm = userMembership.role.permissions.find((p) => p.module === 'USERS');
    const canCreate = usersPerm?.actions?.includes('CREATE') ?? false;
    if (!canCreate) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
```

**Mudança 4:** Em `createMember()`, substituir `if (data.role === OrganizationRole.OWNER)` — remover essa validação pois não existe mais role OWNER direta. Substituir por validação de roleId:
```typescript
    // Validate roleId exists and belongs to this org or is a system role
    const targetRole = await this.prisma.role.findFirst({
      where: {
        id: data.roleId,
        OR: [{ organizationId: null }, { organizationId }],
      },
    });
    if (!targetRole) {
      throw new BadRequestException({ errorCode: ApiCode.COMMON_INVALID_INPUT });
    }

    // Only members with USERS:EDIT can assign COMPANY_OWNER role
    const isAssigningOwnerRole = targetRole.name === 'Dono da Empresa';
    if (isAssigningOwnerRole) {
      const canEdit = usersPerm?.actions?.includes('EDIT') ?? false;
      if (!canEdit) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }
```

**Mudança 5:** Em `createMember()`, no `prisma.organizationMember.create`, trocar `role: data.role` por `roleId: data.roleId`:
```typescript
      const created = await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId,
          roleId: data.roleId,      // ← trocar de `role: data.role`
          customerRestricted: customerRestricted,
          customers: ...
        },
        include: {
          ...
          role: { include: { permissions: true } },   // ← adicionar
          ...
        },
      });
```

**Mudança 6:** Em `createMember()`, o return deve incluir a role completa (mesmo padrão do getMembers).

**Mudança 7:** Em `updateMember()`, substituir verificação de autorização por check de permissão:
```typescript
    const userMembership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      include: { role: { include: { permissions: true } } },
    });

    if (!userMembership) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    const usersPerm = userMembership.role.permissions.find((p) => p.module === 'USERS');
    const canEdit = usersPerm?.actions?.includes('EDIT') ?? false;
    if (!canEdit) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
```

**Mudança 8:** Em `updateMember()`, substituir as validações que referenciavam `data.role` por `data.roleId`. Remover verificações de `OrganizationRole.OWNER`.

**Mudança 9:** Em `updateMember()`, em `updateData` remover `role?: OrganizationRole` e adicionar `roleId?: string`:
```typescript
    const updateData: { roleId?: string; customerRestricted?: boolean } = {};
    if (data.roleId !== undefined) updateData.roleId = data.roleId;
    if (data.customerRestricted !== undefined) updateData.customerRestricted = data.customerRestricted;
```

**Mudança 10:** Em `updateMember()`, adicionar `role: { include: { permissions: true } }` nos includes do update e findUniqueOrThrow.

**Mudança 11:** Em `removeMember()`, substituir verificação de autorização por check de permissão USERS:DELETE:
```typescript
    const userMembership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      include: { role: { include: { permissions: true } } },
    });

    if (!userMembership) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }

    const usersPerm = userMembership.role.permissions.find((p) => p.module === 'USERS');
    const canDelete = usersPerm?.actions?.includes('DELETE') ?? false;
    if (!canDelete) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
```

### 5.7 Modificações em `organizations.service.ts`

Arquivo: `apps/api/src/organizations/organizations.service.ts`

**Mudança 1:** Em `createOrganization()`, buscar o roleId da role COMPANY_OWNER antes de criar a org:
```typescript
    // Get COMPANY_OWNER role (global system role)
    const ownerRole = await this.prisma.role.findFirst({
      where: { name: 'Dono da Empresa', isSystem: true, organizationId: null },
    });
    if (!ownerRole) {
      throw new Error('System role COMPANY_OWNER not found. Run seed first.');
    }
```

Substituir no create da organização:
```typescript
      memberships: {
        create: {
          userId,
          roleId: ownerRole.id,   // ← trocar de `role: OrganizationRole.OWNER`
        },
      },
```

**Mudança 2:** Em `getUserOrganizations()`, incluir a role no retorno:
```typescript
    const organizations = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
        role: { include: { permissions: true } },  // ← ADICIONAR
      },
    });

    return {
      organizations: organizations.map((member) => ({
        ...member.organization,
        role: member.role,          // ← retornar objeto role completo ao invés de member.role as OrganizationRole
        joinedAt: member.createdAt,
      })),
    };
```

**Mudança 3:** Em `getOrganizationDetails()`, incluir role:
```typescript
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      include: {
        organization: true,
        role: { include: { permissions: true } },  // ← ADICIONAR
      },
    });

    return {
      ...membership.organization,
      role: membership.role,    // ← objeto completo
      joinedAt: membership.createdAt,
    };
```

**Mudança 4:** Em `updateOrganization()`, a verificação de `role: { in: [OrganizationRole.OWNER, OrganizationRole.ADMIN] }` deve ser substituída por verificação de permissão USERS:EDIT:
```typescript
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      include: { role: { include: { permissions: true } } },
    });

    if (!membership) {
      throw new ForbiddenException(ApiCode.ORGANIZATION_NOT_FOUND);
    }

    const usersPerm = membership.role.permissions.find((p) => p.module === 'USERS');
    const canEdit = usersPerm?.actions?.includes('EDIT') ?? false;
    if (!canEdit) {
      throw new ForbiddenException(ApiCode.ORGANIZATION_NOT_FOUND);
    }
```

### 5.8 Modificações em `organizations.dto.ts`

Arquivo: `apps/api/src/organizations/organizations.dto.ts`

O campo `role: OrganizationRole` no `OrganizationResponseDto` deve ser alterado para aceitar o objeto role completo. Isso afeta o tipo retornado pelo `use-auth.tsx` no frontend.

```typescript
// ANTES:
  role: OrganizationRole;

// DEPOIS (manter como any por ora, ou criar interface):
  role: {
    id: string;
    name: string;
    description?: string | null;
    isSystem: boolean;
    color?: string | null;
    permissions: Array<{
      id: string;
      module: string;
      actions: string[];
      scope: string;
    }>;
  };
```

### 5.9 Adicionar ApiCode para roles em `api-codes.enum.ts`

Arquivo: `apps/api/src/common/api-codes.enum.ts`

Adicionar após o bloco de Member errors:
```typescript
  // Role errors (2200-2299)
  ROLE_NOT_FOUND = "ROLE_NOT_FOUND",
  ROLE_NAME_ALREADY_EXISTS = "ROLE_NAME_ALREADY_EXISTS",
  ROLE_SYSTEM_CANNOT_MODIFY = "ROLE_SYSTEM_CANNOT_MODIFY",
  ROLE_SYSTEM_CANNOT_DELETE = "ROLE_SYSTEM_CANNOT_DELETE",
  ROLE_IN_USE_CANNOT_DELETE = "ROLE_IN_USE_CANNOT_DELETE",
  ROLE_CREATED_SUCCESSFULLY = "ROLE_CREATED_SUCCESSFULLY",
  ROLE_UPDATED_SUCCESSFULLY = "ROLE_UPDATED_SUCCESSFULLY",
  ROLE_DELETED_SUCCESSFULLY = "ROLE_DELETED_SUCCESSFULLY",
```

### 5.10 Modificações em `members.module.ts`

Arquivo: `apps/api/src/members/members.module.ts`

Adicionar `RolesModule` para acesso ao `RolesService` se necessário (opcional, o guard usa PrismaService diretamente):
```typescript
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, EmailModule, RolesModule],
  ...
})
```

---

## 6. Frontend — Páginas e Componentes

### 6.1 Interface `Organization` em `use-auth.tsx`

Arquivo: `apps/web/lib/hooks/use-auth.tsx`

Atualizar a interface `Organization` para refletir o novo tipo de role:

```typescript
// ANTES:
export interface Organization {
  role: string;  // era o enum OWNER/ADMIN/MEMBER
  ...
}

// DEPOIS:
export interface OrganizationRole {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  color?: string | null;
  permissions: Array<{
    id: string;
    module: string;
    actions: string[];
    scope: string;
  }>;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  currency: string;
  role: OrganizationRole;  // ← objeto ao invés de string
  createdAt: string;
  stripeCustomerId?: string;
}
```

### 6.2 Novo hook: `apps/web/lib/hooks/use-permissions.ts`

Criar o arquivo:
```typescript
"use client";

import { useAuth } from "./use-auth";

// Mirror dos enums do backend (roles.dto.ts)
export enum Module {
  VEHICLES  = 'VEHICLES',
  TRACKING  = 'TRACKING',
  COMPANIES = 'COMPANIES',
  USERS     = 'USERS',
  REPORTS   = 'REPORTS',
  DRIVERS   = 'DRIVERS',
  DOCUMENTS = 'DOCUMENTS',
  FUEL      = 'FUEL',
  CHECKLIST = 'CHECKLIST',
  INCIDENTS = 'INCIDENTS',
  TELEMETRY = 'TELEMETRY',
  FINANCIAL = 'FINANCIAL',
}

export enum Action {
  VIEW   = 'VIEW',
  CREATE = 'CREATE',
  EDIT   = 'EDIT',
  DELETE = 'DELETE',
}

export function usePermissions() {
  const { user, currentOrganization } = useAuth();

  /**
   * Returns true if the current user can perform `action` on `module`.
   * Super admins always return true.
   */
  function can(module: Module, action: Action): boolean {
    if (!currentOrganization) return false;

    // Super admin bypasses all checks
    if (user?.isSuperAdmin) return true;

    const role = currentOrganization.role;
    if (!role || !role.permissions) return false;

    const perm = role.permissions.find((p) => p.module === module);
    return perm?.actions?.includes(action) ?? false;
  }

  /**
   * Returns true if the current user has ANY of the given actions on the module.
   */
  function canAny(module: Module, actions: Action[]): boolean {
    return actions.some((action) => can(module, action));
  }

  /**
   * Returns the role name of the current user in the current org.
   */
  function getRoleName(): string {
    return currentOrganization?.role?.name ?? '';
  }

  /**
   * Returns the role color (hex) for badge display.
   */
  function getRoleColor(): string | null {
    return currentOrganization?.role?.color ?? null;
  }

  /**
   * Shorthand: can the user manage team members (USERS module)?
   */
  const canManageUsers = can(Module.USERS, Action.CREATE);
  const canEditUsers = can(Module.USERS, Action.EDIT);
  const canDeleteUsers = can(Module.USERS, Action.DELETE);

  return {
    can,
    canAny,
    getRoleName,
    getRoleColor,
    canManageUsers,
    canEditUsers,
    canDeleteUsers,
  };
}
```

### 6.3 Atualização da página `/team/page.tsx`

Arquivo: `apps/web/app/team/page.tsx`

**Mudança 1:** Atualizar a interface `TeamMember`:
```typescript
interface TeamMemberRole {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  color?: string | null;
  permissions: Array<{ id: string; module: string; actions: string[]; scope: string }>;
}

interface TeamMember {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  role: TeamMemberRole;  // ← objeto ao invés de string
  joinedAt: string;
  customerRestricted?: boolean;
  customers?: { id: string; name: string }[];
}
```

**Mudança 2:** Importar `usePermissions`:
```typescript
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
```

**Mudança 3:** Usar o hook no componente:
```typescript
  const { can, getRoleName } = usePermissions();
  const canManageTeam = can(Module.USERS, Action.CREATE);
```

**Mudança 4:** Substituir `getRoleColor(member.role)` e `getRoleIcon(member.role)` por versões baseadas no objeto role:
```typescript
  const getRoleColor = (role: TeamMemberRole) => {
    if (role.color) {
      // Convert hex to Tailwind-compatible inline style
      return ""; // Use inline style instead
    }
    // Fallback colors by system role name
    switch (role.name) {
      case "Dono da Empresa":
        return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200";
      case "Administrador":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "Operador":
        return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
      case "Motorista":
        return "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200";
    }
  };
```

**Mudança 5:** Atualizar renderização do badge de role:
```typescript
  // Na TableCell da coluna role:
  <Badge
    className={`text-xs ${getRoleColor(member.role)}`}
    style={member.role.color ? { backgroundColor: `${member.role.color}20`, color: member.role.color } : {}}
  >
    <span className="flex items-center gap-1">
      <Shield className="w-3 h-3" />
      {member.role.name}   {/* ← nome da role ao invés do enum */}
    </span>
  </Badge>
```

**Mudança 6:** Remover o quick-action dropdown de "Promover para Admin" / "Rebaixar para Member" (esses fluxos agora são feitos na página de edição de membro). Manter apenas Edit e Remove.

**Mudança 7:** Atualizar `canManageTeam` para usar o hook:
```typescript
  // REMOVER:
  const canManageTeam = currentOrganization?.role === "OWNER" || currentOrganization?.role === "ADMIN";
  
  // ADICIONAR (já com hook usePermissions):
  const canManageTeam = can(Module.USERS, Action.CREATE);
```

### 6.4 Atualização do client-layout `/team/client-layout.tsx`

Arquivo: `apps/web/app/team/client-layout.tsx`

Verificar se há referências a `role === "OWNER"` ou similares e substituir por check de permissões via `usePermissions()`.

### 6.5 Novo arquivo API client: `apps/web/lib/api/roles.ts`

Criar o arquivo:
```typescript
import { externalApi } from "@/lib/frontend/api-client";

export interface RolePermission {
  id: string;
  module: string;
  actions: string[];
  scope: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  color?: string | null;
  organizationId?: string | null;
  permissions: RolePermission[];
  createdAt: string;
  updatedAt: string;
}

export const rolesAPI = {
  getRoles: (organizationId: string) =>
    externalApi.get<{ roles: Role[] }>(
      `/api/organizations/${organizationId}/roles`
    ),

  getRole: (organizationId: string, roleId: string) =>
    externalApi.get<Role>(
      `/api/organizations/${organizationId}/roles/${roleId}`
    ),

  createRole: (
    organizationId: string,
    data: {
      name: string;
      description?: string;
      color?: string;
      permissions: Array<{ module: string; actions: string[]; scope: string }>;
    }
  ) =>
    externalApi.post<{ message: string; role: Role }>(
      `/api/organizations/${organizationId}/roles`,
      data
    ),

  updateRole: (
    organizationId: string,
    roleId: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      permissions?: Array<{ module: string; actions: string[]; scope: string }>;
    }
  ) =>
    externalApi.patch<{ message: string; role: Role }>(
      `/api/organizations/${organizationId}/roles/${roleId}`,
      data
    ),

  deleteRole: (organizationId: string, roleId: string) =>
    externalApi.delete<{ message: string }>(
      `/api/organizations/${organizationId}/roles/${roleId}`
    ),
};
```

### 6.6 Atualizar `organizationAPI` em `api-client.ts`

Arquivo: `apps/web/lib/frontend/api-client.ts`

Adicionar no objeto `organizationAPI`:
```typescript
  // Roles
  getRoles: (organizationId: string) =>
    externalApi.get(`/api/organizations/${organizationId}/roles`),
  
  getRole: (organizationId: string, roleId: string) =>
    externalApi.get(`/api/organizations/${organizationId}/roles/${roleId}`),
  
  createRole: (organizationId: string, data: any) =>
    externalApi.post(`/api/organizations/${organizationId}/roles`, data),
  
  updateRole: (organizationId: string, roleId: string, data: any) =>
    externalApi.patch(`/api/organizations/${organizationId}/roles/${roleId}`, data),
  
  deleteRole: (organizationId: string, roleId: string) =>
    externalApi.delete(`/api/organizations/${organizationId}/roles/${roleId}`),
```

### 6.7 Atualização do formulário `/team/new` e `/team/[memberId]`

Estes formulários atualmente usam um `<Select>` com opções OWNER/ADMIN/MEMBER fixas. Devem ser atualizados para buscar a lista de roles da API e exibir um select com os nomes das roles.

Em ambos os formulários:
```typescript
// 1. Buscar roles disponíveis
const [roles, setRoles] = useState<Role[]>([]);
useEffect(() => {
  if (!currentOrganization) return;
  organizationAPI.getRoles(currentOrganization.id)
    .then((res) => setRoles(res.data.roles))
    .catch(console.error);
}, [currentOrganization?.id]);

// 2. No campo de role, renderizar as roles disponíveis
<Select value={form.roleId} onValueChange={(v) => setForm({ ...form, roleId: v })}>
  <SelectContent>
    {roles.map((role) => (
      <SelectItem key={role.id} value={role.id}>
        <div className="flex items-center gap-2">
          {role.color && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: role.color }}
            />
          )}
          {role.name}
          {role.isSystem && (
            <Badge variant="outline" className="text-xs ml-1">Sistema</Badge>
          )}
        </div>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 6.8 Chaves i18n a adicionar em `apps/web/i18n/locales/pt.json`

Adicionar seção `"roles"` no arquivo JSON:
```json
"roles": {
  "title": "Funções",
  "description": "Gerencie as funções e permissões da sua organização",
  "systemRole": "Função do Sistema",
  "customRole": "Função Personalizada",
  "addRole": "Nova Função",
  "editRole": "Editar Função",
  "deleteRole": "Excluir Função",
  "roleName": "Nome da Função",
  "roleDescription": "Descrição",
  "roleColor": "Cor",
  "permissions": "Permissões",
  "module": "Módulo",
  "actions": "Ações",
  "scope": "Escopo",
  "scopeAll": "Todos os dados",
  "scopeAssigned": "Dados atribuídos",
  "modules": {
    "VEHICLES": "Veículos",
    "TRACKING": "Rastreamento",
    "COMPANIES": "Empresas",
    "USERS": "Usuários",
    "REPORTS": "Relatórios",
    "DRIVERS": "Motoristas",
    "DOCUMENTS": "Documentos",
    "FUEL": "Abastecimento",
    "CHECKLIST": "Checklist",
    "INCIDENTS": "Ocorrências",
    "TELEMETRY": "Telemetria",
    "FINANCIAL": "Financeiro"
  },
  "actions": {
    "VIEW": "Visualizar",
    "CREATE": "Criar",
    "EDIT": "Editar",
    "DELETE": "Excluir"
  },
  "confirmDelete": {
    "title": "Excluir Função",
    "description": "Esta ação não pode ser desfeita. A função será permanentemente excluída.",
    "cannotDelete": "Esta função não pode ser excluída pois está em uso por um ou mais membros."
  },
  "errors": {
    "nameRequired": "Nome é obrigatório",
    "nameTaken": "Já existe uma função com este nome",
    "systemRoleCannotModify": "Funções do sistema não podem ser modificadas",
    "systemRoleCannotDelete": "Funções do sistema não podem ser excluídas",
    "roleInUse": "Esta função está em uso e não pode ser excluída",
    "roleNotFound": "Função não encontrada"
  },
  "toastMessages": {
    "created": "Função criada com sucesso",
    "updated": "Função atualizada com sucesso",
    "deleted": "Função excluída com sucesso"
  }
},
"team": {
  "role": "Função"
}
```

> Nota: Mesclar com as chaves `"team"` existentes, não sobrescrever.

---

## 7. Estratégia de Migração (Zero-Downtime)

### Fase 1: Schema additive (sem quebrar nada)
1. Adicionar `isSystemUser` (nullable → default false) — não quebra nada
2. Criar tabelas `roles` e `role_permissions` — não quebra nada
3. Adicionar `roleId TEXT` como nullable em `organizationMembers` — não quebra nada
4. Adicionar relação `Role` em `Organization` — não quebra nada

### Fase 2: Seed (preencher dados novos)
1. Executar `seedSystemRoles()` → cria as 5 roles globais do sistema
2. Executar `migrateExistingRoles()` → preenche `roleId` para todos os members existentes

### Fase 3: Tornar NOT NULL e remover coluna antiga
1. Verificar que 100% dos membros têm `roleId` preenchido
2. `ALTER TABLE "organizationMembers" ALTER COLUMN "roleId" SET NOT NULL`
3. Adicionar FK constraint
4. `ALTER TABLE "organizationMembers" DROP COLUMN "role"` (o enum Role permanece para Invitation)

### Fase 4: Deploy do código novo
1. Deploy do backend com novas queries (sem referência à coluna `role` em OrganizationMember)
2. Deploy do frontend com `usePermissions` hook e badge de role name

### Rollback
Se algo der errado na Fase 3:
- A coluna `role` ainda existe até ser dropada — reversível com `ALTER TABLE ... ADD COLUMN role Role DEFAULT 'MEMBER'`
- O seed pode ser re-executado com idempotência (verifica existência antes de criar)

---

## 8. Ordem de Implementação (Tasks Numeradas)

Execute cada task nesta ordem. Não pule tasks. Verifique cada task antes de continuar.

### Task 1: Adicionar enums e models ao schema.prisma
- Arquivo: `apps/api/prisma/schema.prisma`
- Adicionar enums `RoleModule`, `RoleAction`, `RoleScope`
- Adicionar model `Role`
- Adicionar model `RolePermission`
- Adicionar `isSystemUser Boolean @default(false)` em `model User`
- Adicionar `roles Role[]` em `model Organization`
- Substituir `model OrganizationMember` (trocar campo `role Role` por `roleId String` + relação)
- Verificar: `npx prisma validate` deve passar sem erros

### Task 2: Criar a migration SQL
- Arquivo: `apps/api/prisma/migrations/TIMESTAMP_rbac_roles/migration.sql`
  - Use timestamp atual no formato YYYYMMDDHHMMSS (ex: 20260416120000)
- Conteúdo: criar as 3 enums, criar tabelas `roles` e `role_permissions`, adicionar `isSystemUser`, adicionar `roleId` nullable em `organizationMembers`, adicionar indexes e FKs
- NÃO incluir os Steps 8-10 no SQL (serão feitos via seed)
- Verificar: `npx prisma migrate deploy` deve aplicar a migration

### Task 3: Atualizar seed.ts com roles e migração
- Arquivo: `apps/api/prisma/seed.ts`
- Adicionar funções `seedSystemRoles()`, `migrateExistingRoles()`
- Atualizar `main()` para chamar as novas funções na ordem correta
- Atualizar `seedAdminUser()` para usar `roleId`
- Verificar: `npx prisma db seed` deve executar sem erros

### Task 4: Executar seed para popular roles e migrar dados
- Comando: `cd apps/api && npx prisma db seed`
- Verificar no banco: `SELECT * FROM roles` deve retornar 5 roles
- Verificar no banco: `SELECT COUNT(*) FROM "organizationMembers" WHERE "roleId" IS NULL` deve retornar 0

### Task 5: Tornar roleId NOT NULL e remover coluna role de organizationMembers
- Criar uma segunda migration: `apps/api/prisma/migrations/TIMESTAMP_rbac_roles_notnull/migration.sql`
  ```sql
  ALTER TABLE "organizationMembers" ALTER COLUMN "roleId" SET NOT NULL;
  ALTER TABLE "organizationMembers" ADD CONSTRAINT "organizationMembers_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
  ALTER TABLE "organizationMembers" DROP COLUMN IF EXISTS "role";
  ```
- Verificar: `npx prisma migrate deploy` deve aplicar
- Verificar: `npx prisma generate` deve regenerar client sem erros

### Task 6: Criar módulo roles no backend
- Criar pasta `apps/api/src/roles/`
- Criar `roles.dto.ts` com o conteúdo da seção 5.1
- Criar `roles.service.ts` com o conteúdo da seção 5.1
- Criar `roles.controller.ts` com o conteúdo da seção 5.1
- Criar `roles.module.ts` com o conteúdo da seção 5.1

### Task 7: Criar decorators e guards de permissão
- Criar `apps/api/src/auth/decorators/permission.decorator.ts`
- Criar `apps/api/src/auth/guards/permission.guard.ts`

### Task 8: Adicionar ApiCode para roles
- Arquivo: `apps/api/src/common/api-codes.enum.ts`
- Adicionar os 8 novos códigos da seção 5.9

### Task 9: Atualizar members.dto.ts
- Modificar `CreateMemberDto`: trocar `role` por `roleId`
- Modificar `UpdateMemberDto`: trocar `role` por `roleId`
- Modificar `MemberResponseDto`: trocar `role: OrganizationRole` por `role: RoleResponseDto`
- Manter o enum `OrganizationRole` com comentário de compatibilidade legada

### Task 10: Atualizar members.service.ts
- Aplicar as mudanças 1-11 descritas na seção 5.6
- Foco: filtrar `isSystemUser: false` nas queries, usar `role: { include: { permissions: true } }`, usar `roleId` ao invés de `role`

### Task 11: Atualizar organizations.service.ts
- Aplicar mudanças 1-4 da seção 5.7
- Buscar ownerRole por nome antes de criar org

### Task 12: Atualizar organizations.dto.ts
- Modificar `OrganizationResponseDto` para usar o objeto role

### Task 13: Adicionar RolesModule ao app.module.ts
- Import e adição no array de imports

### Task 14: Build e verificação do backend
- Comando: `cd apps/api && npx tsc --noEmit`
- Corrigir todos os erros de TypeScript antes de continuar

### Task 15: Atualizar use-auth.tsx no frontend
- Adicionar interface `OrganizationRole`
- Modificar interface `Organization.role` para ser `OrganizationRole`
- Verificar que o código que usava `currentOrganization?.role === "OWNER"` é atualizado

### Task 16: Criar hook use-permissions.ts
- Criar `apps/web/lib/hooks/use-permissions.ts` com o conteúdo da seção 6.2

### Task 17: Criar roles API client
- Criar `apps/web/lib/api/roles.ts` com o conteúdo da seção 6.5
- Adicionar métodos de roles no `organizationAPI` em `api-client.ts`

### Task 18: Atualizar /team/page.tsx
- Aplicar mudanças 1-7 da seção 6.3
- Badge de role deve mostrar `member.role.name` ao invés do enum

### Task 19: Atualizar formulários de criação/edição de membros
- Aplicar mudanças da seção 6.7 nos arquivos `/team/new` e `/team/[memberId]`
- Buscar roles da API e popular o select de role

### Task 20: Adicionar chaves i18n
- Arquivo: `apps/web/i18n/locales/pt.json`
- Adicionar a seção `"roles"` completa da seção 6.8

### Task 21: Verificar referências antigas no frontend
- Buscar por `currentOrganization?.role === "OWNER"` → substituir por `can(Module.USERS, Action.EDIT)`
- Buscar por `role === "ADMIN"` → substituir por permissão adequada
- Buscar por `role === "MEMBER"` → substituir por permissão adequada
- Arquivos a verificar: `client-layout.tsx`, `layout.tsx`, qualquer componente que check role como string

### Task 22: Build do frontend
- Comando: `cd apps/web && npx tsc --noEmit`
- Corrigir todos os erros antes de finalizar

---

## 9. Testes de Verificação

### 9.1 Verificações de banco
Execute após a migration e seed:
```sql
-- 1. Verificar que as 5 roles existem
SELECT name, "isSystem", color FROM roles WHERE "organizationId" IS NULL ORDER BY name;
-- Deve retornar: Administrador, Dono da Empresa, Motorista, Operador, Visualizador

-- 2. Verificar permissões da COMPANY_OWNER
SELECT r.name, rp.module, rp.actions, rp.scope
FROM roles r
JOIN role_permissions rp ON r.id = rp."roleId"
WHERE r.name = 'Dono da Empresa'
ORDER BY rp.module;
-- Deve retornar 12 linhas (uma por módulo)

-- 3. Verificar que todos os membros têm roleId
SELECT COUNT(*) FROM "organizationMembers" WHERE "roleId" IS NULL;
-- Deve retornar 0

-- 4. Verificar que a coluna role foi removida de organizationMembers
SELECT column_name FROM information_schema.columns
WHERE table_name = 'organizationMembers';
-- Não deve conter 'role'

-- 5. Verificar isSystemUser existe em users
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'isSystemUser';
-- Deve retornar 1 linha
```

### 9.2 Testes de API (usando curl ou Insomnia/Postman)

```bash
# Autenticar e obter token
POST /api/auth/login
Body: { "email": "admin@domain.com", "password": "admin123" }
Salvar: accessToken e organizationId

# 1. Listar roles da org (deve retornar as 5 system roles)
GET /api/organizations/{orgId}/roles
Headers: Authorization: Bearer {token}
Esperado: 200, { roles: [ ...5 roles... ] }

# 2. Listar membros (deve retornar role como objeto com name)
GET /api/organizations/{orgId}/members
Esperado: 200, { memberships: [{ role: { id, name, permissions }, ... }] }

# 3. Criar role customizada (como COMPANY_OWNER)
POST /api/organizations/{orgId}/roles
Body: {
  "name": "Financeiro",
  "color": "#EF4444",
  "permissions": [
    { "module": "FINANCIAL", "actions": ["VIEW","CREATE"], "scope": "ALL" }
  ]
}
Esperado: 201, { message: "ROLE_CREATED_SUCCESSFULLY", role: {...} }

# 4. Criar membro com roleId
POST /api/organizations/{orgId}/members
Body: {
  "email": "test@example.com",
  "password": "password123",
  "name": "Test User",
  "roleId": "{id da role VIEWER}"
}
Esperado: 201, { message: "MEMBER_CREATED_SUCCESSFULLY", member: { role: { name: "Visualizador" } } }

# 5. Tentar deletar system role (deve falhar)
DELETE /api/organizations/{orgId}/roles/{systemRoleId}
Esperado: 403, { message: "ROLE_SYSTEM_CANNOT_DELETE" }

# 6. Tentar criar role com nome duplicado (deve falhar)
POST /api/organizations/{orgId}/roles
Body: { "name": "Financeiro", "permissions": [] }
Esperado: 400, { message: "ROLE_NAME_ALREADY_EXISTS" }
```

### 9.3 Testes de interface

1. Acessar `/team` como COMPANY_OWNER
   - O badge de role deve exibir "Dono da Empresa" (não "OWNER")
   - A cor do badge deve ser roxa (#7C3AED)
   - O botão "Adicionar Usuário" deve estar visível

2. Acessar `/team` como VIEWER
   - O botão "Adicionar Usuário" não deve estar visível

3. Criar novo membro em `/team/new`
   - O select de role deve listar as roles disponíveis por nome
   - Não deve haver opções OWNER/ADMIN/MEMBER como string

4. Verificar `usePermissions()` no console do browser:
   ```javascript
   // Execute no console após login
   // Se React DevTools disponível, inspecionar o contexto AuthContext
   // role deve ser { id: "...", name: "Dono da Empresa", permissions: [...] }
   ```

### 9.4 Verificação de segurança

1. Usuário com role VIEWER tenta acessar endpoint de criação de membro:
   - `POST /api/organizations/{orgId}/members` deve retornar 403

2. Usuário tenta modificar system role:
   - `PATCH /api/organizations/{orgId}/roles/{systemRoleId}` deve retornar 403

3. `isSystemUser = true` não aparece na lista de membros:
   - Criar um usuário com `isSystemUser = true` diretamente no banco
   - `GET /api/organizations/{orgId}/members` não deve retornar esse usuário

---

## 10. Arquivos de Referência (para o agente implementador)

| Arquivo | Ação | Seção do plano |
|---|---|---|
| `apps/api/prisma/schema.prisma` | Modificar | 2.1 — 2.7 |
| `apps/api/prisma/migrations/TIMESTAMP_rbac_roles/migration.sql` | Criar (novo) | 3.2 |
| `apps/api/prisma/migrations/TIMESTAMP_rbac_roles_notnull/migration.sql` | Criar (novo) | Task 5 |
| `apps/api/prisma/seed.ts` | Modificar | 4.3 |
| `apps/api/src/roles/roles.module.ts` | Criar (novo) | 5.1 |
| `apps/api/src/roles/roles.dto.ts` | Criar (novo) | 5.1 |
| `apps/api/src/roles/roles.service.ts` | Criar (novo) | 5.1 |
| `apps/api/src/roles/roles.controller.ts` | Criar (novo) | 5.1 |
| `apps/api/src/auth/decorators/permission.decorator.ts` | Criar (novo) | 5.2 |
| `apps/api/src/auth/guards/permission.guard.ts` | Criar (novo) | 5.3 |
| `apps/api/src/app.module.ts` | Modificar | 5.4 |
| `apps/api/src/members/members.dto.ts` | Modificar | 5.5 |
| `apps/api/src/members/members.service.ts` | Modificar | 5.6 |
| `apps/api/src/organizations/organizations.service.ts` | Modificar | 5.7 |
| `apps/api/src/organizations/organizations.dto.ts` | Modificar | 5.8 |
| `apps/api/src/common/api-codes.enum.ts` | Modificar | 5.9 |
| `apps/api/src/members/members.module.ts` | Modificar | 5.10 |
| `apps/web/lib/hooks/use-auth.tsx` | Modificar | 6.1 |
| `apps/web/lib/hooks/use-permissions.ts` | Criar (novo) | 6.2 |
| `apps/web/app/team/page.tsx` | Modificar | 6.3 |
| `apps/web/app/team/client-layout.tsx` | Modificar | 6.4 |
| `apps/web/lib/api/roles.ts` | Criar (novo) | 6.5 |
| `apps/web/lib/frontend/api-client.ts` | Modificar | 6.6 |
| `apps/web/app/team/new/page.tsx` | Modificar | 6.7 |
| `apps/web/app/team/[memberId]/` | Modificar | 6.7 |
| `apps/web/i18n/locales/pt.json` | Modificar | 6.8 |

---

## 11. Notas Críticas para o Agente Implementador

1. **O enum `Role` (OWNER/ADMIN/MEMBER) NÃO é removido** — ele continua em `model Invitation`. Apenas `model OrganizationMember` perde o campo `role Role`.

2. **O enum `OrganizationRole` em `members.dto.ts` é mantido** com comentário de compatibilidade — ele é importado em `organizations.dto.ts` e possivelmente outros lugares.

3. **Nomes dos enums Prisma:** Use `RoleModule`, `RoleAction`, `RoleScope` (com prefixo) para evitar conflitos futuros. Os `@@map` garantem que no banco os valores sejam `role_module`, `role_action`, `role_scope`.

4. **O campo `role` em `OrganizationMember`** após a migration refere-se à RELAÇÃO Prisma (Role model), não ao enum. O Prisma usa o mesmo nome `role` para a relação apontando ao model `Role`. Isso é válido e intencional.

5. **isSystemUser** — sempre filtrar `user: { isSuperAdmin: false, isSystemUser: false }` em queries de listagem de membros.

6. **Seed é idempotente** — a função `seedSystemRoles()` verifica existência antes de criar. Pode ser executada múltiplas vezes sem duplicar dados.

7. **A migration SQL** deve ser criada manualmente com o timestamp correto no nome da pasta. Use a data/hora atual no formato `YYYYMMDDHHMMSS`.

8. **Não remova** o quick-action de `updateMemberRole` sem antes verificar que o formulário de edição de membro (`/team/[memberId]`) funciona com o novo sistema de roles.

9. **Frontend:** O campo `currentOrganization.role` muda de `string` para `object`. Todo código que comparava `role === "OWNER"` deve ser substituído por `can(Module.USERS, Action.EDIT)` ou similar.

10. **PermissionGuard** é opt-in (usar com `@Permission` decorator). Não afeta rotas existentes que não usam o decorator. Isso garante zero-breaking-change no deploy inicial.
