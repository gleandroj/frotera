"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { Action, Module, usePermissions } from "@/lib/hooks/use-permissions";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import {
  buildTelemetryAlertsSocket,
  telemetryAPI,
  vehiclesAPI,
  type TelemetryAlert,
  type Vehicle,
} from "@/lib/frontend/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useTranslation } from "@/i18n/useTranslation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ALERT_TYPES = [
  "SPEEDING",
  "HARSH_BRAKING",
  "RAPID_ACCELERATION",
  "GEOFENCE_ENTER",
  "GEOFENCE_EXIT",
  "DEVICE_OFFLINE",
  "LOW_BATTERY",
  "IGNITION_ON",
  "IGNITION_OFF",
] as const;

function severityVariant(
  s: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (s === "CRITICAL") return "destructive";
  if (s === "WARNING") return "secondary";
  return "outline";
}

export default function TelemetryPage() {
  const { t } = useTranslation();
  const intlLocale = useIntlLocale();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const canEdit = can(Module.TELEMETRY, Action.EDIT);
  const orgId = currentOrganization?.id;

  const [tab, setTab] = useState<"new" | "ack">("new");
  const [alerts, setAlerts] = useState<TelemetryAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("__all__");
  const [filterVehicleId, setFilterVehicleId] = useState("__all__");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const acknowledgedParam = useMemo(() => {
    if (tab === "new") return false;
    if (tab === "ack") return true;
    return undefined;
  }, [tab]);

  const loadAlerts = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await telemetryAPI.listAlerts(orgId, {
        acknowledged: acknowledgedParam,
        ...(filterType && filterType !== "__all__" ? { type: filterType } : {}),
        ...(filterVehicleId && filterVehicleId !== "__all__"
          ? { vehicleId: filterVehicleId }
          : {}),
        ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
        ...(dateFrom ? { dateFrom: `${dateFrom}T00:00:00.000Z` } : {}),
        ...(dateTo ? { dateTo: `${dateTo}T23:59:59.999Z` } : {}),
        limit,
        offset,
      });
      setAlerts(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch (e) {
      setError(getApiErrorMessage(e, t, "common.error"));
    } finally {
      setLoading(false);
    }
  }, [
    orgId,
    acknowledgedParam,
    filterType,
    filterVehicleId,
    dateFrom,
    dateTo,
    limit,
    offset,
    selectedCustomerId,
    t,
  ]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    setOffset(0);
  }, [tab, filterType, filterVehicleId, dateFrom, dateTo]);

  useEffect(() => {
    if (!orgId) return;
    vehiclesAPI
      .list(orgId, { customerId: selectedCustomerId ?? undefined })
      .then((res) => setVehicles(Array.isArray(res.data) ? res.data : []))
      .catch(() => setVehicles([]));
  }, [orgId, selectedCustomerId]);

  useEffect(() => {
    if (!orgId) return;
    const socket = buildTelemetryAlertsSocket(orgId);
    socket.connect();
    const onAlert = (payload: TelemetryAlert) => {
      setAlerts((prev) => {
        if (tab !== "new") return prev;
        if (payload.acknowledgedAt) return prev;
        const exists = prev.some((a) => a.id === payload.id);
        if (exists) return prev;
        return [payload, ...prev];
      });
    };
    socket.on("telemetry:alert", onAlert);
    return () => {
      socket.off("telemetry:alert", onAlert);
      socket.disconnect();
    };
  }, [orgId, tab]);

  const acknowledge = async (alert: TelemetryAlert) => {
    if (!orgId) return;
    try {
      await telemetryAPI.acknowledgeAlert(orgId, alert.id);
      toast.success(t("telemetry.alerts.acknowledgeSuccess"));
      void loadAlerts();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t, "telemetry.alerts.acknowledgeError"));
    }
  };

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));

  if (!orgId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("vehicles.selectOrganization")}
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("telemetry.title")}
        </h1>
        <p className="text-muted-foreground">{t("telemetry.description")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t("telemetry.alerts.filters.cardTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium leading-none text-muted-foreground">
              {t("telemetry.alerts.filters.type")}
            </span>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={t("telemetry.alerts.filters.allTypes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  {t("telemetry.alerts.filters.allTypes")}
                </SelectItem>
                {ALERT_TYPES.map((x) => (
                  <SelectItem key={x} value={x}>
                    {t(`telemetry.alertTypes.${x}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium leading-none text-muted-foreground">
              {t("telemetry.alerts.filters.vehicle")}
            </span>
            <Select value={filterVehicleId} onValueChange={setFilterVehicleId}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={t("telemetry.alerts.filters.allVehicles")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  {t("telemetry.alerts.filters.allVehicles")}
                </SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plate || v.name || v.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium leading-none text-muted-foreground">
              {t("telemetry.alerts.filters.dateFrom")}
            </span>
            <DatePicker
              value={dateFrom}
              onChange={setDateFrom}
              className="w-full min-w-0"
              placeholder={t("common.calendar.pickDate")}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium leading-none text-muted-foreground">
              {t("telemetry.alerts.filters.dateTo")}
            </span>
            <DatePicker
              value={dateTo}
              onChange={setDateTo}
              className="w-full min-w-0"
              placeholder={t("common.calendar.pickDate")}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "new" | "ack")}>
        <TabsList>
          <TabsTrigger value="new">{t("telemetry.tabs.new")}</TabsTrigger>
          <TabsTrigger value="ack">{t("telemetry.tabs.acknowledged")}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("telemetry.alerts.columns.severity")}</TableHead>
                  <TableHead>{t("telemetry.alerts.columns.type")}</TableHead>
                  <TableHead>{t("telemetry.alerts.columns.vehicle")}</TableHead>
                  <TableHead>{t("telemetry.alerts.columns.message")}</TableHead>
                  <TableHead>{t("telemetry.alerts.columns.createdAt")}</TableHead>
                  <TableHead className="text-right">
                    {t("telemetry.alerts.columns.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      …
                    </TableCell>
                  </TableRow>
                ) : alerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t("telemetry.alerts.noAlerts")}
                    </TableCell>
                  </TableRow>
                ) : (
                  alerts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Badge variant={severityVariant(a.severity)}>
                          {t(`telemetry.alertSeverity.${a.severity}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{t(`telemetry.alertTypes.${a.type}`)}</TableCell>
                      <TableCell>
                        {a.vehicle?.plate || a.vehicle?.name || "—"}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate">{a.message}</TableCell>
                      <TableCell>{fmtDate(a.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {tab === "new" && canEdit && (
                          <Button size="sm" variant="secondary" onClick={() => acknowledge(a)}>
                            {t("telemetry.alerts.acknowledge")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
              >
                Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                {offset / limit + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= total}
                onClick={() => setOffset((o) => o + limit)}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
