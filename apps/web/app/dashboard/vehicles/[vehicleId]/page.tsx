"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { vehiclesAPI, trackerDevicesAPI } from "@/lib/frontend/api-client";
import { useTrackerPositions } from "@/lib/hooks/use-tracker-positions";
import type { PositionPoint } from "@/components/devices/device-map";
import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/i18n/useTranslation";
import { Badge } from "@/components/ui/badge";
import type { Vehicle } from "@/lib/frontend/api-client";
import { ArrowLeft, Info, MapPin, Pencil, ClipboardList, Fuel, FileText, Users, AlertTriangle } from "lucide-react";
import { VehicleFormDialog } from "../vehicle-form-dialog";
import { VehicleChecklistsTab } from "./tabs/vehicle-checklists-tab";
import { VehicleFuelTab } from "./tabs/vehicle-fuel-tab";
import { VehicleDocumentsTab } from "./tabs/vehicle-documents-tab";
import { VehicleDriversTab } from "./tabs/vehicle-drivers-tab";
import { VehicleIncidentsTab } from "./tabs/vehicle-incidents-tab";

const DeviceMapDynamic = dynamic(
  () =>
    import("@/components/devices/device-map").then((mod) => ({
      default: mod.DeviceMap,
    })),
  { ssr: false }
);

function vehicleClassificationLabel(
  t: (key: string) => string,
  segment: "species" | "bodyType" | "traction" | "useCategory",
  code: string | null | undefined,
): string {
  if (code == null || code === "") return "—";
  const key = `vehicles.classification.${segment}.${code}`;
  const label = t(key);
  return label === key ? code : label;
}

interface ApiPosition {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  recordedAt: string;
  createdAt: string;
}

function toPositionPoint(p: ApiPosition): PositionPoint {
  return {
    latitude: p.latitude,
    longitude: p.longitude,
    altitude: p.altitude ?? null,
    speed: p.speed ?? null,
    heading: p.heading ?? null,
    recordedAt: p.recordedAt,
  };
}

