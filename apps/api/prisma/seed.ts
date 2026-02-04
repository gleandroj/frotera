import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

interface SeedOptions {
  seedAdminUser: boolean;
}

async function seedAdminUser() {
  const appDomain = process.env.APP_DOMAIN;

  if (!appDomain) {
    console.log("⚠️  Warning: APP_DOMAIN not found - Admin user will not be created");
    return { adminUserCreated: false, organizationCreated: false };
  }

  const adminEmail = `admin@${appDomain}`;
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123"; // Default password, should be changed

  // Check if admin user already exists
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

  // Hash password
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Create admin user with pt language
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      name: "Admin",
      language: "pt",
      isSuperAdmin: true,
      emailVerified: new Date(), // Mark as verified
    },
  });

  console.log(`✅ Admin user created: ${adminEmail}`);
  if (adminPassword === "admin123") {
    console.log(`⚠️  Warning: Using default password. Please change it after first login.`);
  }

  // Create default organization for admin
  const orgName = appDomain.split('.')[0].charAt(0).toUpperCase() + appDomain.split('.')[0].slice(1);

  const organization = await prisma.organization.create({
    data: {
      name: `${orgName}`,
      description: "Organização padrão do administrador",
      currency: "BRL",
      memberships: {
        create: {
          userId: adminUser.id,
          role: "OWNER",
        },
      },
    },
  });

  console.log(`✅ Organization created: ${organization.name}`);
  console.log(`✅ Admin added as OWNER of organization`);

  return {
    adminUserCreated: true,
    organizationCreated: true,
    organizationName: organization.name
  };
}

async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const options: SeedOptions = {
    seedAdminUser: !args.includes("--skip-admin"),
  };

  console.log("🚀 Starting Database Seeding");
  console.log("=============================");
  console.log(`Admin User: ${options.seedAdminUser ? "YES" : "SKIP"}`);
  console.log("");

  let adminUserCreated = false;
  let organizationCreated = false;
  let organizationName = "";

  // Seed Admin User
  if (options.seedAdminUser) {
    console.log("👤 Seeding Admin User & Organization");
    console.log("-------------------------------------");
    const adminResult = await seedAdminUser();
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
      console.log(`   ✓ Admin role: OWNER`);
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
