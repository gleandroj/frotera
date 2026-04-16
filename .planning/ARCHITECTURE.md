# RS Frotas — Arquitetura de Módulos e RBAC

> Documento mestre para agentes de planejamento e implementação.
> Todos os agentes devem ler este arquivo antes de planejar ou implementar qualquer feature.

---

## Stack atual

| Camada | Tecnologia |
|---|---|
| API | NestJS + Prisma + PostgreSQL |
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| Auth | JWT (access + refresh) com 2FA (TOTP) |
| Real-time | WebSockets (Socket.io) + TCP server próprio para rastreadores |
| i18n | JSON locale (`apps/web/i18n/locales/pt.json`) |
| Email | Templates React (Resend) |

### Estrutura de pastas

```
apps/
  api/src/
    auth/           ← JWT, guards, strategies
    members/        ← OrganizationMember CRUD
    organizations/  ← Organization CRUD
    customers/      ← Empresas/Filiais (hierarquia)
    vehicles/       ← Veículos
    trackers/       ← TCP + rastreadores GT06
    dashboard/      ← Stats agregadas
    prisma/         ← PrismaService
    email/          ← EmailService (templates)
    notifications/  ← Notifications
  web/app/
    dashboard/
      customers/    ← Empresas e Filiais
      vehicles/     ← Veículos
      devices/      ← Rastreadores
    team/           ← Gestão de usuários
    settings/       ← Perfil, 2FA, orgs
  web/components/
    navigation/     ← Sidebar, AppHeader
    ui/             ← shadcn components
```

---

## Schema atual (Prisma)

```prisma
model User {
  isSuperAdmin  Boolean  @default(false)
  // isSystemUser NÃO EXISTE AINDA — precisa ser adicionado pelo módulo RBAC
  memberships   OrganizationMember[]
}

enum Role {
  OWNER   // atual: dono da org
  ADMIN   // atual: admin
  MEMBER  // atual: membro genérico
}

model OrganizationMember {
  role               Role     @default(MEMBER)  // será substituído por roleId
  customerRestricted Boolean  @default(false)
  customers          OrganizationMemberCustomer[]
}

model Customer {
  // Representa Empresa ou Filial (hierarquia via parentId)
  parentId  String?  // null = raiz (Empresa), set = Filial
}

model Vehicle {
  customerId  String?  // FK para Customer (Empresa/Filial)
}
```

---

## Níveis de acesso do sistema

```
Tier 0 — Super Admin (User.isSuperAdmin = true)
  • Criado via seed. Email: admin@{APP_DOMAIN}
  • Acesso total ao sistema. Cria orgs, cria roles globais.
  • NUNCA pode ser modificado por ninguém além de si mesmo.
  • NÃO aparece na lista de usuários de nenhuma org.

Tier 1 — Usuário de Sistema (User.isSystemUser = true)  ← NOVO
  • Criado pelo super admin. Ex: equipe de suporte da RS Frotas.
  • Acessa múltiplas orgs. Não pode ser editado/removido por org owners.
  • NÃO aparece na lista de usuários quando visto por um org owner.

Tier 2 — Membros de Organização
  • Têm uma Role com permissões granulares por módulo.
  • Têm escopo de dados: todas as empresas OR empresas específicas OR veículos específicos.
```

---

## Design do sistema de RBAC (módulo a ser implementado primeiro)

### Novo modelo de Role

```prisma
model Role {
  id             String   @id @default(cuid())
  organizationId String?  // null = role global (super admin criou); set = role da org
  name           String
  description    String?
  isSystem       Boolean  @default(false)  // roles do sistema não podem ser deletadas
  color          String?  // hex para badge no UI
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization?     @relation(...)
  permissions  RolePermission[]
  members      OrganizationMember[]

  @@map("roles")
}

model RolePermission {
  id      String   @id @default(cuid())
  roleId  String
  module  Module   // enum abaixo
  actions Action[] // array: VIEW, CREATE, EDIT, DELETE
  scope   Scope    // ALL ou ASSIGNED

  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([roleId, module])
  @@map("role_permissions")
}

enum Module {
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
}

enum Action {
  VIEW
  CREATE
  EDIT
  DELETE
}

enum Scope {
  ALL       // todos os dados da org (respeitando filtro de empresa/filial)
  ASSIGNED  // só dados explicitamente atribuídos ao membro
}
```

### Alterações em OrganizationMember

```prisma
model OrganizationMember {
  // REMOVER:
  // role Role @default(MEMBER)

  // ADICIONAR:
  roleId  String   // FK para Role
  role    Role     @relation(fields: [roleId], references: [id])

  // MANTER:
  customerRestricted Boolean @default(false)
  customers          OrganizationMemberCustomer[]

  // FUTURO (veículo-nível, não precisa agora):
  // vehicleIds String[]
}
```