export default function VehicleDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleId = typeof params?.vehicleId === "string" ? params.vehicleId : null;
  const { currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const canEditVehicle = can(Module.VEHICLES, Action.EDIT);
  const canViewChecklist = can(Module.CHECKLIST, Action.VIEW);
  const canViewFuel = can(Module.FUEL, Action.VIEW);
  const canViewDocuments = can(Module.DOCUMENTS, Action.VIEW);
  const canViewDrivers = can(Module.DRIVERS, Action.VIEW);
  const canViewIncidents = can(Module.INCIDENTS, Action.VIEW);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [initialHistory, setInitialHistory] = useState<PositionPoint[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") ?? "info");

  const deviceId = vehicle?.trackerDevice?.id ?? null;

  const refetchVehicle = useCallback(() => {
    if (!vehicleId || !currentOrganization?.id) return;
    vehiclesAPI
      .get(currentOrganization.id, vehicleId)
      .then((res) => setVehicle(res.data as Vehicle))
      .catch(() => {});
  }, [vehicleId, currentOrganization?.id]);

  const {
    positions: streamedPositions,
    lastPosition: streamLastPosition,
    connected,
  } = useTrackerPositions(deviceId, currentOrganization?.id ?? null);

  const streamedAsPoints = useMemo(
    () => streamedPositions as PositionPoint[],
    [streamedPositions]
  );
  const lastPosition = useMemo((): PositionPoint | null => {
    if (streamLastPosition) return streamLastPosition as PositionPoint;
    if (initialHistory.length > 0)
      return initialHistory[initialHistory.length - 1] ?? null;
    return null;
  }, [streamLastPosition, initialHistory]);

  useEffect(() => {
    if (!vehicleId || !currentOrganization?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    vehiclesAPI
      .get(currentOrganization.id, vehicleId)
      .then((res) => {
        if (cancelled) return;
        const v = res.data as Vehicle;
        setVehicle(v);
        if (v?.trackerDevice?.id) {
          return trackerDevicesAPI.getPositionHistory(
            currentOrganization.id!,
            v.trackerDevice.id,
            { limit: 100 }
          ).then((historyRes) => {
            if (cancelled) return;
            const list = Array.isArray(historyRes.data) ? historyRes.data : [];
            setInitialHistory(list.map((p: ApiPosition) => toPositionPoint(p)));
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(err, t));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, currentOrganization?.id, t]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (vehicleId) {
      router.replace(`/dashboard/vehicles/${vehicleId}?tab=${value}`);
    }
  };

  const triggerClassName =
    "rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground/90 hover:border-border/40 data-[state=active]:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold shrink-0 focus-visible:z-10";

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          {t("vehicles.selectOrganization")}
        </p>
      </div>
    );
  }

  if (!vehicleId) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">{t("vehicles.vehicleNotFound")}</p>
      </div>
    );
  }

  const displayName = vehicle?.name ?? vehicle?.plate ?? t("vehicles.vehicle");
  const orgId = currentOrganization.id;

  return (
    <div className="space-y-6">
      {/* Page header: back + title + subtitle + action (reference pattern) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0 -ml-2" asChild>
              <Link href="/dashboard/vehicles" aria-label={t("vehicles.backToVehicles")}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">
                {t("vehicles.viewVehicle")}
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                {vehicle ? displayName : t("common.loading")}
              </p>
            </div>
          </div>
          {vehicle && canEditVehicle && (
            <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => setEditDialogOpen(true)}>
              <Pencil className="h-4 w-4" />
              {t("common.edit")}
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <p className="text-destructive">{loadError}</p>
      )}

      {loading && (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      )}

      {!loading && !loadError && vehicle && (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full h-auto flex flex-row flex-nowrap items-stretch justify-start gap-0 p-0 bg-transparent border-b border-border rounded-none overflow-x-auto">
            <TabsTrigger value="info" className={triggerClassName}>
              <Info className="h-4 w-4" />
              {t("vehicles.tabs.info")}
            </TabsTrigger>
            <TabsTrigger value="tracking" className={triggerClassName}>
              <MapPin className="h-4 w-4" />
              {t("vehicles.tabs.tracking")}
            </TabsTrigger>
            {canViewChecklist && (
              <TabsTrigger value="checklists" className={triggerClassName}>
                <ClipboardList className="h-4 w-4" />
                {t("vehicles.tabs.checklists")}
              </TabsTrigger>
            )}
            {canViewFuel && (
              <TabsTrigger value="fuel" className={triggerClassName}>
                <Fuel className="h-4 w-4" />
                {t("vehicles.tabs.fuel")}
              </TabsTrigger>
            )}
            {canViewDocuments && (
              <TabsTrigger value="documents" className={triggerClassName}>
                <FileText className="h-4 w-4" />
                {t("vehicles.tabs.documents")}
              </TabsTrigger>
            )}
            {canViewDrivers && (
              <TabsTrigger value="drivers" className={triggerClassName}>
                <Users className="h-4 w-4" />
                {t("vehicles.tabs.drivers")}
              </TabsTrigger>
            )}
            {canViewIncidents && (
              <TabsTrigger value="incidents" className={triggerClassName}>
                <AlertTriangle className="h-4 w-4" />
                {t("vehicles.tabs.incidents")}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="info" className="mt-6">
            <div className="rounded-lg border bg-card p-4 sm:p-6 text-card-foreground shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">
                  {t("vehicles.sectionGeneral")}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("vehicles.vehicleInformation")}
                </p>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("common.name")}</dt>
                    <dd className="mt-1">{vehicle.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("vehicles.plate")}</dt>
                    <dd className="mt-1 font-medium">{vehicle.plate ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("vehicles.serial")}</dt>
                    <dd className="mt-1 font-mono text-sm">{vehicle.serial ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("vehicles.color")}</dt>
                    <dd className="mt-1">{vehicle.color ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("vehicles.year")}</dt>
                    <dd className="mt-1">{vehicle.year ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      {t("vehicles.classification.speciesField")}
                    </dt>
                    <dd className="mt-1">
                      {vehicleClassificationLabel(t, "species", vehicle.vehicleSpecies)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      {t("vehicles.classification.bodyTypeField")}
                    </dt>
                    <dd className="mt-1">
                      {vehicleClassificationLabel(t, "bodyType", vehicle.vehicleBodyType)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      {t("vehicles.classification.tractionField")}
                    </dt>
                    <dd className="mt-1">
                      {vehicleClassificationLabel(t, "traction", vehicle.vehicleTraction)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      {t("vehicles.classification.useCategoryField")}
                    </dt>
                    <dd className="mt-1">
                      {vehicleClassificationLabel(
                        t,
                        "useCategory",
                        vehicle.vehicleUseCategory,
                      )}
                    </dd>
                  </div>
                  {vehicle.vehicleType ? (
                    <div>
                      <dt className="text-sm text-muted-foreground">{t("vehicles.vehicleType")}</dt>
                      <dd className="mt-1">{vehicle.vehicleType}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("vehicles.renavam")}</dt>
                    <dd className="mt-1">{vehicle.renavam ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("vehicles.chassis")}</dt>
                    <dd className="mt-1 font-mono text-sm">{vehicle.chassis ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("vehicles.initialOdometer")}</dt>
                    <dd className="mt-1">
                      {vehicle.initialOdometerKm != null &&
                      Number.isFinite(vehicle.initialOdometerKm)
                        ? new Intl.NumberFormat("pt-BR").format(vehicle.initialOdometerKm)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("vehicles.inactive")}</dt>
                    <dd className="mt-1">{vehicle.inactive ? t("common.yes") : t("common.no")}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-muted-foreground">{t("vehicles.notes")}</dt>
                    <dd className="mt-1 text-sm whitespace-pre-wrap">{vehicle.notes ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("common.created")}</dt>
                    <dd className="mt-1 text-sm">
                      {vehicle.createdAt
                        ? new Date(vehicle.createdAt).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">
                  {t("vehicles.device")}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("vehicles.deviceAssociation")}
                </p>
                {vehicle.trackerDevice ? (
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">{t("vehicles.imei")}</dt>
                      <dd className="mt-1 font-mono text-sm">{vehicle.trackerDevice.imei}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">{t("vehicles.trackerModel")}</dt>
                      <dd className="mt-1">{vehicle.trackerDevice.model}</dd>
                    </div>
                    {vehicle.trackerDevice.name && (
                      <div>
                        <dt className="text-sm text-muted-foreground">{t("common.name")}</dt>
                        <dd className="mt-1">{vehicle.trackerDevice.name}</dd>
                      </div>
                    )}
                    {vehicle.trackerDevice.equipmentModel && (
                      <div>
                        <dt className="text-sm text-muted-foreground">{t("vehicles.equipmentModel")}</dt>
                        <dd className="mt-1">{vehicle.trackerDevice.equipmentModel}</dd>
                      </div>
                    )}
                    {vehicle.trackerDevice.serialSat && (
                      <div>
                        <dt className="text-sm text-muted-foreground">{t("vehicles.serialSat")}</dt>
                        <dd className="mt-1 font-mono text-sm">{vehicle.trackerDevice.serialSat}</dd>
                      </div>
                    )}
                    {vehicle.trackerDevice.carrier && (
                      <div>
                        <dt className="text-sm text-muted-foreground">{t("vehicles.carrier")}</dt>
                        <dd className="mt-1">{vehicle.trackerDevice.carrier}</dd>
                      </div>
                    )}
                    {vehicle.trackerDevice.simCardNumber && (
                      <div>
                        <dt className="text-sm text-muted-foreground">{t("vehicles.simCardNumber")}</dt>
                        <dd className="mt-1 font-mono text-sm">{vehicle.trackerDevice.simCardNumber}</dd>
                      </div>
                    )}
                    {vehicle.trackerDevice.cellNumber && (
                      <div>
                        <dt className="text-sm text-muted-foreground">{t("vehicles.cellNumber")}</dt>
                        <dd className="mt-1">{vehicle.trackerDevice.cellNumber}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm text-muted-foreground">{t("common.status")}</dt>
                      <dd className="mt-1">
                        {vehicle.trackerDevice.connectedAt ? (
                          <Badge variant="default" className="text-green-600 bg-green-500/20">
                            {t("devices.connected")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {t("devices.disconnected")}
                          </Badge>
                        )}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-muted-foreground">{t("vehicles.noDevice")}</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tracking" className="mt-6">
            {vehicle.trackerDevice ? (
              <>
                <p className="text-muted-foreground text-sm mb-4">
                  {connected ? (
                    <span className="text-green-600">{t("devices.connected")}</span>
                  ) : (
                    <span className="text-amber-600">{t("devices.disconnected")}</span>
                  )}
                  {lastPosition && (
                    <>
                      {" · "}
                      {t("devices.lastUpdate")}:{" "}
                      {new Date(lastPosition.recordedAt).toLocaleString()}
                    </>
                  )}
                </p>
                <DeviceMapDynamic
                  key={deviceId!}
                  initialPositions={initialHistory}
                  streamedPositions={streamedAsPoints}
                  lastPosition={lastPosition}
                />
                {initialHistory.length === 0 && streamedAsPoints.length === 0 && (
                  <p className="text-muted-foreground mt-4">
                    {t("devices.noPositionYet")}
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                {t("vehicles.noDeviceTracking")}
              </div>
            )}
          </TabsContent>

          {canViewChecklist && activeTab === "checklists" && (
            <TabsContent value="checklists" className="mt-6">
              <VehicleChecklistsTab
                vehicleId={vehicleId}
                organizationId={orgId}
                customerId={selectedCustomerId}
              />
            </TabsContent>
          )}

          {canViewFuel && activeTab === "fuel" && (
            <TabsContent value="fuel" className="mt-6">
              <VehicleFuelTab
                vehicleId={vehicleId}
                organizationId={orgId}
                customerId={selectedCustomerId}
              />
            </TabsContent>
          )}

          {canViewDocuments && activeTab === "documents" && (
            <TabsContent value="documents" className="mt-6">
              <VehicleDocumentsTab
                vehicleId={vehicleId}
                organizationId={orgId}
                customerId={selectedCustomerId}
              />
            </TabsContent>
          )}

          {canViewDrivers && activeTab === "drivers" && (
            <TabsContent value="drivers" className="mt-6">
              <VehicleDriversTab
                vehicleId={vehicleId}
                organizationId={orgId}
                customerId={selectedCustomerId}
              />
            </TabsContent>
          )}

          {canViewIncidents && activeTab === "incidents" && (
            <TabsContent value="incidents" className="mt-6">
              <VehicleIncidentsTab
                vehicleId={vehicleId}
                organizationId={orgId}
                customerId={selectedCustomerId}
              />
            </TabsContent>
          )}
        </Tabs>
      )}

      {currentOrganization?.id && vehicle && canEditVehicle && (
        <VehicleFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          vehicle={vehicle}
          organizationId={currentOrganization.id}
          onSuccess={() => {
            refetchVehicle();
            setEditDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
