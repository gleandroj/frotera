"use client";
import Link from "next/link";
import { MapPin, Route } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { useTranslation } from "@/i18n/useTranslation";

export default function TrackingReportsHubPage() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canView = can(Module.REPORTS_TRACKING, Action.VIEW);

  const reports = [
    {
      key: "positions",
      href: "/dashboard/vehicles/reports/positions",
      icon: MapPin,
      title: t("trackingReports.positions.title"),
      description: t("trackingReports.positions.subtitle"),
    },
    {
      key: "trips",
      href: "/dashboard/vehicles/reports/trips",
      icon: Route,
      title: t("trackingReports.trips.title"),
      description: t("trackingReports.trips.description"),
    },
  ];

  if (!canView) {
    return <p className="text-muted-foreground">{t("trackingReports.noPermission")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("trackingReports.title")}</h1>
        <p className="text-muted-foreground">{t("trackingReports.description")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.key} href={r.href}>
              <Card className="h-full cursor-pointer transition-colors hover:bg-muted/50">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{r.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{r.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