### Alterações em User

```prisma
model User {
  isSuperAdmin  Boolean @default(false)  // já existe
  isSystemUser  Boolean @default(false)  // NOVO
}
```

### Roles padrão do sistema (seed)

| id chave | name | isSystem | Permissões |
|---|---|---|---|
| `COMPANY_OWNER` | Dono da Empresa | true | Todos os módulos ALL scope, exceto USERS:DELETE de admins |
| `COMPANY_ADMIN` | Administrador | true | Todos os módulos exceto gestão de roles e delete de usuários |
| `OPERATOR` | Operador | true | VEHICLES:VIEW, TRACKING:VIEW, CHECKLIST:CREATE+EDIT, FUEL:CREATE |
| `VIEWER` | Visualizador | true | VIEW em todos os módulos do seu escopo |
| `DRIVER` | Motorista | true | CHECKLIST:CREATE, FUEL:CREATE (apenas próprios registros) |

### Regras de proteção (backend — NUNCA contornar)

1. `isSuperAdmin = true` → só pode ser modificado por si mesmo
2. `isSystemUser = true` → não pode ser editado/removido por org owners
3. Org owner só gerencia usuários dentro do seu escopo de empresas/filiais
4. Org owner não pode modificar outro org owner
5. Role `isSystem = true` não pode ser deletada nem ter permissões alteradas

### Verificação de permissão no backend (helper)

```typescript
// Pseudo-código do guard/helper a criar em auth/
async function checkPermission(
  userId: string,
  organizationId: string,
  module: Module,
  action: Action,
): Promise<boolean> {
  const member = await prisma.organizationMember.findFirst({
    where: { userId, organizationId },
    include: { role: { include: { permissions: true } } },
  });
  if (!member) return false;
  const perm = member.role.permissions.find(p => p.module === module);
  return perm?.actions.includes(action) ?? false;
}
```

---

## Módulos a implementar

### Ordem de implementação

```
Wave 1 (fundação):   RBAC + isSystemUser
Wave 2 (entidades):  Drivers, Documents
Wave 3 (operação):   Fuel, Checklist
Wave 4 (eventos):    Incidents, Telemetry
```

---

### Módulo: DRIVERS (Motoristas)

**Entidade principal:**
```
Driver {
  organizationId   String
  customerId?      String    // vinculado a uma empresa/filial
  name             String
  cpf              String?   @unique (por org)
  cnh              String?   // número da CNH
  cnhCategory      String?   // A, B, C, D, E
  cnhExpiry        DateTime? // alerta de vencimento
  phone            String?
  email            String?
  photo            String?   // URL
  active           Boolean   @default(true)
  notes            String?
  vehicleAssignments DriverVehicleAssignment[]
}

DriverVehicleAssignment {
  driverId   String
  vehicleId  String
  startDate  DateTime
  endDate    DateTime?  // null = ativo
  isPrimary  Boolean    @default(false)
}
```

**Permissão necessária:** `DRIVERS` module

**Integrações:** vinculado a Vehicle, Customer, FuelLog, ChecklistEntry, Incident

---

### Módulo: DOCUMENTS (Documentos)

**Entidade principal:**
```
VehicleDocument {
  organizationId String
  vehicleId      String
  type           DocumentType  // CRLV, INSURANCE, LICENSE, OTHER
  title          String
  fileUrl        String?       // upload para storage
  issueDate      DateTime?
  expiryDate     DateTime?     // para alertas
  notes          String?
  createdById    String        // OrganizationMember.id
}

enum DocumentType {
  CRLV
  INSURANCE
  LICENSE
  INSPECTION
  OTHER
}
```

**Permissão necessária:** `DOCUMENTS` module

**Alertas:** notificações automáticas X dias antes do vencimento (configurável)

---

### Módulo: FUEL (Controle de Abastecimento)

**Entidade principal:**
```
FuelLog {
  organizationId String
  vehicleId      String
  driverId?      String
  date           DateTime
  odometer       Float         // km atual
  liters         Float
  pricePerLiter  Float
  totalCost      Float         // computed: liters * pricePerLiter
  fuelType       FuelType      // GASOLINE, ETHANOL, DIESEL, ELECTRIC, GNV
  station        String?       // posto
  city           String?
  receipt        String?       // URL foto do comprovante
  notes          String?
  createdById    String
}

enum FuelType {
  GASOLINE
  ETHANOL
  DIESEL
  ELECTRIC
  GNV
}
```

**Métricas calculadas:** km/l (consumo), custo/km, consumo médio por período

**Permissão necessária:** `FUEL` module

---

### Módulo: CHECKLIST (Checklists Dinâmicos)

