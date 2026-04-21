"use client";
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { useTranslation } from "@/i18n/useTranslation";
import { trackingReportsAPI, vehiclesAPI } from "@/lib/frontend/api-client";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Vehicle } from "@/lib/frontend/api-client";

export default function PositionsReportPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const { can } = usePermissions();
  const canView = can(Module.REPORTS_TRACKING, Action.VIEW);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 16));
  const [data, setData] = useState<{ items: any[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 500;

  useEffect(() => {
    if (!currentOrganization?.id) return;
    vehiclesAPI.list(currentOrganization.id).then((res) => {
      setVehicles(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, [currentOrganization?.id]);

  const fetchData = useCallback(async (newOffset = 0) => {
    if (!currentOrganization?.id || !vehicleId) return;
    setLoading(true);
    try {
      const res = await trackingReportsAPI.listPositions(currentOrganization.id, {
        vehicleId,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        limit: LIMIT,
        offset: newOffset,
      });
      setData(res.data as any);
      setOffset(newOffset);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [currentOrganization?.id, vehicleId, from, to]);

  if (!canView) return <p className="text-muted-foreground">{t("common.noPermission")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/dashboard/reports"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("trackingReports.positions.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("trackingReports.positions.subtitle")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t("vehicles.vehicle")}</label>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("trackingReports.selectVehicle")} />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name || v.plate || v.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t("trackingReports.startDate")}</label>
          <DateTimePicker value={from} onChange={setFrom} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t("trackingReports.endDate")}</label>
          <DateTimePicker value={to} onChange={setTo} />
        </div>
        <Button onClick={() => fetchData(0)} disabled={loading || !vehicleId} size="sm">
          {loading ? t("trackingReports.searching") : t("trackingReports.search")}
        </Button>
      </div>

      {/* Table */}
      {data && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-medium">{t("trackingReports.recordsFound", { count: data.total })}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => fetchData(offset - LIMIT)}>{t("common.previous")}</Button>
              <Button variant="outline" size="sm" disabled={offset + LIMIT >= data.total} onClick={() => fetchData(offset + LIMIT)}>{t("common.next")}</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.dateTime")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.positions.latitude")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.positions.longitude")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.speed")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.heading")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.ignition")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p: any, i: number) => (
                  <tr key={p.id ?? i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{new Date(p.recordedAt).toLocaleString()}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.latitude?.toFixed(6)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.longitude?.toFixed(6)}</td>
                    <td className="px-4 py-2">{p.speed != null ? `${p.speed.toFixed(1)} km/h` : "—"}</td>
                    <td className="px-4 py-2">{p.heading != null ? `${p.heading}°` : "—"}</td>
                    <td className="px-4 py-2">
                      {p.ignitionOn === true ? (
                        <Badge variant="outline" className="text-green-600 border-green-500">{t("trackingReports.ignitionOn")}</Badge>
                      ) : p.ignitionOn === false ? (
                        <Badge variant="secondary">{t("trackingReports.ignitionOff")}</Badge>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
