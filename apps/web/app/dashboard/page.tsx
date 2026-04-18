"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { CreateOrganizationDialog } from "@/components/organizations";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { getDashboardStats } from "@/lib/api/dashboard";
import { checklistAPI, type ChecklistSummaryResponse } from "@/lib/frontend/api-client";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Users, ClipboardList, BarChart2 } from "lucide-react";

export default function DashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const intlLocale = useIntlLocale();
  const { user, organizations, currentOrganization } = useAuth();
  const { can } = usePermissions();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [teamMembers, setTeamMembers] = useState<number | null>(null);
  const [checklistSummary, setChecklistSummary] = useState<ChecklistSummaryResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const orgId = currentOrganization?.id;
  const canChecklistView = can(Module.CHECKLIST, Action.VIEW);

  useEffect(() => {
    if (user?.isSuperAdmin && organizations && organizations.length === 0) {
      setShowCreateDialog(true);
    }
  }, [user?.isSuperAdmin, organizations]);

  const loadStats = useCallback(async () => {
    if (!orgId) return;
    setLoadingStats(true);
    try {
      const dashRes = await getDashboardStats(orgId);
      setTeamMembers(dashRes.data.teamMembers);
      if (canChecklistView) {
        const checklistRes = await checklistAPI.reportsSummary(orgId, undefined);
        setChecklistSummary(checklistRes.data);
      } else {
        setChecklistSummary(null);
      }
    } catch {
      toast.error(t("dashboard.home.statsError"));
      setTeamMembers(null);
      setChecklistSummary(null);
    } finally {
      setLoadingStats(false);
    }
  }, [orgId, canChecklistView, t]);

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
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-medium">{t("dashboard.home.teamMembers")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamMembers ?? "—"}</div>
            </CardContent>
          </Card>

          {canChecklistView && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <div className="flex flex-1 flex-col gap-0.5">
                  <CardTitle className="text-base font-medium">{t("dashboard.home.checklistSection")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("dashboard.home.checklistPeriodHint")}
                    {periodLabel ? ` · ${periodLabel}` : ""}
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
        </div>
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
