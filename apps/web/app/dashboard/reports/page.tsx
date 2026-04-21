"use client";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n/useTranslation";
import { Action, Module, usePermissions } from "@/lib/hooks/use-permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TrendingUp, DollarSign, BarChart3, AlertTriangle, Calendar, MapPin, Route, CheckSquare } from "lucide-react";

export default function ReportsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { can } = usePermissions();

  // Fuel Reports
  const fuelReports = [
    {
      key: "consumption",
      icon: TrendingUp,
      href: "/dashboard/fuel/reports/consumption",
      module: Module.REPORTS_FUEL_CONSUMPTION,
    },
    {
      key: "costs",
      icon: DollarSign,
      href: "/dashboard/fuel/reports/costs",
      module: Module.REPORTS_FUEL_COSTS,
    },
    {
      key: "benchmark",
      icon: BarChart3,
      href: "/dashboard/fuel/reports/benchmark",
      module: Module.REPORTS_FUEL_BENCHMARK,
    },
    {
      key: "efficiency",
      icon: AlertTriangle,
      href: "/dashboard/fuel/reports/efficiency",
      module: Module.REPORTS_FUEL_EFFICIENCY,
    },
    {
      key: "summary",
      icon: Calendar,
      href: "/dashboard/fuel/reports/summary",
      module: Module.REPORTS_FUEL_SUMMARY,
    },
  ].filter((r) => can(r.module, Action.VIEW));

  // Tracking Reports
  const trackingReports = [
    {
      key: "positions",
      icon: MapPin,
      href: "/dashboard/vehicles/reports/positions",
      module: Module.REPORTS_TRACKING,
      title: t("trackingReports.positions.title"),
      description: t("trackingReports.positions.subtitle"),
    },
    {
      key: "trips",
      icon: Route,
      href: "/dashboard/vehicles/reports/trips",
      module: Module.REPORTS_TRACKING,
      title: t("trackingReports.trips.title"),
      description: t("trackingReports.trips.description"),
    },
  ].filter((r) => can(r.module, Action.VIEW));

  // Checklist Reports
  const checklistReports = [
    {
      key: "summary",
      icon: CheckSquare,
      href: "/dashboard/checklist/reports",
      module: Module.CHECKLIST,
      title: t("checklist.reports.title"),
      description: t("checklist.reports.description"),
    },
  ].filter((r) => can(r.module, Action.VIEW));

  const hasAnyReports = fuelReports.length > 0 || trackingReports.length > 0 || checklistReports.length > 0;

  const renderReportCard = (report: any) => (
    <Card
      key={report.key}
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(report.href)}
    >
      <CardHeader className="flex flex-row items-center gap-3">
        <report.icon className="h-6 w-6 text-primary" />
        <CardTitle className="text-base">
          {report.title || t(`fuelReports.hub.${report.key}`)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {report.description || t(`fuelReports.hub.${report.key}Desc`)}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("common.reports")}</h1>
        <p className="text-muted-foreground">{t("common.reportsDescription")}</p>
      </div>

      {!hasAnyReports ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("common.noPermission")}
        </p>
      ) : (
        <Accordion type="single" collapsible defaultValue="fuel" className="w-full space-y-4">
          {/* Fuel Reports Section */}
          {fuelReports.length > 0 && (
            <AccordionItem value="fuel" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{t("fuelReports.title")}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {fuelReports.map(renderReportCard)}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Tracking Reports Section */}
          {trackingReports.length > 0 && (
            <AccordionItem value="tracking" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{t("trackingReports.title")}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {trackingReports.map(renderReportCard)}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Checklist Reports Section */}
          {checklistReports.length > 0 && (
            <AccordionItem value="checklist" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{t("checklist.title")}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {checklistReports.map(renderReportCard)}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      )}
    </div>
  );
}
