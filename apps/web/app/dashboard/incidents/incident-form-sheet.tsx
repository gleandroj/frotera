"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  incidentsAPI,
  vehiclesAPI,
  driversAPI,
  type Driver,
  type Incident,
  type Vehicle,
} from "@/lib/frontend/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { toast } from "sonner";
import { ResourceSelectCreateRow } from "@/components/resource-select-create-row";
import { VehicleFormDialog } from "@/app/dashboard/vehicles/vehicle-form-dialog";
import { DriverFormDialog } from "@/app/dashboard/drivers/driver-form-dialog";
import { DrawerStackParentDim } from "@/components/drawer-stack-parent-dim";
import { Action, Module, usePermissions } from "@/lib/hooks/use-permissions";

const INCIDENT_TYPES = [
  "ACCIDENT",
  "THEFT",
  "FINE",
  "BREAKDOWN",
  "VANDALISM",
  "OTHER",
] as const;

const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

/** Radix Select não aceita value vazio para “sem motorista”. */
const DRIVER_NONE = "__none__";

function defaultCreateState() {
  return {
    type: "ACCIDENT" as string,
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    location: "",
    severity: "LOW" as string,
    vehicleId: "",
    driverId: "",
    cost: "",
    insuranceClaim: false,
    claimNumber: "",
    notes: "",
  };
}

export interface IncidentFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  selectedCustomerId: string | null;
  /** Quando informado, o sheet funciona em modo edição (campos básicos). */
  incident?: Incident | null;
  onSuccess: (incident: Incident) => void;
}

