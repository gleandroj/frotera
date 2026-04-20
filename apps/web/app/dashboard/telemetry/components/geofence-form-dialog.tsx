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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  telemetryAPI,
  customersAPI,
  type Customer,
  type GeofenceTypeApi,
  type GeofenceZone,
} from "@/lib/frontend/api-client";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { ResourceSelectCreateRow } from "@/components/resource-select-create-row";
import { CustomerFormDialog } from "@/app/dashboard/customers/customer-form-dialog";
import { DrawerStackParentDim } from "@/components/drawer-stack-parent-dim";
import { Action, Module, usePermissions } from "@/lib/hooks/use-permissions";
import { useAuth } from "@/lib/hooks/use-auth";
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
  const { user, selectedCustomerId, currentOrganization } = useAuth();
  const { can } = usePermissions();
  const canCreateCompany = can(Module.COMPANIES, Action.CREATE);
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [pickedCustomerId, setPickedCustomerId] = useState("");
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [nameSubmitError, setNameSubmitError] = useState(false);
  const [companySubmitError, setCompanySubmitError] = useState(false);
  const syncKey = `${open}-${zone?.id ?? "new"}`;

  useEffect(() => {
    if (!open) return;
    setNameSubmitError(false);
    setCompanySubmitError(false);
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
      setPickedCustomerId(customerId?.trim() ?? "");
    }
  }, [open, zone, customerId]);

  useEffect(() => {
    if (!open || isEdit || !organizationId) return;
    setLoadingCustomers(true);
    customersAPI
      .list(organizationId)
      .then((res) => setCustomers(res.data?.customers ?? []))
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [open, isEdit, organizationId]);

  const refreshCustomersSilently = () => {
    if (!organizationId) return;
    customersAPI
      .list(organizationId)
      .then((res) => setCustomers(res.data?.customers ?? []))
      .catch(() => setCustomers([]));
  };

  const selectedPickedCustomer = customers.find((c) => c.id === pickedCustomerId);

  const handleSave = async () => {
    if (saving) return;
    setNameSubmitError(false);
    setCompanySubmitError(false);
    if (!name.trim()) {
      setNameSubmitError(true);
      toast.error(t("telemetry.geofences.form.nameRequiredSubmit"));
      document.getElementById("geofence-zone-name")?.focus();
      return;
    }
    if (!isEdit && !pickedCustomerId.trim()) {
      setCompanySubmitError(true);
      toast.error(t("telemetry.geofences.form.companyRequiredPick"));
      return;
    }
    setSaving(true);
    try {
      const coordsForApi =
        type === "POLYGON"
          ? { points: coordinates.points }
          : coordinates;
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        coordinates: coordsForApi,
        vehicleIds: [...vehicleIds],
        alertOnEnter,
        alertOnExit,
        ...(isEdit ? { active } : {}),
      };
      if (isEdit) {
        await telemetryAPI.updateGeofence(organizationId, zone!.id, payload);
        toast.success(t("telemetry.geofences.updateSuccess"));
      } else {
        await telemetryAPI.createGeofence(organizationId, {
          ...payload,
          customerId: pickedCustomerId.trim(),
        });
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
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit
              ? t("telemetry.geofences.editZone")
              : t("telemetry.geofences.newZone")}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-1 flex-col gap-4 pb-6">
          {!isEdit ? (
            <div className="space-y-2">
              <Label>
                {t("telemetry.geofences.form.company")}
                <span className="ml-1 text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <ResourceSelectCreateRow
                showCreate={canCreateCompany}
                createLabel={t("common.createNewCompany")}
                onCreateClick={() => setCustomerFormOpen(true)}
                disabled={loadingCustomers}
              >
                <Popover
                  open={customerComboboxOpen}
                  onOpenChange={setCustomerComboboxOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      disabled={loadingCustomers}
                      className={cn(
                        "h-10 w-full justify-between font-normal",
                        !pickedCustomerId && "text-muted-foreground",
                        companySubmitError && "border-destructive ring-1 ring-destructive",
                      )}
                    >
                      <span className="truncate">
                        {pickedCustomerId && selectedPickedCustomer ? (
                          <span
                            style={{
                              paddingLeft: (selectedPickedCustomer.depth ?? 0) * 12,
                            }}
                            className="inline-block"
                          >
                            {selectedPickedCustomer.name}
                          </span>
                        ) : (
                          t("telemetry.geofences.form.selectCompany")
                        )}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput
                        placeholder={t("telemetry.geofences.form.filterCompany")}
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                        <CommandGroup>
                          {customers.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                setPickedCustomerId(c.id);
                                setCompanySubmitError(false);
                                setCustomerComboboxOpen(false);
                              }}
                            >
                              <span
                                style={{ paddingLeft: (c.depth ?? 0) * 12 }}
                                className="inline-block"
                              >
                                {c.name}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </ResourceSelectCreateRow>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>{t("telemetry.geofences.form.name")}</Label>
            <Input
              id="geofence-zone-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameSubmitError(false);
              }}
              placeholder={t("telemetry.geofences.form.namePlaceholder")}
              aria-invalid={nameSubmitError || undefined}
              className={cn(nameSubmitError && "border-destructive ring-1 ring-destructive")}
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
                  const prev = coordinates;
                  const pts = Array.isArray(prev.points)
                    ? (prev.points as unknown[][])
                    : [];
                  if (pts.length > 0) {
                    const p0 = pts[0]!;
                    setCoordinates({
                      center: [Number(p0[0]), Number(p0[1])],
                      radius: 500,
                    });
                  } else if (Array.isArray(prev.center) && prev.center.length >= 2) {
                    setCoordinates({
                      center: [Number(prev.center[0]), Number(prev.center[1])],
                      radius:
                        typeof prev.radius === "number" && Number.isFinite(prev.radius)
                          ? prev.radius
                          : 500,
                    });
                  } else {
                    setCoordinates({
                      center: [-15.77972, -47.92972],
                      radius: 500,
                    });
                  }
                } else {
                  setCoordinates({
                    points: [],
                    ...(Array.isArray(coordinates.center) && coordinates.center.length >= 2
                      ? {
                          center: coordinates.center,
                          radius:
                            typeof coordinates.radius === "number"
                              ? coordinates.radius
                              : 500,
                        }
                      : {}),
                  });
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
            preferBrowserCenter={!zone}
          />
          <div className="space-y-2">
            <Label>{t("telemetry.geofences.form.vehicles")}</Label>
            <VehicleMultiSelect
              organizationId={organizationId}
              customerId={
                isEdit ? zone?.customerId ?? customerId : pickedCustomerId || customerId
              }
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
          <Button onClick={() => void handleSave()} className="mt-2">
            {saving ? "…" : t("common.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    <DrawerStackParentDim show={customerFormOpen} />
    <CustomerFormDialog
      open={customerFormOpen}
      onOpenChange={setCustomerFormOpen}
      customer={null}
      organizationId={organizationId}
      customers={customers}
      defaultParentId={
        selectedCustomerId ??
        (pickedCustomerId.trim() ? pickedCustomerId.trim() : undefined)
      }
      allowRootCreation={user?.isSuperAdmin === true || currentOrganization?.role?.key === 'ORGANIZATION_OWNER'}
      hideOverlay
      onSuccess={(created) => {
        refreshCustomersSilently();
        if (created?.id) {
          setPickedCustomerId(created.id);
          setCompanySubmitError(false);
        }
      }}
    />
    </>
  );
}
