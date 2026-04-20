"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { CreateOrganizationDialog } from "@/components/organizations";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { getDashboardStats, type DashboardStats } from "@/lib/api/dashboard";
import { checklistAPI, type ChecklistSummaryResponse } from "@/lib/frontend/api-client";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Users,
  ClipboardList,
  BarChart2,
  Car,
  UserRound,
  Radio,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

function StatTile({
  title,
  description,
  value,
  icon,
  href,
  canNavigate,
  emphasize,
}: {
  title: string;
  description?: string;
  value: number;
  icon: React.ReactNode;
  href: string;
  canNavigate: boolean;
  emphasize?: boolean;
}) {
  const inner = (
    <Card
      className={cn(
        "h-full transition-colors",
        canNavigate && "cursor-pointer hover:bg-muted/40",
        emphasize && value > 0 && "border-amber-500/40 bg-amber-500/[0.06]",
      )}
    >
      <CardHeader className="flex flex-row items-start gap-2 space-y-0 pb-2">
        <span className="mt-0.5 shrink-0 text-muted-foreground [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <CardTitle className="text-balance text-sm font-medium leading-snug sm:text-base">
            {title}
          </CardTitle>
          {description ? <CardDescription className="text-xs leading-snug">{description}</CardDescription> : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );

  if (canNavigate) {
    return (
      <Link href={href} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {inner}
      </Link>
    );
  }

  return inner;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const intlLocale = useIntlLocale();
  const { user, organizations, currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const canViewDashboard = can(Module.DASHBOARD, Action.VIEW);

  useEffect(() => {
    if (currentOrganization && !canViewDashboard) {
      router.replace("/dashboard/tracking");
    }
  }, [currentOrganization, canViewDashboard, router]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [checklistSummary, setChecklistSummary] = useState<ChecklistSummaryResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const orgId = currentOrganization?.id;
  const canChecklistView = can(Module.CHECKLIST, Action.VIEW);
  const canUsersView = can(Module.USERS, Action.VIEW);
  const canVehiclesView = can(Module.VEHICLES, Action.VIEW);
  const canDriversView = can(Module.DRIVERS, Action.VIEW);
  const canTrackingView = can(Module.TRACKING, Action.VIEW);
  const canCompaniesView = can(Module.COMPANIES, Action.VIEW);
  const canIncidentsView = can(Module.INCIDENTS, Action.VIEW);

  useEffect(() => {
    if (user?.isSuperAdmin && organizations && organizations.length === 0) {
      setShowCreateDialog(true);
    }
  }, [user?.isSuperAdmin, organizations]);

  const loadStats = useCallback(async () => {
    if (!orgId) return;
    setLoadingStats(true);
    try {
      const dashRes = await getDashboardStats(
        orgId,
        selectedCustomerId ? { customerId: selectedCustomerId } : undefined,
      );
      setStats(dashRes.data);
      if (canChecklistView) {
        const checklistRes = await checklistAPI.reportsSummary(orgId, {
          ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
        });
        setChecklistSummary(checklistRes.data);
      } else {
        setChecklistSummary(null);
      }
    } catch {
      toast.error(t("dashboard.home.statsError"));
      setStats(null);
      setChecklistSummary(null);
    } finally {
      setLoadingStats(false);
    }
  }, [orgId, canChecklistView, selectedCustomerId, t]);

  useEffect(() => {
    if (!orgId) return;
    void loadStats();
  }, [orgId, loadStats]);

  const formatPercent = (rate: number) =>
    new Intl.NumberFormat(intlLocale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(rate);

  const periodLabel =
    checklistSummary &&
    `${format(new Date(checklistSummary.period.dateFrom), "dd/MM/yyyy")} — ${format(
      new Date(checklistSummary.period.dateTo),
      "dd/MM/yyyy",
    )}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.home.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.home.subtitle")}</p>
      </div>

      {!orgId ? (
        <p className="text-muted-foreground">{t("common.selectOrganization")}</p>
      ) : loadingStats ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <>
          {stats ? (
            <div className="space-y-3">
              <p className="max-w-3xl text-sm text-muted-foreground text-pretty">
                {t("dashboard.home.quickStatsHint")}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                <StatTile
                  title={t("dashboard.home.teamMembers")}
                  value={stats.teamMembers}
                  icon={<Users />}
                  href="/team"
                  canNavigate={canUsersView}
                />
                {canVehiclesView ? (
                  <StatTile
                    title={t("dashboard.home.activeVehicles")}
                    value={stats.vehiclesActive}
                    icon={<Car />}
                    href="/dashboard/vehicles"
                    canNavigate
                  />
                ) : null}
                {canDriversView ? (
                  <StatTile
                    title={t("dashboard.home.activeDrivers")}
                    value={stats.driversActive}
                    icon={<UserRound />}
                    href="/dashboard/drivers"
                    canNavigate
                  />
                ) : null}
                {canTrackingView ? (
                  <StatTile
                    title={t("dashboard.home.trackers")}
                    value={stats.trackers}
                    icon={<Radio />}
                    href="/dashboard/devices"
                    canNavigate
                  />
                ) : null}
                {canCompaniesView ? (
                  <StatTile
                    title={t("dashboard.home.customers")}
                    value={stats.customers}
                    icon={<Building2 />}
                    href="/dashboard/customers"
                    canNavigate
                  />
                ) : null}
                {canIncidentsView ? (
                  <StatTile
                    title={t("dashboard.home.openIncidents")}
                    description={t("dashboard.home.openIncidentsHint")}
                    value={stats.openIncidents}
                    icon={<AlertTriangle />}
                    href="/dashboard/incidents"
                    canNavigate
                    emphasize
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {canChecklistView && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <div className="flex flex-1 flex-col gap-0.5">
                  <CardTitle className="text-base font-medium">{t("dashboard.home.checklistSection")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("dashboard.home.checklistPeriodHint")}
                    {periodLabel ? `${periodLabel}` : ""}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {checklistSummary ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
                      <div>
                        <p className="text-muted-foreground">{t("dashboard.home.checklistTotal")}</p>
                        <p className="text-lg font-semibold">{checklistSummary.totals.total}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("dashboard.home.checklistCompleted")}</p>
                        <p className="text-lg font-semibold">{checklistSummary.totals.completed}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("dashboard.home.checklistIncomplete")}</p>
                        <p className="text-lg font-semibold">{checklistSummary.totals.incomplete}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("dashboard.home.checklistPending")}</p>
                        <p className="text-lg font-semibold">{checklistSummary.totals.pending}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("dashboard.home.checklistCompletion")}</p>
                        <p className="text-lg font-semibold">
                          {formatPercent(checklistSummary.totals.completionRate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="default" size="sm" className="gap-2" onClick={() => router.push("/dashboard/checklist/reports")}>
                        <BarChart2 className="h-4 w-4" />
                        {t("dashboard.home.openChecklistReport")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/checklist")}>
                        {t("dashboard.home.openChecklists")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("checklist.reports.noData")}</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <CreateOrganizationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          setShowCreateDialog(false);
        }}
      />
    </div>
  );
}
