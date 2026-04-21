"use client";
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { useTranslation } from "@/i18n/useTranslation";
import { trackingReportsAPI, vehiclesAPI } from "@/lib/frontend/api-client";
import type { VehicleTrip, VehicleStop, Vehicle } from "@/lib/frontend/api-client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

export default function TripsReportPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const { can } = usePermissions();
  const canView = can(Module.REPORTS_TRACKING, Action.VIEW);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 16));
  const [trips, setTrips] = useState<VehicleTrip[]>([]);
  const [stops, setStops] = useState<VehicleStop[]>([]);
  const [tripsTotal, setTripsTotal] = useState(0);
  const [stopsTotal, setStopsTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    vehiclesAPI.list(currentOrganization.id).then((res) => {
      setVehicles(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, [currentOrganization?.id]);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const params = {
        ...(vehicleId ? { vehicleId } : {}),
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      };
      const [tripsRes, stopsRes] = await Promise.all([
        trackingReportsAPI.listTrips(currentOrganization.id, params),
        trackingReportsAPI.listStops(currentOrganization.id, params),
      ]);
      setTrips((tripsRes.data as any).items ?? []);
      setTripsTotal((tripsRes.data as any).total ?? 0);
      setStops((stopsRes.data as any).items ?? []);
      setStopsTotal((stopsRes.data as any).total ?? 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [currentOrganization?.id, vehicleId, from, to]);

  const handleDetect = useCallback(async () => {
    if (!currentOrganization?.id || !vehicleId) return;
    setDetecting(true);
    try {
      await trackingReportsAPI.detectTrips(currentOrganization.id, {
        vehicleId,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      });
      await fetchData();
    } catch { /* ignore */ }
    finally { setDetecting(false); }
  }, [currentOrganization?.id, vehicleId, from, to, fetchData]);

  if (!canView) return <p className="text-muted-foreground">{t("common.noPermission")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/dashboard/vehicles/reports"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("trackingReports.trips.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("trackingReports.trips.subtitle")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t("vehicles.vehicle")}</label>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("trackingReports.allVehicles")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t("common.all")}</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name || v.plate || v.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t("trackingReports.startDate")}</label>
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t("trackingReports.endDate")}</label>
          <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" />
        </div>
        <Button onClick={fetchData} disabled={loading} size="sm">
          {loading ? t("trackingReports.searching") : t("trackingReports.search")}
        </Button>
        {vehicleId && (
          <Button onClick={handleDetect} disabled={detecting} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${detecting ? "animate-spin" : ""}`} />
            {detecting ? t("trackingReports.processing") : t("trackingReports.trips.reprocess")}
          </Button>
        )}
      </div>

      <Tabs defaultValue="trips">
        <TabsList>
          <TabsTrigger value="trips">{t("trackingReports.trips.tabTrips", { count: tripsTotal })}</TabsTrigger>
          <TabsTrigger value="stops">{t("trackingReports.trips.tabStops", { count: stopsTotal })}</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="mt-4">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t("vehicles.vehicle")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.startDate")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.endDate")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.duration")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.distance")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.trips.maxSpeed")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.trips.avgSpeed")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.trips.origin")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.trips.destination")}</th>
                </tr>
              </thead>
              <tbody>
                {trips.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">{t("trackingReports.trips.noTripsMessage")}</td></tr>
                ) : trips.map((trip) => (
                  <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2">{trip.vehicle?.name || trip.vehicle?.plate || "—"}</td>
                    <td className="px-4 py-2 text-xs font-mono">{new Date(trip.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs font-mono">{new Date(trip.endedAt).toLocaleString()}</td>
                    <td className="px-4 py-2">{formatDuration(trip.durationSeconds)}</td>
                    <td className="px-4 py-2">{formatDistance(trip.distanceMeters)}</td>
                    <td className="px-4 py-2">{trip.maxSpeedKmh != null ? `${trip.maxSpeedKmh.toFixed(0)} km/h` : "—"}</td>
                    <td className="px-4 py-2">{trip.avgSpeedKmh != null ? `${trip.avgSpeedKmh.toFixed(0)} km/h` : "—"}</td>
                    <td className="px-4 py-2 text-xs max-w-[200px] truncate">{trip.startAddress || "—"}</td>
                    <td className="px-4 py-2 text-xs max-w-[200px] truncate">{trip.endAddress || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="stops" className="mt-4">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t("vehicles.vehicle")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.startDate")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.endDate")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.duration")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("common.address")}</th>
                </tr>
              </thead>
              <tbody>
                {stops.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("trackingReports.trips.noStopsMessage")}</td></tr>
                ) : stops.map((stop) => (
                  <tr key={stop.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2">{stop.vehicle?.name || stop.vehicle?.plate || "—"}</td>
                    <td className="px-4 py-2 text-xs font-mono">{new Date(stop.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs font-mono">{stop.endedAt ? new Date(stop.endedAt).toLocaleString() : "—"}</td>
                    <td className="px-4 py-2">{stop.durationSeconds != null ? formatDuration(stop.durationSeconds) : "—"}</td>
                    <td className="px-4 py-2 text-xs max-w-[300px] truncate">{stop.address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
