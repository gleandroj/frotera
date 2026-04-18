-- Merge org-wide fleet defaults (customerId NULL) into per-customer rows, then require customerId.

UPDATE "customer_fleet_settings" AS cfs
SET
  "deviceOfflineThresholdMinutes" = COALESCE(
    cfs."deviceOfflineThresholdMinutes",
    org."deviceOfflineThresholdMinutes"
  ),
  "defaultSpeedLimitKmh" = COALESCE(
    cfs."defaultSpeedLimitKmh",
    org."defaultSpeedLimitKmh"
  )
FROM "customer_fleet_settings" AS org
WHERE org."organizationId" = cfs."organizationId"
  AND org."customerId" IS NULL
  AND cfs."customerId" IS NOT NULL;

INSERT INTO "customer_fleet_settings" (
  "id",
  "organizationId",
  "customerId",
  "deviceOfflineThresholdMinutes",
  "defaultSpeedLimitKmh",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('cfs_', replace(gen_random_uuid()::text, '-', '')),
  c."organizationId",
  c."id",
  org."deviceOfflineThresholdMinutes",
  org."defaultSpeedLimitKmh",
  NOW(),
  NOW()
FROM "customers" c
INNER JOIN "customer_fleet_settings" org
  ON org."organizationId" = c."organizationId" AND org."customerId" IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM "customer_fleet_settings" x
  WHERE x."organizationId" = c."organizationId"
    AND x."customerId" = c."id"
);

DELETE FROM "customer_fleet_settings" WHERE "customerId" IS NULL;

ALTER TABLE "customer_fleet_settings" ALTER COLUMN "customerId" SET NOT NULL;

CREATE UNIQUE INDEX "customer_fleet_settings_organizationId_customerId_key"
  ON "customer_fleet_settings" ("organizationId", "customerId");
