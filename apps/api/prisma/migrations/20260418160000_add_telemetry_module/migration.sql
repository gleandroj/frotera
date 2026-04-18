-- CreateEnum
CREATE TYPE "alert_type" AS ENUM ('SPEEDING', 'HARSH_BRAKING', 'RAPID_ACCELERATION', 'GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'DEVICE_OFFLINE', 'LOW_BATTERY', 'IGNITION_ON', 'IGNITION_OFF');

-- CreateEnum
CREATE TYPE "alert_severity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "geofence_type" AS ENUM ('CIRCLE', 'POLYGON');

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "speedLimit" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "telemetry_alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "deviceId" TEXT NOT NULL,
    "type" "alert_type" NOT NULL,
    "severity" "alert_severity" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofence_zones" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "geofence_type" NOT NULL,
    "coordinates" JSONB NOT NULL,
    "vehicleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alertOnEnter" BOOLEAN NOT NULL DEFAULT true,
    "alertOnExit" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geofence_zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telemetry_alerts_organizationId_idx" ON "telemetry_alerts"("organizationId");

-- CreateIndex
CREATE INDEX "telemetry_alerts_vehicleId_idx" ON "telemetry_alerts"("vehicleId");

-- CreateIndex
CREATE INDEX "telemetry_alerts_deviceId_idx" ON "telemetry_alerts"("deviceId");

-- CreateIndex
CREATE INDEX "telemetry_alerts_type_idx" ON "telemetry_alerts"("type");

-- CreateIndex
CREATE INDEX "telemetry_alerts_createdAt_idx" ON "telemetry_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "telemetry_alerts_acknowledgedAt_idx" ON "telemetry_alerts"("acknowledgedAt");

-- CreateIndex
CREATE INDEX "geofence_zones_organizationId_idx" ON "geofence_zones"("organizationId");

-- CreateIndex
CREATE INDEX "geofence_zones_active_idx" ON "geofence_zones"("active");

-- AddForeignKey
ALTER TABLE "telemetry_alerts" ADD CONSTRAINT "telemetry_alerts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_alerts" ADD CONSTRAINT "telemetry_alerts_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_alerts" ADD CONSTRAINT "telemetry_alerts_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "tracker_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_alerts" ADD CONSTRAINT "telemetry_alerts_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "organizationMembers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofence_zones" ADD CONSTRAINT "geofence_zones_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
