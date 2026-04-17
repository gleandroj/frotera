-- CreateEnum
CREATE TYPE "checklist_driver_requirement" AS ENUM ('REQUIRED', 'OPTIONAL', 'HIDDEN');

-- AlterTable
ALTER TABLE "checklist_templates" ADD COLUMN "vehicleRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "checklist_templates" ADD COLUMN "driverRequirement" "checklist_driver_requirement" NOT NULL DEFAULT 'OPTIONAL';

-- AlterTable (vehicle optional on entries when template allows)
ALTER TABLE "checklist_entries" ALTER COLUMN "vehicleId" DROP NOT NULL;
