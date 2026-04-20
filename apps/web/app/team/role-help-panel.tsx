"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Role } from "@/lib/api/roles";
import { describeRole, summarizeRolePermissions, summarizeRoleScope } from "./role-display";

type TranslationFn = (key: string, options?: any) => string;

interface RoleHelpPanelProps {
  role: Role | undefined;
  t: TranslationFn;
}

export function RoleHelpPanel({ role, t }: RoleHelpPanelProps) {
  const scopeSummary = summarizeRoleScope(t, role);
  const permissionSummary = summarizeRolePermissions(t, role);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("team.roleContext.title")}</CardTitle>
        <CardDescription>{describeRole(t, role)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t("team.roleContext.scopeTitle")}</p>
          <div className="flex flex-wrap gap-2">
            {scopeSummary.labels.length === 0 ? (
              <span className="text-sm text-muted-foreground">{t("team.roleContext.noScopeDefined")}</span>
            ) : (
              scopeSummary.labels.map((label, i) => (
                <Badge key={`${label}-${i}`} variant="secondary">{label}</Badge>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">{scopeSummary.explanation}</p>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t("team.roleContext.permissionsTitle")}</p>
          {permissionSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("team.roleContext.noPermissions")}</p>
          ) : (
            <div className="space-y-1">
              {permissionSummary.map((line) => (
                <p key={line} className="text-sm text-muted-foreground">{line}</p>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
