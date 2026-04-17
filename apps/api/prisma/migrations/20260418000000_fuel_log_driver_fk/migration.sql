-- Add FK from fuel_logs.driverId -> drivers.id (column already optional on fuel_logs)
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
