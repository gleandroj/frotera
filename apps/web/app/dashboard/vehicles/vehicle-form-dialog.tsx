"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  vehiclesAPI,
  trackerDevicesAPI,
  type Vehicle,
  type CreateVehiclePayload,
} from "@/lib/frontend/api-client";

const TRACKER_MODELS = [
  { value: "X12_GT06", label: "X12 GT06" },
  { value: "X22_NT20", label: "X22 NT20" },
] as const;

type DeviceOption = "none" | "existing" | "new";

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  organizationId: string;
  onSuccess: () => void;
}

interface TrackerDeviceOption {
  id: string;
  imei: string;
  model: string;
  name?: string | null;
  vehicleId?: string | null;
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  vehicle,
  organizationId,
  onSuccess,
}: VehicleFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!vehicle;

  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [trackerDeviceId, setTrackerDeviceId] = useState<string>("");
  const [devices, setDevices] = useState<TrackerDeviceOption[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New device (create only)
  const [deviceOption, setDeviceOption] = useState<DeviceOption>("none");
  const [newImei, setNewImei] = useState("");
  const [newModel, setNewModel] = useState<string>("X12_GT06");
  const [newDeviceName, setNewDeviceName] = useState("");

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoadingDevices(true);
    trackerDevicesAPI
      .list(organizationId)
      .then((res) => {
        setDevices(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setDevices([]))
      .finally(() => setLoadingDevices(false));
  }, [open, organizationId]);

  useEffect(() => {
    if (open) {
      setName(vehicle?.name ?? "");
      setPlate(vehicle?.plate ?? "");
      setTrackerDeviceId(vehicle?.trackerDeviceId ?? "");
      setError(null);
      setDeviceOption("none");
      setNewImei("");
      setNewModel("X12_GT06");
      setNewDeviceName("");
    }
  }, [open, vehicle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isEdit && deviceOption === "new" && !newImei.trim()) {
      setError(t("vehicles.imeiRequired"));
      return;
    }
    setSubmitting(true);

    let payload: CreateVehiclePayload;
    if (isEdit) {
      payload = {
        name: name.trim() || undefined,
        plate: plate.trim() || undefined,
        trackerDeviceId: trackerDeviceId || undefined,
      };
    } else {
      if (deviceOption === "new" && newImei.trim()) {
        payload = {
          name: name.trim() || undefined,
          plate: plate.trim() || undefined,
          newDevice: {
            imei: newImei.trim(),
            model: newModel,
            name: newDeviceName.trim() || undefined,
          },
        };
      } else if (deviceOption === "existing" && trackerDeviceId) {
        payload = {
          name: name.trim() || undefined,
          plate: plate.trim() || undefined,
          trackerDeviceId,
        };
      } else {
        payload = {
          name: name.trim() || undefined,
          plate: plate.trim() || undefined,
        };
      }
    }

    const promise = isEdit
      ? vehiclesAPI.update(organizationId, vehicle!.id, payload)
      : vehiclesAPI.create(organizationId, payload);

    promise
      .then(() => {
        onSuccess();
        onOpenChange(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.message ?? t("common.error"));
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("vehicles.editVehicle") : t("vehicles.createVehicle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="vehicle-name">{t("common.name")}</Label>
            <Input
              id="vehicle-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("common.name")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-plate">{t("vehicles.plate")}</Label>
            <Input
              id="vehicle-plate"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder={t("vehicles.plate")}
            />
          </div>

          {isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="vehicle-device">{t("vehicles.device")}</Label>
              <Select
                value={trackerDeviceId || "none"}
                onValueChange={(v) => setTrackerDeviceId(v === "none" ? "" : v)}
                disabled={loadingDevices}
              >
                <SelectTrigger id="vehicle-device">
                  <SelectValue placeholder={t("vehicles.noDevice")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("vehicles.noDevice")}</SelectItem>
                  {devices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="font-mono text-xs">{d.imei}</span>
                      <span className="text-muted-foreground ml-1">
                        ({d.model})
                        {d.name ? ` · ${d.name}` : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{t("vehicles.deviceAssociation")}</Label>
                <Select
                  value={deviceOption}
                  onValueChange={(v) => setDeviceOption(v as DeviceOption)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("vehicles.deviceOptionNone")}
                    </SelectItem>
                    <SelectItem value="existing">
                      {t("vehicles.deviceOptionExisting")}
                    </SelectItem>
                    <SelectItem value="new">
                      {t("vehicles.deviceOptionNew")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {deviceOption === "existing" && (
                <div className="space-y-2">
                  <Label htmlFor="vehicle-device">{t("vehicles.device")}</Label>
                  <Select
                    value={trackerDeviceId || "none"}
                    onValueChange={(v) =>
                      setTrackerDeviceId(v === "none" ? "" : v)
                    }
                    disabled={loadingDevices}
                  >
                    <SelectTrigger id="vehicle-device">
                      <SelectValue placeholder={t("vehicles.noDevice")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t("vehicles.noDevice")}
                      </SelectItem>
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          <span className="font-mono text-xs">{d.imei}</span>
                          <span className="text-muted-foreground ml-1">
                            ({d.model})
                            {d.name ? ` · ${d.name}` : ""}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {deviceOption === "new" && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-device-imei">{t("vehicles.imei")}</Label>
                    <Input
                      id="new-device-imei"
                      value={newImei}
                      onChange={(e) => setNewImei(e.target.value)}
                      placeholder={t("vehicles.imeiPlaceholder")}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-device-model">
                      {t("vehicles.trackerModel")}
                    </Label>
                    <Select
                      value={newModel}
                      onValueChange={setNewModel}
                    >
                      <SelectTrigger id="new-device-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRACKER_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-device-name">
                      {t("vehicles.deviceNameOptional")}
                    </Label>
                    <Input
                      id="new-device-name"
                      value={newDeviceName}
                      onChange={(e) => setNewDeviceName(e.target.value)}
                      placeholder={t("common.name")}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? isEdit
                  ? t("common.updating")
                  : t("common.creating")
                : isEdit
                  ? t("common.update")
                  : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