export function IncidentFormSheet({
  open,
  onOpenChange,
  organizationId,
  selectedCustomerId,
  incident,
  onSuccess,
}: IncidentFormSheetProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const isEdit = !!incident;
  const canCreateVehicle = can(Module.VEHICLES, Action.CREATE);
  const canCreateDriver = can(Module.DRIVERS, Action.CREATE);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [driverFormOpen, setDriverFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("ACCIDENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState("LOW");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [cost, setCost] = useState("");
  const [insuranceClaim, setInsuranceClaim] = useState(false);
  const [claimNumber, setClaimNumber] = useState("");
  const [notes, setNotes] = useState("");

  const listParams = {
    customerId: selectedCustomerId ?? undefined,
  };

  const refreshVehiclesSilently = () => {
    if (!organizationId) return;
    vehiclesAPI
      .list(organizationId, listParams)
      .then((res) => {
        if (Array.isArray(res.data)) setVehicles(res.data);
      })
      .catch(() => setVehicles([]));
  };

  const refreshDriversSilently = () => {
    if (!organizationId) return;
    driversAPI
      .list(organizationId, selectedCustomerId ? { customerId: selectedCustomerId } : undefined)
      .then((res) => {
        setDrivers(Array.isArray(res.data?.drivers) ? res.data.drivers : []);
      })
      .catch(() => setDrivers([]));
  };

  useEffect(() => {
    if (!open) return;
    if (isEdit && incident) {
      setTitle(incident.title);
      setDescription(incident.description ?? "");
      setLocation(incident.location ?? "");
      setNotes(incident.notes ?? "");
      setError(null);
      return;
    }
    if (!isEdit) {
      const d = defaultCreateState();
      setType(d.type);
      setTitle(d.title);
      setDescription(d.description);
      setDate(d.date);
      setLocation(d.location);
      setSeverity(d.severity);
      setVehicleId(d.vehicleId);
      setDriverId(d.driverId);
      setCost(d.cost);
      setInsuranceClaim(d.insuranceClaim);
      setClaimNumber(d.claimNumber);
      setNotes(d.notes);
      setError(null);

      setLoadingVehicles(true);
      vehiclesAPI
        .list(organizationId, listParams)
        .then((res) => {
          if (Array.isArray(res.data)) setVehicles(res.data);
        })
        .catch(() => setVehicles([]))
        .finally(() => setLoadingVehicles(false));

      setLoadingDrivers(true);
      driversAPI
        .list(
          organizationId,
          selectedCustomerId ? { customerId: selectedCustomerId } : undefined,
        )
        .then((res) => {
          setDrivers(Array.isArray(res.data?.drivers) ? res.data.drivers : []);
        })
        .catch(() => setDrivers([]))
        .finally(() => setLoadingDrivers(false));
    }
  }, [
    open,
    isEdit,
    incident?.id,
    incident?.updatedAt,
    organizationId,
    selectedCustomerId,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("incidents.toast.error"));
      return;
    }
    setSubmitting(true);
    setError(null);

    if (isEdit && incident) {
      incidentsAPI
        .update(organizationId, incident.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        })
        .then((res) => {
          toast.success(t("incidents.toast.updated"));
          onSuccess(res.data);
          onOpenChange(false);
        })
        .catch((err) => {
          setError(getApiErrorMessage(err, t));
          toast.error(t("incidents.toast.error"));
        })
        .finally(() => setSubmitting(false));
      return;
    }

    const costNum = cost.trim() === "" ? undefined : Number(cost.replace(",", "."));
    const payload: Record<string, unknown> = {
      type,
      title: title.trim(),
      date: date.includes("T") ? date : `${date}T12:00:00.000Z`,
      severity,
      insuranceClaim,
    };
    if (description.trim()) payload.description = description.trim();
    if (location.trim()) payload.location = location.trim();
    if (vehicleId) payload.vehicleId = vehicleId;
    if (driverId && driverId !== DRIVER_NONE) payload.driverId = driverId;
    if (
      !vehicleId &&
      (!driverId || driverId === DRIVER_NONE) &&
      selectedCustomerId
    ) {
      payload.customerId = selectedCustomerId;
    }
    if (
      !vehicleId &&
      (!driverId || driverId === DRIVER_NONE) &&
      !selectedCustomerId
    ) {
      setSubmitting(false);
      setError(t("incidents.customerRequiredForNoVehicle"));
      toast.error(t("incidents.customerRequiredForNoVehicle"));
      return;
    }
    if (costNum !== undefined && !Number.isNaN(costNum)) payload.cost = costNum;
    if (insuranceClaim && claimNumber.trim()) payload.claimNumber = claimNumber.trim();
    if (notes.trim()) payload.notes = notes.trim();

    incidentsAPI
      .create(organizationId, payload)
      .then((res) => {
        toast.success(t("incidents.toast.created"));
        onSuccess(res.data);
        onOpenChange(false);
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, t));
        toast.error(t("incidents.toast.error"));
      })
      .finally(() => setSubmitting(false));
  };

  const driverSelectDisabled = submitting || loadingDrivers;
  const vehicleSelectDisabled = submitting || loadingVehicles;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]">
          <SheetHeader className="border-b px-6 pb-4 pt-6">
            <SheetTitle>
              {isEdit ? t("incidents.editIncident") : t("incidents.newIncident")}
            </SheetTitle>
          </SheetHeader>

          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              {!isEdit ? (
                <div className="space-y-2">
                  <Label>{t("incidents.fields.type")}</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("incidents.form.selectType")} />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_TYPES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {t(`incidents.type.${v}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="incident-title">{t("incidents.fields.title")}</Label>
                <Input
                  id="incident-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("incidents.form.titlePlaceholder")}
                  required
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="incident-description">{t("incidents.fields.description")}</Label>
                <Textarea
                  id="incident-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("incidents.form.descriptionPlaceholder")}
                  rows={4}
                  maxLength={2000}
                />
              </div>

              {!isEdit ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="incident-date">{t("incidents.fields.date")}</Label>
                      <Input
                        id="incident-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="incident-severity">{t("incidents.fields.severity")}</Label>
                      <Select value={severity} onValueChange={setSeverity}>
                        <SelectTrigger id="incident-severity">
                          <SelectValue placeholder={t("incidents.form.selectSeverity")} />
                        </SelectTrigger>
                        <SelectContent>
                          {INCIDENT_SEVERITIES.map((v) => (
                            <SelectItem key={v} value={v}>
                              {t(`incidents.severity.${v}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-location">{t("incidents.fields.location")}</Label>
                    <Input
                      id="incident-location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder={t("incidents.form.locationPlaceholder")}
                      maxLength={300}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {t("incidents.fields.vehicle")}
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({t("common.optional")})
                      </span>
                    </Label>
                    <ResourceSelectCreateRow
                      showCreate={canCreateVehicle}
                      createLabel={t("common.createNewVehicle")}
                      onCreateClick={() => setVehicleFormOpen(true)}
                      disabled={vehicleSelectDisabled}
                    >
                      <Select
                        value={vehicleId || "none"}
                        onValueChange={(v) => setVehicleId(v === "none" ? "" : v)}
                        disabled={vehicleSelectDisabled}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("incidents.form.selectVehicle")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("incidents.form.noVehicle")}</SelectItem>
                          {vehicles.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {[v.name, v.plate].filter(Boolean).join(" · ") || v.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ResourceSelectCreateRow>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {t("incidents.fields.driver")}
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({t("common.optional")})
                      </span>
                    </Label>
                    <ResourceSelectCreateRow
                      showCreate={canCreateDriver}
                      createLabel={t("common.createNewDriver")}
                      onCreateClick={() => setDriverFormOpen(true)}
                      disabled={driverSelectDisabled}
                    >
                      <Select
                        value={driverId || DRIVER_NONE}
                        onValueChange={(v) => setDriverId(v === DRIVER_NONE ? "" : v)}
                        disabled={driverSelectDisabled}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("incidents.form.selectDriver")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={DRIVER_NONE}>{t("incidents.form.noDriver")}</SelectItem>
                          {drivers.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ResourceSelectCreateRow>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-cost">{t("incidents.fields.cost")}</Label>
                    <Input
                      id="incident-cost"
                      type="text"
                      inputMode="decimal"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      placeholder={t("incidents.form.costPlaceholder")}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="incident-insurance"
                      checked={insuranceClaim}
                      onCheckedChange={(c) => setInsuranceClaim(c === true)}
                    />
                    <Label htmlFor="incident-insurance" className="cursor-pointer font-normal">
                      {t("incidents.fields.insuranceClaim")}
                    </Label>
                  </div>

                  {insuranceClaim ? (
                    <div className="space-y-2">
                      <Label htmlFor="incident-claim">{t("incidents.fields.claimNumber")}</Label>
                      <Input
                        id="incident-claim"
                        value={claimNumber}
                        onChange={(e) => setClaimNumber(e.target.value)}
                        placeholder={t("incidents.form.claimNumberPlaceholder")}
                        maxLength={100}
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="incident-location-edit">{t("incidents.fields.location")}</Label>
                  <Input
                    id="incident-location-edit"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t("incidents.form.locationPlaceholder")}
                    maxLength={300}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="incident-notes">{t("incidents.fields.notes")}</Label>
                <Textarea
                  id="incident-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("incidents.form.notesPlaceholder")}
                  rows={3}
                  maxLength={2000}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t bg-background px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={submitting || !title.trim()}>
                {submitting
                  ? t("common.loading")
                  : isEdit
                    ? t("common.save")
                    : t("incidents.form.submit")}
              </Button>
            </div>
          </form>

          <DrawerStackParentDim show={vehicleFormOpen || driverFormOpen} />
        </SheetContent>
      </Sheet>

      {!isEdit ? (
        <>
          <VehicleFormDialog
            open={vehicleFormOpen}
            onOpenChange={setVehicleFormOpen}
            vehicle={null}
            organizationId={organizationId}
            defaultCustomerId={selectedCustomerId}
            hideOverlay
            onSuccess={(created) => {
              refreshVehiclesSilently();
              if (created?.id) setVehicleId(created.id);
            }}
          />
          <DriverFormDialog
            open={driverFormOpen}
            onOpenChange={setDriverFormOpen}
            driver={null}
            organizationId={organizationId}
            defaultCustomerId={selectedCustomerId}
            hideOverlay
            onSuccess={(created) => {
              refreshDriversSilently();
              if (created?.id) setDriverId(created.id);
            }}
          />
        </>
      ) : null}
    </>
  );
}
