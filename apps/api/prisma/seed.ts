import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

interface SeedOptions {
  seedAdminUser: boolean;
}

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
    roleIds[key] = role.id;
  }

  return roleIds as Record<RoleKey, string>;
}

async function migrateExistingRoles(roleIds: Record<RoleKey, string>): Promise<void> {
  console.log("🔄 Migrating existing OrganizationMember roles...");

  // Use raw query to find members without roleId (avoids Prisma null-filter limitation)
  let rawMembers: Array<{ id: string; role: string }> = [];
  try {
    rawMembers = await prisma.$queryRaw<Array<{ id: string; role: string }>>`
      SELECT id, role FROM "organizationMembers" WHERE "roleId" IS NULL
    `;
  } catch {
    console.log("   ⚠️  Legacy 'role' column not found — assigning Dono da Empresa to all unmigrated members");
    const ids = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "organizationMembers" WHERE "roleId" IS NULL
    `;
    rawMembers = ids.map((m) => ({ id: m.id, role: 'OWNER' }));
  }

  if (rawMembers.length === 0) {
    console.log("   ✓ No members need migration (all have roleId set)");
    return;
  }

  console.log(`   Found ${rawMembers.length} members to migrate`);

  const roleMapping: Record<string, string> = {
    'OWNER': roleIds.COMPANY_OWNER,
    'ADMIN': roleIds.COMPANY_ADMIN,
    'MEMBER': roleIds.VIEWER,
  };

  let migrated = 0;
  for (const member of rawMembers) {
    const targetRoleId = roleMapping[member.role] ?? roleIds.VIEWER;
    await prisma.$executeRaw`
      UPDATE "organizationMembers"
      SET "roleId" = ${targetRoleId}
      WHERE id = ${member.id}
    `;
    migrated++;
  }

  console.log(`   ✅ Migrated ${migrated} members`);
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
  console.log(`✅ Admin added as Dono da Empresa`);

  return {
    adminUserCreated: true,
    organizationCreated: true,
    organizationName: organization.name
  };
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
  console.log("✅ App settings created (invitation-only: signup disabled, create org on signup disabled)");
}

async function main() {
  const args = process.argv.slice(2);

  const options: SeedOptions = {
    seedAdminUser: !args.includes("--skip-admin"),
  };

  console.log("🚀 Starting Database Seeding");
  console.log("=============================");
  console.log(`Admin User: ${options.seedAdminUser ? "YES" : "SKIP"}`);
  console.log("");

  // 1. Seed App Settings
  console.log("⚙️  Seeding App Settings (feature flags)");
  console.log("----------------------------------------");
  await seedAppSettings();
  console.log("");

  // 2. Seed System Roles (RBAC)
  console.log("🔐 Seeding System Roles (RBAC)");
  console.log("-------------------------------");
  const roleIds = await seedSystemRoles();
  console.log("");

  // 3. Migrate existing OrganizationMember roles
  console.log("🔄 Migrating existing member roles");
  console.log("-----------------------------------");
  await migrateExistingRoles(roleIds);
  console.log("");

  let adminUserCreated = false;
  let organizationCreated = false;
  let organizationName = "";

  // 4. Seed Admin User
  if (options.seedAdminUser) {
    console.log("👤 Seeding Admin User & Organization");
    console.log("-------------------------------------");
    const adminResult = await seedAdminUser(roleIds.COMPANY_OWNER);
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
      console.log(`   ✓ Admin role: Dono da Empresa`);
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
