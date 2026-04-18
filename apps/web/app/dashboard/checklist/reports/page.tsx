"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import {
  checklistAPI,
  vehiclesAPI,
  type ChecklistSummaryQuery,
  type ChecklistSummaryResponse,
  type ChecklistTemplate,
  type Vehicle,
} from "@/lib/frontend/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const FILTER_ALL = "__all__";

type Preset = "default30" | "last7" | "custom";

function formatVehicleLabel(v: Vehicle): string {
  const name = (v.name ?? "").trim();
  const plate = (v.plate ?? "").trim();
  if (name && plate) return `${name} (${plate})`;
  return name || plate || v.id;
}

export default function ChecklistReportsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const intlLocale = useIntlLocale();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();

  const orgId = currentOrganization?.id;
  const canView = can(Module.CHECKLIST, Action.VIEW);

  const [preset, setPreset] = useState<Preset>("default30");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [templateFilter, setTemplateFilter] = useState(FILTER_ALL);
  const [vehicleFilter, setVehicleFilter] = useState(FILTER_ALL);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [data, setData] = useState<ChecklistSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", intlLocale)),
    [templates, intlLocale],
  );

  const sortedVehicles = useMemo(
    () => [...vehicles].sort((a, b) => formatVehicleLabel(a).localeCompare(formatVehicleLabel(b), intlLocale)),
    [vehicles, intlLocale],
  );

  const buildParams = useCallback((): ChecklistSummaryQuery => {
    const params: ChecklistSummaryQuery = {};
    if (templateFilter !== FILTER_ALL) params.templateId = templateFilter;
    if (vehicleFilter !== FILTER_ALL) params.vehicleId = vehicleFilter;

    const now = new Date();
    if (preset === "last7") {
      params.dateFrom = startOfDay(subDays(now, 7)).toISOString();
      params.dateTo = endOfDay(now).toISOString();
    } else if (preset === "custom") {
      if (customDateFrom) {
        params.dateFrom = startOfDay(parseISO(customDateFrom)).toISOString();
      }
      if (customDateTo) {
        params.dateTo = endOfDay(parseISO(customDateTo)).toISOString();
      }
    }
    return params;
  }, [preset, customDateFrom, customDateTo, templateFilter, vehicleFilter]);

  const loadFilters = useCallback(async () => {
    if (!orgId) return;
    try {
      const listParams = selectedCustomerId ? { customerId: selectedCustomerId } : undefined;
      const [vRes, tplRes] = await Promise.all([
        vehiclesAPI.list(orgId, listParams),
        checklistAPI.listTemplates(orgId),
      ]);
      setVehicles(vRes.data);
      setTemplates(tplRes.data);
    } catch {
      toast.error(t("checklist.toastError"));
    }
  }, [orgId, selectedCustomerId, t]);

  const loadSummary = useCallback(async () => {
    if (!orgId || !canView) return;
    setLoading(true);
    try {
      const params = buildParams();
      const hasCustomRange = preset === "custom";
      const onlyOptionalFilters =
        !params.dateFrom &&
        !params.dateTo &&
        (params.templateId !== undefined || params.vehicleId !== undefined);
      const customWithoutAnyBound =
        hasCustomRange && !params.dateFrom && !params.dateTo && !onlyOptionalFilters;
      const res = await checklistAPI.reportsSummary(
        orgId,
        customWithoutAnyBound ? undefined : Object.keys(params).length ? params : undefined,
      );
      setData(res.data);
    } catch {
      toast.error(t("checklist.toastError"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, canView, buildParams, t, preset]);

  useEffect(() => {
    if (!orgId || !canView) return;
    loadFilters();
  }, [orgId, canView, loadFilters]);

  useEffect(() => {
    if (!orgId || !canView) return;
    loadSummary();
  }, [orgId, canView, loadSummary]);

  const formatPercent = (rate: number) =>
    new Intl.NumberFormat(intlLocale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(rate);

  const formatPeriodLabel = (fromIso: string, toIso: string) => {
    try {
      const a = new Date(fromIso);
      const b = new Date(toIso);
      return `${format(a, "dd/MM/yyyy")} — ${format(b, "dd/MM/yyyy")}`;
    } catch {
      return "";
    }
  };

  if (!canView) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/checklist")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("checklist.reports.back")}
        </Button>
        <p className="text-muted-foreground">{t("checklist.reports.noPermission")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/checklist")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("checklist.reports.back")}
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("checklist.reports.title")}</h1>
        <p className="text-muted-foreground">{t("checklist.reports.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("checklist.reports.filtersTitle")}</CardTitle>
          <CardDescription>{t("checklist.reports.filtersHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[10rem] flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t("checklist.reports.preset")}
              </span>
              <Select
                value={preset}
                onValueChange={(v) => setPreset(v as Preset)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default30">{t("checklist.reports.preset30")}</SelectItem>
                  <SelectItem value="last7">{t("checklist.reports.preset7")}</SelectItem>
                  <SelectItem value="custom">{t("checklist.reports.presetCustom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" && (
              <>
                <div className="flex min-w-[10.5rem] flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{t("common.from")}</span>
                  <DatePicker
                    value={customDateFrom || undefined}
                    onChange={(v) => setCustomDateFrom(v ?? "")}
                    placeholder={t("common.calendar.pickDate")}
                    allowClear
                  />
                </div>
                <div className="flex min-w-[10.5rem] flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{t("common.to")}</span>
                  <DatePicker
                    value={customDateTo || undefined}
                    onChange={(v) => setCustomDateTo(v ?? "")}
                    placeholder={t("common.calendar.pickDate")}
                    allowClear
                  />
                </div>
              </>
            )}
            <div className="flex min-w-[12rem] flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">{t("checklist.template")}</span>
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("checklist.reports.allTemplates")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>{t("checklist.reports.allTemplates")}</SelectItem>
                  {sortedTemplates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-[12rem] flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">{t("checklist.vehicle")}</span>
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("checklist.reports.allVehicles")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>{t("checklist.reports.allVehicles")}</SelectItem>
                  {sortedVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {formatVehicleLabel(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="secondary" onClick={() => void loadSummary()}>
              {t("checklist.reports.apply")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-center text-muted-foreground">{t("common.loading")}</p>
      ) : !data ? (
        <p className="text-center text-muted-foreground">{t("checklist.reports.noData")}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t("checklist.reports.period")}: {formatPeriodLabel(data.period.dateFrom, data.period.dateTo)}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("checklist.reports.cardTotal")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totals.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("checklist.reports.cardCompleted")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totals.completed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("checklist.reports.cardIncomplete")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totals.incomplete}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("checklist.reports.cardCompletionRate")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercent(data.totals.completionRate)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("checklist.reports.byTemplate")}</CardTitle>
              <CardDescription>{t("checklist.reports.byTemplateHint")}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.byTemplate.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("checklist.reports.noRows")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("checklist.reports.colTemplate")}</TableHead>
                      <TableHead className="text-right">{t("checklist.reports.colTotal")}</TableHead>
                      <TableHead className="text-right">{t("checklist.entryStatus.COMPLETED")}</TableHead>
                      <TableHead className="text-right">{t("checklist.entryStatus.INCOMPLETE")}</TableHead>
                      <TableHead className="text-right">{t("checklist.entryStatus.PENDING")}</TableHead>
                      <TableHead className="text-right">{t("checklist.reports.colCompletion")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byTemplate.map((row) => (
                      <TableRow key={row.templateId}>
                        <TableCell className="font-medium">{row.templateName}</TableCell>
                        <TableCell className="text-right">{row.total}</TableCell>
                        <TableCell className="text-right">{row.completed}</TableCell>
                        <TableCell className="text-right">{row.incomplete}</TableCell>
                        <TableCell className="text-right">{row.pending}</TableCell>
                        <TableCell className="text-right">{formatPercent(row.completionRate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
