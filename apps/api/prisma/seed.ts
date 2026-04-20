import { Prisma, PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import * as fs from "node:fs";
import * as path from "node:path";

const prisma = new PrismaClient();

interface SeedOptions {
  seedAdminUser: boolean;
  seedIbge: boolean;
}

// ============================================================
// RBAC: System Roles Seed
// ============================================================

type RoleKey = 'ORGANIZATION_OWNER' | 'COMPANY_OWNER' | 'COMPANY_ADMIN' | 'OPERATOR' | 'VIEWER' | 'DRIVER';

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

// Stable keys for system roles — used in code instead of role names
// (names can change; keys are immutable identifiers)

const SYSTEM_ROLES: Record<RoleKey, RoleDefinition> = {
  ORGANIZATION_OWNER: {
    name: 'Dono da Organização',
    description: 'Gerencia empresas e usuários da organização. Pode criar empresas raiz. Não cria organizações.',
    color: '#0EA5E9',
    permissions: [
      { module: 'VEHICLES',  actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'TRACKING',  actions: ['VIEW'],                          scope: 'ALL' },
      { module: 'TRACKER_DISCOVERIES', actions: ['VIEW'],                scope: 'ALL' },
      { module: 'COMPANIES', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'USERS',     actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'REPORTS',   actions: ['VIEW'],                          scope: 'ALL' },
      { module: 'DRIVERS',   actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'DOCUMENTS', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'FUEL',      actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'CHECKLIST', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'INCIDENTS', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'TELEMETRY', actions: ['VIEW','EDIT','DELETE'],          scope: 'ALL' },
      { module: 'FINANCIAL', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
    ],
  },
  COMPANY_OWNER: {
    name: 'Dono da Empresa',
    description: 'Acesso total à organização. Gerencia todos os módulos.',
    color: '#7C3AED',
    permissions: [
      { module: 'VEHICLES',  actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'TRACKING',  actions: ['VIEW'],                          scope: 'ALL' },
      { module: 'TRACKER_DISCOVERIES', actions: ['VIEW'],                scope: 'ALL' },
      { module: 'COMPANIES', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'USERS',     actions: ['VIEW','CREATE','EDIT'],          scope: 'ALL' },
      { module: 'REPORTS',   actions: ['VIEW'],                          scope: 'ALL' },
      { module: 'DRIVERS',   actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'DOCUMENTS', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'FUEL',      actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'CHECKLIST', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'INCIDENTS', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'TELEMETRY', actions: ['VIEW','EDIT','DELETE'],          scope: 'ALL' },
      { module: 'FINANCIAL', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
    ],
  },
  COMPANY_ADMIN: {
    name: 'Administrador',
    description: 'Administrador da organização. Sem gestão de roles e sem deletar usuários.',
    color: '#2563EB',
    permissions: [
      { module: 'VEHICLES',  actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'TRACKING',  actions: ['VIEW'],                 scope: 'ALL' },
      { module: 'TRACKER_DISCOVERIES', actions: ['VIEW'],       scope: 'ALL' },
      { module: 'COMPANIES', actions: ['VIEW','CREATE','EDIT','DELETE'], scope: 'ALL' },
      { module: 'USERS',     actions: ['VIEW','CREATE'],        scope: 'ALL' },
      { module: 'REPORTS',   actions: ['VIEW'],                 scope: 'ALL' },
      { module: 'DRIVERS',   actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'DOCUMENTS', actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'FUEL',      actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'CHECKLIST', actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'INCIDENTS', actions: ['VIEW','CREATE','EDIT'], scope: 'ALL' },
      { module: 'TELEMETRY', actions: ['VIEW','EDIT','DELETE'], scope: 'ALL' },
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
      { module: 'TELEMETRY', actions: ['VIEW','EDIT'],          scope: 'ALL' },
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
      { module: 'TELEMETRY', actions: ['VIEW'], scope: 'ASSIGNED' },
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

  for (const [roleKey, def] of Object.entries(SYSTEM_ROLES) as [RoleKey, RoleDefinition][]) {
    const existing = await prisma.role.findFirst({
      where: {
        isSystem: true,
        organizationId: null,
        OR: [{ key: roleKey }, { name: def.name }],
      },
    });

    if (existing) {
      if (!existing.key) {
        await prisma.role.update({ where: { id: existing.id }, data: { key: roleKey } });
        console.log(`   ✓ Role key set: ${def.name} → ${roleKey}`);
      } else {
        console.log(`   ✓ Role already exists: ${def.name}`);
      }
      roleIds[roleKey] = existing.id;
      continue;
    }

    const role = await prisma.role.create({
      data: {
        key: roleKey,
        name: def.name,
        description: def.description,
        color: def.color,
        isSystem: true,
        organizationId: null,
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
    roleIds[roleKey] = role.id;
  }

  return roleIds as Record<RoleKey, string>;
}

async function seedAdminUser(ownerRoleId: string) {
  const appDomain = process.env.APP_DOMAIN;

  if (!appDomain) {
    console.log("⚠️  Warning: APP_DOMAIN not found - Admin user will not be created");
    return { adminUserCreated: false, organizationCreated: false };
  }

  const adminEmail = `admin@${appDomain}`;
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: {
      memberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (existingAdmin) {
    console.log(`👤 Admin user already exists: ${adminEmail}`);
    const hasOrganization = existingAdmin.memberships.length > 0;
    if (hasOrganization) {
      console.log(`🏢 Organization already exists: ${existingAdmin.memberships[0].organization.name}`);
    }
    return {
      adminUserCreated: false,
      organizationCreated: false,
      alreadyExists: true
    };
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      name: "Admin",
      language: "pt",
      isSuperAdmin: true,
      emailVerified: new Date(),
    },
  });

  console.log(`✅ Admin user created: ${adminEmail}`);
  if (adminPassword === "admin123") {
    console.log(`⚠️  Warning: Using default password. Please change it after first login.`);
  }

  const orgName = appDomain.split('.')[0].charAt(0).toUpperCase() + appDomain.split('.')[0].slice(1);

  const organization = await prisma.organization.create({
    data: {
      name: `${orgName}`,
      description: "Organização padrão do administrador",
      currency: "BRL",
      memberships: {
        create: {
          userId: adminUser.id,
          roleId: ownerRoleId,
        },
      },
    },
  });

  console.log(`✅ Organization created: ${organization.name}`);
  console.log(`✅ Admin added as Dono da Organização`);

  return {
    adminUserCreated: true,
    organizationCreated: true,
    organizationName: organization.name
  };
}

async function seedIbgeLocalidades(): Promise<void> {
  const dataDir = path.join(__dirname, "data");
  const ufsPath = path.join(dataDir, "ibge-ufs.json");
  const munPath = path.join(dataDir, "ibge-municipios.json");
  if (!fs.existsSync(ufsPath) || !fs.existsSync(munPath)) {
    console.log(
      "   ⚠️  IBGE: arquivos prisma/data/ibge-ufs.json ou ibge-municipios.json ausentes — pulando",
    );
    return;
  }
  const ufs = JSON.parse(fs.readFileSync(ufsPath, "utf8")) as Array<{
    sigla: string;
    nome: string;
  }>;
  const municipios = JSON.parse(fs.readFileSync(munPath, "utf8")) as Array<{
    id: number;
    nome: string;
    uf: string;
  }>;

  // SQL bruto: evita depender dos delegates `ibgeUf` / `ibgeMunicipio` nos tipos do
  // `PrismaClient` em layouts onde `ts-node` resolve um client gerado desatualizado.
  const MUN_BATCH = 400;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "ibge_municipios"`;
    await tx.$executeRaw`DELETE FROM "ibge_ufs"`;
    const ufRows = ufs.map((u) => Prisma.sql`(${u.sigla}, ${u.nome})`);
    await tx.$executeRaw`
      INSERT INTO "ibge_ufs" ("sigla", "nome")
      VALUES ${Prisma.join(ufRows)}
    `;
    for (let i = 0; i < municipios.length; i += MUN_BATCH) {
      const chunk = municipios.slice(i, i + MUN_BATCH);
      const munRows = chunk.map(
        (m) => Prisma.sql`(${m.id}, ${m.nome}, ${m.uf})`,
      );
      await tx.$executeRaw`
        INSERT INTO "ibge_municipios" ("id", "nome", "ufSigla")
        VALUES ${Prisma.join(munRows)}
      `;
    }
  });
  console.log(`   ✅ IBGE: ${ufs.length} UFs, ${municipios.length} municípios`);
}

async function seedAppSettings() {
  const existing = await prisma.appSettings.findFirst();
  if (existing) {
    console.log("⚙️  App settings already exist (signup / create-org flags)");
    return;
  }
  await prisma.appSettings.create({
    data: {
      signupEnabled: false,
      signupCreateOrganizationEnabled: false,
    },
  });
  console.log("✅ App settings created (public signup disabled, create org on signup disabled)");
}

async function main() {
  const args = process.argv.slice(2);

  const options: SeedOptions = {
    seedAdminUser: !args.includes("--skip-admin"),
    seedIbge: !args.includes("--skip-ibge"),
  };

  console.log("🚀 Starting Database Seeding");
  console.log("=============================");
  console.log(`Admin User: ${options.seedAdminUser ? "YES" : "SKIP"}`);
  console.log(`IBGE (UF/município): ${options.seedIbge ? "YES" : "SKIP"}`);
  console.log("");

  // 1. Seed App Settings
  console.log("⚙️  Seeding App Settings (feature flags)");
  console.log("----------------------------------------");
  await seedAppSettings();
  console.log("");

  if (options.seedIbge) {
    console.log("🗺️  IBGE localidades (referência)");
    console.log("----------------------------------");
    await seedIbgeLocalidades();
    console.log("");
  }

  // 2. Seed System Roles (RBAC)
  console.log("🔐 Seeding System Roles (RBAC)");
  console.log("-------------------------------");
  const roleIds = await seedSystemRoles();
  console.log("");

  let adminUserCreated = false;
  let organizationCreated = false;
  let organizationName = "";

  // 3. Seed Admin User
  if (options.seedAdminUser) {
    console.log("👤 Seeding Admin User & Organization");
    console.log("-------------------------------------");
    const adminResult = await seedAdminUser(roleIds.ORGANIZATION_OWNER);
    adminUserCreated = adminResult.adminUserCreated;
    organizationCreated = adminResult.organizationCreated;
    organizationName = adminResult.organizationName || "";
  }

  // Final summary
  console.log("\n" + "=".repeat(50));
  console.log("🎯 FINAL SEEDING SUMMARY");
  console.log("=".repeat(50));

  if (options.seedAdminUser) {
    console.log(`👤 Admin User:`);
    if (adminUserCreated) {
      const appDomain = process.env.APP_DOMAIN;
      console.log(`   ✓ Admin user created: admin@${appDomain}`);
      console.log(`   ✓ Language: pt`);
    } else {
      console.log(`   - Admin user already exists or APP_DOMAIN not configured`);
    }

    console.log(`\n🏢 Organization:`);
    if (organizationCreated) {
      console.log(`   ✓ Organization created: ${organizationName}`);
      console.log(`   ✓ Currency: BRL`);
      console.log(`   ✓ Admin role: Dono da Organização`);
    } else {
      console.log(`   - Organization already exists or was not created`);
    }
  }

  console.log("\n🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
