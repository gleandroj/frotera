"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { driversAPI, vehiclesAPI, type Vehicle } from "@/lib/frontend/api-client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";

interface AssignVehicleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  driverId: string;
  driverName?: string;
  onSuccess: () => void;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

function toIsoStartOfDay(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString();
}

function toIsoEndOfDay(value: string): string {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function assignmentErrorMessage(t: (key: string) => string, code?: string) {
  if (code === "DRIVER_ASSIGNMENT_INVALID_PERIOD") {
    return t("drivers.assignmentErrors.invalidPeriod");
  }
  if (code === "DRIVER_ASSIGNMENT_OVERLAP") {
    return t("drivers.assignmentErrors.overlap");
  }
  if (code === "DRIVER_PRIMARY_ASSIGNMENT_OVERLAP") {
    return t("drivers.assignmentErrors.primaryOverlap");
  }
  if (code === "COMMON_ALREADY_EXISTS") {
    return t("drivers.assignmentErrors.overlap");
  }
  return t("drivers.toastError");
}

export function AssignVehicleSheet({
  open,
  onOpenChange,
  organizationId,
  driverId,
  driverName,
  onSuccess,
}: AssignVehicleSheetProps) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [vehicleId, setVehicleId] = useState("");
  const [startDate, setStartDate] = useState(TODAY());
  const [isIndeterminate, setIsIndeterminate] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingVehicles(true);
    vehiclesAPI
      .list(organizationId)
      .then((res) => setVehicles((res.data ?? []).filter((vehicle) => !vehicle.inactive)))
      .catch(() => setVehicles([]))
      .finally(() => setLoadingVehicles(false));
  }, [open, organizationId]);

  useEffect(() => {
    if (!open) return;
    setVehicleId("");
    setStartDate(TODAY());
    setIsIndeterminate(true);
    setEndDate("");
    setIsPrimary(false);
  }, [open]);

  const canSubmit = useMemo(() => {
    if (!vehicleId || !startDate) return false;
    if (isIndeterminate) return true;
    return !!endDate;
  }, [vehicleId, startDate, isIndeterminate, endDate]);

  const handleSubmit = async () => {
    if (!vehicleId || !startDate) {
      toast.error(t("drivers.assignmentErrors.requiredFields"));
      return;
    }
    if (!isIndeterminate && endDate && endDate <= startDate) {
      toast.error(t("drivers.assignmentErrors.invalidPeriod"));
      return;
    }

    setSubmitting(true);
    try {
      await driversAPI.assignVehicle(organizationId, driverId, {
        vehicleId,
        isPrimary,
        startDate: toIsoStartOfDay(startDate),
        endDate: isIndeterminate ? undefined : toIsoEndOfDay(endDate),
      });
      toast.success(t("drivers.assignmentCreated"));
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(assignmentErrorMessage(t, code));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("drivers.assignVehicle")}</SheetTitle>
          {driverName && <SheetDescription>{driverName}</SheetDescription>}
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>{t("drivers.vehicle")}</Label>
            <Select value={vehicleId} onValueChange={setVehicleId} disabled={loadingVehicles}>
              <SelectTrigger>
                <SelectValue placeholder={t("drivers.selectVehicle")} />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate ? `${vehicle.plate} - ` : ""}
                    {vehicle.name ?? t("common.notAvailable")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("drivers.assignmentStartDate")}</Label>
            <DatePicker value={startDate} onChange={setStartDate} />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("drivers.indeterminatePeriod")}</p>
              <p className="text-xs text-muted-foreground">{t("drivers.indeterminatePeriodHint")}</p>
            </div>
            <Switch checked={isIndeterminate} onCheckedChange={setIsIndeterminate} />
          </div>

          {!isIndeterminate && (
            <div className="space-y-2">
              <Label>{t("drivers.assignmentEndDate")}</Label>
              <DatePicker value={endDate} onChange={setEndDate} allowClear />
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("drivers.primary")}</p>
              <p className="text-xs text-muted-foreground">{t("drivers.primaryAssignmentHint")}</p>
            </div>
            <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
          </div>
        </div>

        <SheetFooter className="mt-6 flex flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting || !canSubmit}>
            {submitting ? t("common.saving") : t("drivers.assignVehicle")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
