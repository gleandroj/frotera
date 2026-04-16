"use client";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, BarChart3, AlertTriangle, Calendar } from "lucide-react";

export default function FuelReportsPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const reports = [
    {
      key: "consumption",
      icon: TrendingUp,
      href: "/dashboard/fuel/reports/consumption",
    },
    {
      key: "costs",
      icon: DollarSign,
      href: "/dashboard/fuel/reports/costs",
    },
    {
      key: "benchmark",
      icon: BarChart3,
      href: "/dashboard/fuel/reports/benchmark",
    },
    {
      key: "efficiency",
      icon: AlertTriangle,
      href: "/dashboard/fuel/reports/efficiency",
    },
    {
      key: "summary",
      icon: Calendar,
      href: "/dashboard/fuel/reports/summary",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("fuelReports.title")}</h1>
        <p className="text-muted-foreground">{t("fuelReports.description")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map(({ key, icon: Icon, href }) => (
          <Card
            key={key}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(href)}
          >
            <CardHeader className="flex flex-row items-center gap-3">
              <Icon className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">{t(`fuelReports.hub.${key}`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t(`fuelReports.hub.${key}Desc`)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
