"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { getPlanLimitsOverview, type PlanLimitsOverview as PlanLimitsData } from "@/lib/api/dashboard";
import "./plan-limits-styles.css";
import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Crown, Zap, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface PlanLimitItemProps {
  icon: React.ReactNode;
  title: string;
  current: number;
  limit: number | null;
  available: number | null;
  color: string;
  upgradeLink?: string;
}

function PlanLimitItem({ icon, title, current, limit, available, color, upgradeLink }: PlanLimitItemProps) {
  const { t } = useTranslation();
  const isUnlimited = limit === null || limit === undefined;
  const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && percentage >= 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
        </div>
        {isUnlimited ? (
          <Badge variant="secondary" className="text-xs">
            <Crown className="w-3 h-3 mr-1" />
            {t('dashboard.planLimits.unlimited')}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">
            {current}/{limit}
          </span>
        )}
      </div>

      {!isUnlimited && (
        <div className="space-y-2">
          <Progress
            value={percentage}
            className={`h-2 ${
              isAtLimit
                ? 'plan-progress-destructive'
                : isNearLimit
                ? 'plan-progress-warning'
                : ''
            }`}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {available !== null && available > 0 ? (
                <>
                  {available} {available === 1 ? t('dashboard.planLimits.slotAvailable') : t('dashboard.planLimits.slotsAvailable')}
                </>
              ) : isAtLimit ? (
                <span className="text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('dashboard.planLimits.limitReached')}
                </span>
              ) : isNearLimit ? (
                <span className="text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('dashboard.planLimits.nearLimit')}
                </span>
              ) : (
                `${Math.max(0, limit! - current)} ${t('dashboard.planLimits.usage.remaining')}`
              )}
            </span>
            {isAtLimit && upgradeLink && (
              <Link href={upgradeLink}>
                <Button size="sm" variant="outline" className="h-6 text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  {t('dashboard.planLimits.needMore.upgrade')}
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PlanLimitsOverview() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const [planData, setPlanData] = useState<PlanLimitsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlanLimits() {
      if (!currentOrganization) return;

      try {
        setIsLoading(true);
        const response = await getPlanLimitsOverview(currentOrganization.id);
        setPlanData(response.data);
      } catch (err) {
        setError(t('errors.generic'));
        console.error("Plan limits error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPlanLimits();
  }, [currentOrganization, t]);

  if (!currentOrganization) {
    return <LoadingSpinner text={t('dashboard.planLimits.loadingOrganization')} />;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.planLimits.title')}</CardTitle>
          <CardDescription>{t('dashboard.planLimits.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingSpinner text={t('dashboard.planLimits.loading')} />
        </CardContent>
      </Card>
    );
  }

  if (error || !planData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.planLimits.title')}</CardTitle>
          <CardDescription>{t('dashboard.planLimits.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">{error || t('dashboard.planLimits.errorLoading')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { limits, usage, availableSlots } = planData;

  // Se não há limites definidos, mostrar que está em um plano ilimitado
  const hasLimits = limits && limits.maxTeamMembers !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5" />
          {t('dashboard.planLimits.title')}
        </CardTitle>
        <CardDescription>
          {t('dashboard.planLimits.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasLimits ? (
          <div className="text-center py-8">
            <Crown className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('dashboard.planLimits.unlimitedPlan.title')}</h3>
            <p className="text-muted-foreground">
              {t('dashboard.planLimits.unlimitedPlan.description')}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <PlanLimitItem
              icon={<Users className="w-4 h-4 text-purple-500" />}
              title={t('dashboard.planLimits.resources.teamMembers')}
              current={usage.currentTeamMembers}
              limit={limits?.maxTeamMembers ?? null}
              available={availableSlots?.teamMembers ?? null}
              color="purple"
              upgradeLink="/settings/billing"
            />

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t('dashboard.planLimits.needMore.title')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.planLimits.needMore.description')}
                  </p>
                </div>
                <Link href="/settings/billing">
                  <Button size="sm" className="ml-4">
                    <Zap className="w-4 h-4 mr-2" />
                    {t('dashboard.planLimits.needMore.viewPlans')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