**Entidades:**
```
ChecklistTemplate {
  organizationId String
  name           String
  description?   String
  active         Boolean    @default(true)
  items          ChecklistTemplateItem[]
  entries        ChecklistEntry[]
}

ChecklistTemplateItem {
  templateId   String
  order        Int
  label        String        // pergunta/item
  type         ItemType      // YES_NO, TEXT, NUMBER, PHOTO, SELECT
  required     Boolean       @default(true)
  options      String[]      // para SELECT
}

enum ItemType {
  YES_NO
  TEXT
  NUMBER
  PHOTO
  SELECT
  SIGNATURE
}

ChecklistEntry {
  organizationId String
  templateId     String
  vehicleId      String
  driverId?      String
  memberId       String        // quem preencheu
  status         EntryStatus   // PENDING, COMPLETED, INCOMPLETE
  completedAt?   DateTime
  answers        ChecklistAnswer[]
}

ChecklistAnswer {
  entryId    String
  itemId     String
  value      String?   // resposta serializada
  photoUrl?  String
}
```

**Permissão necessária:** `CHECKLIST` module

---

### Módulo: INCIDENTS (Ocorrências)

**Entidade principal:**
```
Incident {
  organizationId String
  vehicleId?     String
  driverId?      String
  type           IncidentType
  title          String
  description    String?
  date           DateTime
  location       String?
  status         IncidentStatus
  severity       IncidentSeverity
  cost?          Float
  insuranceClaim Boolean   @default(false)
  claimNumber    String?
  attachments    IncidentAttachment[]
  createdById    String
  resolvedAt?    DateTime
  notes          String?
}

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

IncidentAttachment {
  incidentId String
  fileUrl    String
  type       String   // image, pdf, etc.
  name       String
}
```

**Permissão necessária:** `INCIDENTS` module

---

### Módulo: TELEMETRY (Telemetria / Alertas)

**Entidades:**
```
TelemetryAlert {
  organizationId String
  vehicleId      String
  deviceId       String
  type           AlertType
  severity       AlertSeverity
  message        String
  metadata       Json?       // speed, location, etc.
  acknowledgedAt DateTime?
  acknowledgedBy String?     // memberId
  createdAt      DateTime
}

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

GeofenceZone {
  organizationId String
  name           String
  type           GeofenceType   // CIRCLE, POLYGON
  coordinates    Json            // GeoJSON
  vehicleIds     String[]        // quais veículos monitorar
  alertOnEnter   Boolean         @default(true)
  alertOnExit    Boolean         @default(true)
  active         Boolean         @default(true)
}

enum GeofenceType {
  CIRCLE
  POLYGON
}
```

**Permissão necessária:** `TELEMETRY` module

**Integração:** DevicePosition (existente) alimenta os alertas via TCP server

---

## Padrões de código a seguir

### Backend (NestJS)

```
src/{module}/
  {module}.module.ts
  {module}.controller.ts   ← @UseGuards(JwtAuthGuard, PermissionGuard)
  {module}.service.ts
  {module}.dto.ts          ← class-validator decorators
  {module}.guard.ts?       ← se precisar de guard específico
```

**PermissionGuard** (a criar no módulo RBAC):
```typescript
@Permission(Module.FUEL, Action.CREATE)
@Post()
async createFuelLog(...) {}
```

### Frontend (Next.js)

```
app/dashboard/{module}/
  page.tsx         ← lista com DataTable
  [id]/page.tsx    ← detalhe/edição
  new/page.tsx     ← criação
  components/      ← componentes específicos
```

**Verificação de permissão no frontend:**
```typescript
// hook a criar
const { can } = usePermissions();
if (!can(Module.FUEL, Action.CREATE)) redirect('/dashboard');
```

### i18n
- Sempre adicionar chaves em `apps/web/i18n/locales/pt.json`
- Padrão de chaves: `{module}.{subchave}`

---

## Convenções de API

```
GET    /api/organizations/:orgId/{module}          ← list
POST   /api/organizations/:orgId/{module}          ← create
GET    /api/organizations/:orgId/{module}/:id      ← get one
PATCH  /api/organizations/:orgId/{module}/:id      ← update
DELETE /api/organizations/:orgId/{module}/:id      ← delete
```

---

## Notas críticas para agentes de implementação

1. **RBAC é pré-requisito** de todos os outros módulos. Implemente primeiro.
2. **Sempre filtrar por `organizationId`** em todas as queries.
3. **Respeitar escopo de Customer** — verificar `customerId` do veículo vs acesso do membro.
4. **`isSystemUser`** — nunca retornar esses usuários para org owners.
5. **`isSuperAdmin`** — nunca aparecer em listas de membros de org (já implementado).
6. **Migrations** — sempre criar arquivos de migration do Prisma, não usar `db push` em prod.
7. **Soft delete** — preferir `active: Boolean` a DELETE físico para entidades de negócio.
8. **Uploads** — placeholder com URL string por enquanto; integração com storage (S3/R2) em fase futura.
