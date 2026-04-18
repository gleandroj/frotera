-- Remove NT20 tracker model (migrate existing devices to X12_GT06 first)
UPDATE "tracker_devices" SET "model" = 'X12_GT06' WHERE "model" = 'X22_NT20';
ALTER TYPE "TrackerModel" RENAME TO "TrackerModel_old";
CREATE TYPE "TrackerModel" AS ENUM ('X12_GT06');
ALTER TABLE "tracker_devices" ALTER COLUMN "model" TYPE "TrackerModel" USING "model"::text::"TrackerModel";
DROP TYPE "TrackerModel_old";

-- Add new AlertType values
ALTER TYPE "alert_type" ADD VALUE 'SOS';
ALTER TYPE "alert_type" ADD VALUE 'POWER_CUT';
ALTER TYPE "alert_type" ADD VALUE 'SHOCK';

-- Add GT06 status fields to device_positions
ALTER TABLE "device_positions"
  ADD COLUMN "ignitionOn"   BOOLEAN,
  ADD COLUMN "voltageLevel" INTEGER,
  ADD COLUMN "gsmSignal"    INTEGER,
  ADD COLUMN "alarmCode"    INTEGER,
  ADD COLUMN "chargeOn"     BOOLEAN,
  ADD COLUMN "powerCut"     BOOLEAN,
  ADD COLUMN "lbsMcc"       INTEGER,
  ADD COLUMN "lbsMnc"       INTEGER,
  ADD COLUMN "lbsLac"       INTEGER,
  ADD COLUMN "lbsCellId"    INTEGER;

-- Create DeviceStatusLog table
CREATE TABLE "device_status_logs" (
  "id"           TEXT NOT NULL,
  "deviceId"     TEXT NOT NULL,
  "recordedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ignitionOn"   BOOLEAN,
  "voltageLevel" INTEGER,
  "gsmSignal"    INTEGER,
  "alarmCode"    INTEGER,
  "chargeOn"     BOOLEAN,
  "powerCut"     BOOLEAN,

  CONSTRAINT "device_status_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "device_status_logs_deviceId_recordedAt_idx" ON "device_status_logs"("deviceId", "recordedAt");

ALTER TABLE "device_status_logs"
  ADD CONSTRAINT "device_status_logs_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "tracker_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
