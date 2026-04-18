"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { Action, Module, usePermissions } from "@/lib/hooks/use-permissions";
import {
  incidentsAPI,
  type Incident,
  type IncidentStats,
} from "@/lib/frontend/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { formatLocaleCurrency } from "@/lib/locale-decimal";
import { useTranslation } from "@/i18n/useTranslation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getIncidentColumns } from "./columns";
import { DeleteIncidentDialog } from "./delete-incident-dialog";
import { IncidentFormSheet } from "./incident-form-sheet";

const INCIDENT_TYPES = [
  "ACCIDENT",
  "THEFT",
  "FINE",
  "BREAKDOWN",
  "VANDALISM",
  "OTHER",
] as const;

const INCIDENT_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export default function IncidentsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const intlLocale = useIntlLocale();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const canCreate = can(Module.INCIDENTS, Action.CREATE);
  const canDelete = can(Module.INCIDENTS, Action.DELETE);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteIncident, setDeleteIncident] = useState<Incident | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const currency = currentOrganization?.currency ?? "BRL";

  const loadData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 20,
        ...(filterType ? { type: filterType } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterSeverity ? { severity: filterSeverity } : {}),
        ...(dateFrom ? { dateFrom: `${dateFrom}T00:00:00.000Z` } : {}),
        ...(dateTo ? { dateTo: `${dateTo}T23:59:59.999Z` } : {}),
      };
      const [listRes, statsRes] = await Promise.all([
        incidentsAPI.list(currentOrganization.id, params),
        incidentsAPI.stats(currentOrganization.id, {
          ...(dateFrom ? { dateFrom: `${dateFrom}T00:00:00.000Z` } : {}),
          ...(dateTo ? { dateTo: `${dateTo}T23:59:59.999Z` } : {}),
        }),
      ]);
      setIncidents(listRes.data.incidents);
      setTotalPages(listRes.data.totalPages || 1);
      setStats(statsRes.data);
    } catch (err) {
      setError(getApiErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }, [
    currentOrganization?.id,
    page,
    filterType,
    filterStatus,
    filterSeverity,
    dateFrom,
    dateTo,
    t,
  ]);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [currentOrganization?.id, loadData]);

  const formatCost = useMemo(
    () => (value: number | null) => {
      if (value == null || Number.isNaN(value)) return "—";
      return formatLocaleCurrency(value, intlLocale, currency);
    },
    [intlLocale, currency],
  );

  const formatDate = useMemo(
    () => (iso: string) =>
      new Date(iso).toLocaleDateString(intlLocale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [intlLocale],
  );

  const columns = useMemo(
    () =>
      getIncidentColumns(t, {
        onDelete: setDeleteIncident,
        canDelete,
        formatCost,
        formatDate,
      }),
    [t, canDelete, formatCost, formatDate],
  );

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">{t("incidents.title")}</h1>
        <p className="text-muted-foreground">{t("incidents.selectOrganization")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("incidents.title")}</h1>
          <p className="text-muted-foreground">{t("incidents.listDescription")}</p>
        </div>
        {canCreate ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("incidents.newIncident")}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("incidents.stats.openIncidents")}
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.openCount ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t("incidents.stats.totalCost")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats != null
                ? formatLocaleCurrency(stats.totalCost, intlLocale, currency)
                : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t("incidents.stats.byType")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {(stats?.byType ?? []).slice(0, 5).map((row) => (
                <li key={row.type} className="flex justify-between gap-2">
                  <span>{t(`incidents.type.${row.type}`)}</span>
                  <span className="font-medium text-foreground">{row.count}</span>
                </li>
              ))}
              {!stats?.byType?.length ? <li>—</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:flex-wrap md:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">{t("incidents.filterByType")}</span>
            <Select
              value={filterType || "all"}
              onValueChange={(v) => {
                setFilterType(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("incidents.filterByType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {INCIDENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`incidents.type.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">{t("incidents.filterByStatus")}</span>
            <Select
              value={filterStatus || "all"}
              onValueChange={(v) => {
                setFilterStatus(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("incidents.filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {INCIDENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`incidents.status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">{t("incidents.filterBySeverity")}</span>
            <Select
              value={filterSeverity || "all"}
              onValueChange={(v) => {
                setFilterSeverity(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("incidents.filterBySeverity")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {INCIDENT_SEVERITIES.map((sev) => (
                  <SelectItem key={sev} value={sev}>
                    {t(`incidents.severity.${sev}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">{t("incidents.dateFrom")}</span>
              <DatePicker
                value={dateFrom}
                onChange={(v) => {
                  setDateFrom(v);
                  setPage(1);
                }}
                placeholder={t("common.calendar.pickDate")}
                allowClear
              />
            </div>
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">{t("incidents.dateTo")}</span>
              <DatePicker
                value={dateTo}
                onChange={(v) => {
                  setDateTo(v);
                  setPage(1);
                }}
                placeholder={t("common.calendar.pickDate")}
                allowClear
              />
            </div>
          </div>
        </div>
      </div>

      {loading && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && incidents.length === 0 && (
        <p className="text-muted-foreground">{t("incidents.noIncidents")}</p>
      )}
      {!loading && !error && incidents.length > 0 && (
        <>
          <DataTable<Incident, unknown>
            columns={columns}
            data={incidents}
            filterPlaceholder={t("incidents.columns.title")}
            filterColumnId="title"
            noResultsLabel={t("dataTable.noResults")}
            initialSorting={[{ id: "date", desc: true }]}
          />
          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("common.previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} {t("common.of")} {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t("common.next")}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <DeleteIncidentDialog
        open={!!deleteIncident}
        onOpenChange={(open) => !open && setDeleteIncident(null)}
        incident={deleteIncident}
        organizationId={currentOrganization.id}
        onSuccess={loadData}
      />

      <IncidentFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={currentOrganization.id}
        selectedCustomerId={selectedCustomerId}
        onSuccess={(created) => {
          router.push(`/dashboard/incidents/${created.id}`);
        }}
      />
    </div>
  );
}
