-- Step 1: Add isSystemUser to users
ALTER TABLE "users" ADD COLUMN "isSystemUser" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Create role_module enum
CREATE TYPE "role_module" AS ENUM ('VEHICLES', 'TRACKING', 'COMPANIES', 'USERS', 'REPORTS', 'DRIVERS', 'DOCUMENTS', 'FUEL', 'CHECKLIST', 'INCIDENTS', 'TELEMETRY', 'FINANCIAL');

-- Step 3: Create role_action enum
CREATE TYPE "role_action" AS ENUM ('VIEW', 'CREATE', 'EDIT', 'DELETE');

-- Step 4: Create role_scope enum
CREATE TYPE "role_scope" AS ENUM ('ALL', 'ASSIGNED');

-- Step 5: Rename Role enum to MemberRole
ALTER TYPE "Role" RENAME TO "MemberRole";

-- Step 6: Create roles table
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

-- Step 7: Create role_permissions table
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" "role_module" NOT NULL,
    "actions" "role_action"[],
    "scope" "role_scope" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- Step 8: Add indexes and foreign keys for roles
CREATE INDEX "roles_organizationId_idx" ON "roles"("organizationId");
ALTER TABLE "roles" ADD CONSTRAINT "roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 9: Add constraints for role_permissions
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_module_key" UNIQUE ("roleId", "module");

-- Step 10: Add nullable roleId to organizationMembers
ALTER TABLE "organizationMembers" ADD COLUMN "roleId" TEXT;

-- NOTE: After running seed to populate roles and migrate existing members, run migration 20260416183353_rbac_roles_notnull
