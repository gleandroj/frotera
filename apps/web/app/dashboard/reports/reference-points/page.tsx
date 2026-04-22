"use client";
import { useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { trackingReportsAPI, type ReferencePointProximityRow } from "@/lib/frontend/api-client";
import { CustomerMultiSelect } from "@/components/ui/customer-multi-select";
import { VehicleMultiSelect } from "@/components/ui/vehicle-multi-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { formatLocaleDecimal } from "@/lib/locale-decimal";
import { format, subDays } from "date-fns";
import { ReferencePointMultiSelect } from "./reference-point-multi-select";

const PAGE_SIZE = 100;

export default function ReferencePointsReportPage() {
  const { t } = useTranslation();
  const intlLocale = useIntlLocale();
  const { currentOrganization } = useAuth();

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedRpIds, setSelectedRpIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 1), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [maxDistance, setMaxDistance] = useState("");
  const [data, setData] = useState<ReferencePointProximityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchPage = async (skip: number) => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await trackingReportsAPI.referencePointsProximity(currentOrganization.id, {
        vehicleIds: selectedVehicleIds.length > 0 ? selectedVehicleIds : undefined,
        customerIds: selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined,
        referencePointIds: selectedRpIds.length > 0 ? selectedRpIds : undefined,
        dateFrom,
        dateTo,
        maxDistanceMeters: maxDistance ? Number(maxDistance) : undefined,
        skip,
        take: PAGE_SIZE,
      });
      setData(res.data.data);
      setTotal(res.data.total);
      setPage(skip);
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  if (!currentOrganization) return null;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(page / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("reports.referencePoints.title")}</h1>
        <p className="text-muted-foreground">{t("reports.referencePoints.description")}</p>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">{t("common.from")}</label>
            <DatePicker className="mt-1" value={dateFrom} onChange={(v) => setDateFrom(v)} placeholder={t("common.calendar.pickDate")} />
          </div>
          <div>
            <label className="text-sm font-medium">{t("common.to")}</label>
            <DatePicker className="mt-1" value={dateTo} onChange={(v) => setDateTo(v)} placeholder={t("common.calendar.pickDate")} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">{t("fuelReports.filters.companies")}</label>
            <div className="mt-1">
              <CustomerMultiSelect organizationId={currentOrganization.id} value={selectedCustomerIds} onChange={(ids) => { setSelectedCustomerIds(ids); setSelectedVehicleIds([]); }} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t("fuelReports.filters.vehicles")}</label>
            <div className="mt-1">
              <VehicleMultiSelect organizationId={currentOrganization.id} customerIds={selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined} value={selectedVehicleIds} onChange={setSelectedVehicleIds} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">{t("reports.referencePoints.filters.referencePoints")}</label>
            <div className="mt-1">
              <ReferencePointMultiSelect organizationId={currentOrganization.id} value={selectedRpIds} onChange={setSelectedRpIds} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t("reports.referencePoints.filters.maxDistance")}</label>
            <Input className="mt-1" type="number" min={0} placeholder={t("reports.referencePoints.filters.maxDistancePlaceholder")} value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => fetchPage(0)} disabled={loading}>
            {loading ? t("common.loading") : t("reports.referencePoints.filters.search")}
          </Button>
        </div>
      </div>

      {data.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {total} {t("common.found")}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 text-left">{t("reports.referencePoints.table.dateTime")}</th>
                  <th className="py-2 text-left">{t("reports.referencePoints.table.vehicle")}</th>
                  <th className="py-2 text-left">{t("reports.referencePoints.table.plate")}</th>
                  <th className="py-2 text-left">{t("reports.referencePoints.table.latLng")}</th>
                  <th className="py-2 text-left">{t("reports.referencePoints.table.closestPoint")}</th>
                  <th className="py-2 text-right">{t("reports.referencePoints.table.distance")}</th>
                  <th className="py-2 text-right">{t("reports.referencePoints.table.speed")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.positionId} className="border-b hover:bg-muted/50">
                    <td className="py-2 text-xs">{new Date(row.recordedAt).toLocaleString()}</td>
                    <td className="py-2">{row.vehicleName ?? "—"}</td>
                    <td className="py-2">{row.vehiclePlate ?? "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {formatLocaleDecimal(row.latitude, intlLocale, { minFractionDigits: 5, maxFractionDigits: 5 })},
                      {formatLocaleDecimal(row.longitude, intlLocale, { minFractionDigits: 5, maxFractionDigits: 5 })}
                    </td>
                    <td className="py-2">{row.closestReferencePointName}</td>
                    <td className="py-2 text-right">
                      {formatLocaleDecimal(row.closestDistanceMeters, intlLocale, { minFractionDigits: 0, maxFractionDigits: 0 })} m
                    </td>
                    <td className="py-2 text-right">
                      {row.speed != null ? `${formatLocaleDecimal(row.speed, intlLocale, { minFractionDigits: 0, maxFractionDigits: 0 })} km/h` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => fetchPage((currentPage - 1) * PAGE_SIZE)}>
                {t("common.previous")}
              </Button>
              <span className="text-sm text-muted-foreground">{currentPage + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => fetchPage((currentPage + 1) * PAGE_SIZE)}>
                {t("common.next")}
              </Button>
            </div>
          )}
        </>
      )}
      {!loading && hasSearched && data.length === 0 && (
        <div className="text-center text-muted-foreground py-8">{t("reports.referencePoints.noData")}</div>
      )}
    </div>
  );
}
