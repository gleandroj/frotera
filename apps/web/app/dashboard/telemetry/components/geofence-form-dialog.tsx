"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "@/i18n/useTranslation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  telemetryAPI,
  type GeofenceTypeApi,
  type GeofenceZone,
} from "@/lib/frontend/api-client";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { VehicleMultiSelect } from "./vehicle-multi-select";

const GeofenceMapEditor = dynamic(
  () =>
    import("./geofence-map-editor").then((m) => ({
      default: m.GeofenceMapEditor,
    })),
  { ssr: false, loading: () => <p className="text-sm text-muted-foreground">…</p> },
);

export function GeofenceFormDialog({
  open,
  onOpenChange,
  organizationId,
  customerId,
  zone,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  /** Scope vehicle list to the selected customer filter when set. */
  customerId?: string | null;
  zone: GeofenceZone | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!zone;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<GeofenceTypeApi>("CIRCLE");
  const [coordinates, setCoordinates] = useState<Record<string, unknown>>({
    center: [-15.77972, -47.92972],
    radius: 500,
  });
  const [vehicleIds, setVehicleIds] = useState<string[]>([]);
  const [alertOnEnter, setAlertOnEnter] = useState(true);
  const [alertOnExit, setAlertOnExit] = useState(true);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const syncKey = `${open}-${zone?.id ?? "new"}`;

  useEffect(() => {
    if (!open) return;
    if (zone) {
      setName(zone.name);
      setDescription(zone.description ?? "");
      setType(zone.type);
      setCoordinates(
        (zone.coordinates as Record<string, unknown>) ?? {
          center: [-15.77972, -47.92972],
          radius: 500,
        },
      );
      setVehicleIds(zone.vehicleIds ?? []);
      setAlertOnEnter(zone.alertOnEnter);
      setAlertOnExit(zone.alertOnExit);
      setActive(zone.active);
    } else {
      setName("");
      setDescription("");
      setType("CIRCLE");
      setCoordinates({ center: [-15.77972, -47.92972], radius: 500 });
      setVehicleIds([]);
      setAlertOnEnter(true);
      setAlertOnExit(true);
      setActive(true);
    }
  }, [open, zone]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("telemetry.geofences.form.name"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        coordinates,
        vehicleIds: [...vehicleIds],
        alertOnEnter,
        alertOnExit,
        ...(isEdit ? { active } : {}),
      };
      if (isEdit) {
        await telemetryAPI.updateGeofence(organizationId, zone!.id, payload);
        toast.success(t("telemetry.geofences.updateSuccess"));
      } else {
        await telemetryAPI.createGeofence(organizationId, payload);
        toast.success(t("telemetry.geofences.createSuccess"));
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t, "common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {isEdit
              ? t("telemetry.geofences.editZone")
              : t("telemetry.geofences.newZone")}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-1 flex-col gap-4 pb-6">
          <div className="space-y-2">
            <Label>{t("telemetry.geofences.form.name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("telemetry.geofences.form.namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("telemetry.geofences.form.description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("telemetry.geofences.form.type")}</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                const nt = v as GeofenceTypeApi;
                setType(nt);
                if (nt === "CIRCLE") {
                  setCoordinates({ center: [-15.77972, -47.92972], radius: 500 });
                } else {
                  setCoordinates({ points: [] });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CIRCLE">
                  {t("telemetry.geofences.form.typeCircle")}
                </SelectItem>
                <SelectItem value="POLYGON">
                  {t("telemetry.geofences.form.typePolygon")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <GeofenceMapEditor
            syncKey={syncKey}
            type={type}
            coordinates={coordinates}
            onChange={setCoordinates}
          />
          <div className="space-y-2">
            <Label>{t("telemetry.geofences.form.vehicles")}</Label>
            <VehicleMultiSelect
              organizationId={organizationId}
              customerId={customerId}
              value={vehicleIds}
              onChange={setVehicleIds}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              {t("telemetry.geofences.form.vehiclesHint")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="enter"
              checked={alertOnEnter}
              onCheckedChange={(c) => setAlertOnEnter(c === true)}
            />
            <Label htmlFor="enter">{t("telemetry.geofences.form.alertOnEnter")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="exit"
              checked={alertOnExit}
              onCheckedChange={(c) => setAlertOnExit(c === true)}
            />
            <Label htmlFor="exit">{t("telemetry.geofences.form.alertOnExit")}</Label>
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={active}
                onCheckedChange={(c) => setActive(c === true)}
              />
              <Label htmlFor="active">{t("telemetry.geofences.form.active")}</Label>
            </div>
          )}
          <Button onClick={handleSave} disabled={saving} className="mt-2">
            {saving ? "…" : t("common.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
