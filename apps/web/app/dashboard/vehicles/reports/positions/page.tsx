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
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Vehicle } from "@/lib/frontend/api-client";

type DateField = "recordedAt" | "receivedAt";

type Position = {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  recordedAt: string;
  receivedAt?: string | null;
  ignitionOn?: boolean | null;
  voltageLevel?: number | null;
  gsmSignal?: number | null;
  alarmCode?: number | null;
  chargeOn?: boolean | null;
  powerCut?: boolean | null;
  odometerKm?: number | null;
  city?: string | null;
  lbsMcc?: number | null;
  lbsMnc?: number | null;
  lbsLac?: number | null;
  lbsCellId?: number | null;
  device?: { vehicle?: { name?: string; plate?: string } | null } | null;
};

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function todayEnd() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString().slice(0, 16);
}

function fmt(val: unknown): string {
  if (val === null || val === undefined) return "—";
  return String(val);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function ExpandedRow({ p }: { p: Position }) {
  const hasLbs = p.lbsMcc != null || p.lbsMnc != null || p.lbsLac != null || p.lbsCellId != null;
  return (
    <tr>
      <td colSpan={7} className="bg-muted/20 px-4 py-3 border-b">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs md:grid-cols-3 lg:grid-cols-4">
          {/* Timestamps */}
          <div>
            <span className="text-muted-foreground">Hora do dispositivo</span>
            <p className="font-mono">{fmtDate(p.recordedAt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Hora de recebimento</span>
            <p className="font-mono">{fmtDate(p.receivedAt)}</p>
          </div>

          {/* Position */}
          <div>
            <span className="text-muted-foreground">Latitude / Longitude</span>
            <p className="font-mono">{p.latitude?.toFixed(6)}, {p.longitude?.toFixed(6)}</p>
          </div>
          {p.altitude != null && (
            <div>
              <span className="text-muted-foreground">Altitude</span>
              <p className="font-mono">{p.altitude.toFixed(1)} m</p>
            </div>
          )}
          {p.heading != null && (
            <div>
              <span className="text-muted-foreground">Direção</span>
              <p className="font-mono">{p.heading}°</p>
            </div>
          )}

          {/* Address */}
          {p.city && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Endereço computado</span>
              <p>{p.city}</p>
            </div>
          )}

          {/* Electrical */}
          {p.voltageLevel != null && (
            <div>
              <span className="text-muted-foreground">Tensão</span>
              <p className="font-mono">{(p.voltageLevel / 10).toFixed(1)} V</p>
            </div>
          )}
          {p.chargeOn != null && (
            <div>
              <span className="text-muted-foreground">Carregando</span>
              <p>{p.chargeOn ? "Sim" : "Não"}</p>
            </div>
          )}
          {p.powerCut != null && (
            <div>
              <span className="text-muted-foreground">Corte de energia</span>
              <p className={p.powerCut ? "text-red-600 font-medium" : ""}>{p.powerCut ? "Sim" : "Não"}</p>
            </div>
          )}

          {/* GSM / Signal */}
          {p.gsmSignal != null && (
            <div>
              <span className="text-muted-foreground">Sinal GSM</span>
              <p className="font-mono">{p.gsmSignal}</p>
            </div>
          )}

          {/* Odometer */}
          {p.odometerKm != null && (
            <div>
              <span className="text-muted-foreground">Hodômetro</span>
              <p className="font-mono">{p.odometerKm.toFixed(1)} km</p>
            </div>
          )}

          {/* Alarm */}
          {p.alarmCode != null && (
            <div>
              <span className="text-muted-foreground">Código de alarme</span>
              <p className="font-mono">{fmt(p.alarmCode)}</p>
            </div>
          )}

          {/* LBS */}
          {hasLbs && (
            <div>
              <span className="text-muted-foreground">LBS (MCC/MNC/LAC/Cell)</span>
              <p className="font-mono">
                {fmt(p.lbsMcc)}/{fmt(p.lbsMnc)}/{fmt(p.lbsLac)}/{fmt(p.lbsCellId)}
              </p>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

const LIMIT = 500;

export default function PositionsReportPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const { can } = usePermissions();
  const canView = can(Module.REPORTS_TRACKING, Action.VIEW);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [from, setFrom] = useState(todayStart);
  const [to, setTo] = useState(todayEnd);
  const [dateField, setDateField] = useState<DateField>("receivedAt");
  const [data, setData] = useState<{ items: Position[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentOrganization?.id) return;
    vehiclesAPI.list(currentOrganization.id).then((res) => {
      setVehicles(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, [currentOrganization?.id]);

  const fetchData = useCallback(async (newOffset = 0) => {
    if (!currentOrganization?.id || !vehicleId) return;
    setLoading(true);
    setExpandedIds(new Set());
    try {
      const res = await trackingReportsAPI.listPositions(currentOrganization.id, {
        vehicleId,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        limit: LIMIT,
        offset: newOffset,
        dateField,
      });
      setData(res.data as any);
      setOffset(newOffset);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, vehicleId, from, to, dateField]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!canView) return <p className="text-muted-foreground">{t("common.noPermission")}</p>;

  const dateFieldLabel = dateField === "receivedAt" ? "hora recebida" : "hora do dispositivo";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("trackingReports.positions.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("trackingReports.positions.subtitle")}</p>
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
          <label className="text-xs text-muted-foreground">Filtrar por</label>
          <Select value={dateField} onValueChange={(v) => setDateField(v as DateField)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="receivedAt">Hora recebida</SelectItem>
              <SelectItem value="recordedAt">Hora do dispositivo</SelectItem>
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
            <span className="text-sm font-medium">
              {t("trackingReports.recordsFound", { count: data.total })}
              {" "}
              <span className="text-muted-foreground font-normal text-xs">— ordenado por {dateFieldLabel}</span>
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => fetchData(offset - LIMIT)}>
                {t("common.previous")}
              </Button>
              <Button variant="outline" size="sm" disabled={offset + LIMIT >= data.total} onClick={() => fetchData(offset + LIMIT)}>
                {t("common.next")}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-8 px-2 py-2" />
                  <th className="px-4 py-2 text-left font-medium">
                    {dateField === "receivedAt" ? "Hora recebida" : "Hora do dispositivo"}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.speed")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("trackingReports.ignition")}</th>
                  <th className="px-4 py-2 text-left font-medium">Endereço</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p, i) => {
                  const rowId = p.id ?? String(i);
                  const isOpen = expandedIds.has(rowId);
                  const primaryDate = dateField === "receivedAt" ? p.receivedAt : p.recordedAt;
                  return (
                    <>
                      <tr
                        key={rowId}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => toggleExpand(rowId)}
                      >
                        <td className="px-2 py-2 text-muted-foreground">
                          {isOpen
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">
                          {fmtDate(primaryDate)}
                        </td>
                        <td className="px-4 py-2">
                          {p.speed != null ? `${p.speed.toFixed(1)} km/h` : "—"}
                        </td>
                        <td className="px-4 py-2">
                          {p.ignitionOn === true ? (
                            <Badge variant="outline" className="text-green-600 border-green-500">
                              {t("trackingReports.ignitionOn")}
                            </Badge>
                          ) : p.ignitionOn === false ? (
                            <Badge variant="secondary">{t("trackingReports.ignitionOff")}</Badge>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground max-w-[220px] truncate">
                          {p.city || "—"}
                        </td>
                      </tr>
                      {isOpen && <ExpandedRow key={`${rowId}-exp`} p={p} />}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
