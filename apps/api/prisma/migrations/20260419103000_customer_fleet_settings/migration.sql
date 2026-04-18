-- CreateTable
CREATE TABLE "customer_fleet_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "deviceOfflineThresholdMinutes" INTEGER,
    "defaultSpeedLimitKmh" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_fleet_settings_pkey" PRIMARY KEY ("id")
);

-- At most one org-wide row per organization (customerId IS NULL)
CREATE UNIQUE INDEX "customer_fleet_settings_org_default_unique"
ON "customer_fleet_settings" ("organizationId")
WHERE "customerId" IS NULL;

-- At most one row per (organization, customer) when customer is set
CREATE UNIQUE INDEX "customer_fleet_settings_org_customer_unique"
ON "customer_fleet_settings" ("organizationId", "customerId")
WHERE "customerId" IS NOT NULL;

CREATE INDEX "customer_fleet_settings_organizationId_idx" ON "customer_fleet_settings"("organizationId");

ALTER TABLE "customer_fleet_settings" ADD CONSTRAINT "customer_fleet_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_fleet_settings" ADD CONSTRAINT "customer_fleet_settings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate previous organization-level columns into org-wide defaults
INSERT INTO "customer_fleet_settings" ("id", "organizationId", "customerId", "deviceOfflineThresholdMinutes", "defaultSpeedLimitKmh", "createdAt", "updatedAt")
SELECT concat('cfs_', replace(gen_random_uuid()::text, '-', '')), o."id", NULL, o."deviceOfflineThresholdMinutes", o."defaultSpeedLimitKmh", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" o
WHERE o."deviceOfflineThresholdMinutes" IS NOT NULL OR o."defaultSpeedLimitKmh" IS NOT NULL;

ALTER TABLE "organizations" DROP COLUMN IF EXISTS "deviceOfflineThresholdMinutes";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "defaultSpeedLimitKmh";
