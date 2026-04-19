"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { Action, Module, usePermissions } from "@/lib/hooks/use-permissions";
import { useTranslation } from "@/i18n/useTranslation";
import {
  customerFleetSettingsAPI,
  type ListCustomerFleetSettingsResponse,
} from "@/lib/frontend/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CustomerFleetSettingsPage() {
  const { t } = useTranslation();
  const { currentOrganization, selectedCustomerId, user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can(Module.COMPANIES, Action.EDIT);
  const orgId = currentOrganization?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<ListCustomerFleetSettingsResponse | null>(null);
  const [editTarget, setEditTarget] = useState<string>("");
  const [offlineMinutes, setOfflineMinutes] = useState("");
  const [defaultSpeedKmh, setDefaultSpeedKmh] = useState("");
  const [offlineMinutesInvalid, setOfflineMinutesInvalid] = useState(false);
  const [defaultSpeedInvalid, setDefaultSpeedInvalid] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || !canEdit) return;
    setLoading(true);
    try {
      const res = await customerFleetSettingsAPI.list(orgId);
      setList(res.data);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t, "common.error"));
    } finally {
      setLoading(false);
    }
  }, [orgId, canEdit, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!list || editTarget !== "") return;
    const preferred = selectedCustomerId ?? list.customers[0]?.customerId;
    if (preferred && list.customers.some((c) => c.customerId === preferred)) {
      setEditTarget(preferred);
    } else if (list.customers[0]) {
      setEditTarget(list.customers[0].customerId);
    }
  }, [list, selectedCustomerId, editTarget]);

  useEffect(() => {
    if (!list || editTarget === "") return;
    const row = list.customers.find((c) => c.customerId === editTarget);
    if (row) {
      setOfflineMinutes(
        row.deviceOfflineThresholdMinutes != null
          ? String(row.deviceOfflineThresholdMinutes)
          : "",
      );
      setDefaultSpeedKmh(
        row.defaultSpeedLimitKmh != null && Number.isFinite(row.defaultSpeedLimitKmh)
          ? String(row.defaultSpeedLimitKmh)
          : "",
      );
    }
  }, [list, editTarget]);

  const parsePayload = useCallback(() => {
    setOfflineMinutesInvalid(false);
    setDefaultSpeedInvalid(false);

    const offlineTrim = offlineMinutes.trim();
    let deviceOfflineThresholdMinutes: number | null | undefined;
    if (offlineTrim === "") {
      deviceOfflineThresholdMinutes = null;
    } else {
      const n = parseInt(offlineTrim, 10);
      if (!Number.isFinite(n) || n < 1) {
        setOfflineMinutesInvalid(true);
        toast.error(t("companySettings.validation.offlineMinutes"));
        document.getElementById("offlineMinutes")?.focus();
        return null;
      }
      deviceOfflineThresholdMinutes = n;
    }

    const speedTrim = defaultSpeedKmh.trim();
    let defaultSpeedLimitKmh: number | null | undefined;
    if (speedTrim === "") {
      defaultSpeedLimitKmh = null;
    } else {
      const s = parseFloat(speedTrim.replace(",", "."));
      if (!Number.isFinite(s) || s < 0) {
        setDefaultSpeedInvalid(true);
        toast.error(t("companySettings.validation.defaultSpeed"));
        document.getElementById("defaultSpeed")?.focus();
        return null;
      }
      defaultSpeedLimitKmh = s <= 0 ? null : s;
    }
    return { deviceOfflineThresholdMinutes, defaultSpeedLimitKmh };
  }, [offlineMinutes, defaultSpeedKmh, t]);

  const handleSaveCurrent = async () => {
    if (saving) return;
    if (!orgId || editTarget === "") return;
    const payload = parsePayload();
    if (!payload) return;
    setSaving(true);
    try {
      const res = await customerFleetSettingsAPI.patch(orgId, {
        applyMode: "single",
        customerId: editTarget,
        ...payload,
      });
      setList(res.data);
      toast.success(t("companySettings.saveSuccess"));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t, "common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAllAccessible = async () => {
    if (saving) return;
    if (!orgId) return;
    const payload = parsePayload();
    if (!payload) return;
    setSaving(true);
    try {
      const res = await customerFleetSettingsAPI.patch(orgId, {
        applyMode: "all_accessible",
        ...payload,
      });
      setList(res.data);
      toast.success(t("companySettings.applyAllAccessibleSuccess"));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t, "common.error"));
    } finally {
      setSaving(false);
    }
  };

  const customerOptions = list?.customers ?? [];

  if (!orgId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("vehicles.selectOrganization")}
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("companySettings.noPermission")}
      </div>
    );
  }

  const editTargetHint = user?.isSuperAdmin
    ? t("companySettings.editTargetHintSuperAdmin")
    : t("companySettings.editTargetHintMember");

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("companySettings.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            {t("companySettings.description")}
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0 self-start sm:self-auto">
          <Link href="/dashboard/telemetry">{t("companySettings.openTelemetry")}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("companySettings.cardTitle")}</CardTitle>
          <CardDescription className="max-w-3xl">
            {t("companySettings.cardDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading || !list ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : list.customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("companySettings.noCustomersForSettings")}
            </p>
          ) : editTarget === "" ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{t("companySettings.editTargetLabel")}</Label>
                <Select value={editTarget} onValueChange={(v) => setEditTarget(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customerOptions.map((c) => (
                      <SelectItem key={c.customerId} value={c.customerId}>
                        {c.customerName ?? c.customerId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{editTargetHint}</p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="offlineMinutes">
                    {t("companySettings.offlineThresholdLabel")}
                  </Label>
                  <Input
                    id="offlineMinutes"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={offlineMinutes}
                    onChange={(e) => {
                      setOfflineMinutes(e.target.value);
                      setOfflineMinutesInvalid(false);
                    }}
                    placeholder={t("companySettings.offlineThresholdPlaceholder")}
                    aria-invalid={offlineMinutesInvalid || undefined}
                    className={cn(
                      offlineMinutesInvalid && "border-destructive ring-1 ring-destructive",
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("companySettings.offlineThresholdHint")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultSpeed">{t("companySettings.defaultSpeedLabel")}</Label>
                  <Input
                    id="defaultSpeed"
                    type="number"
                    min={0}
                    step="1"
                    inputMode="decimal"
                    value={defaultSpeedKmh}
                    onChange={(e) => {
                      setDefaultSpeedKmh(e.target.value);
                      setDefaultSpeedInvalid(false);
                    }}
                    placeholder={t("companySettings.defaultSpeedPlaceholder")}
                    aria-invalid={defaultSpeedInvalid || undefined}
                    className={cn(
                      defaultSpeedInvalid && "border-destructive ring-1 ring-destructive",
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("companySettings.defaultSpeedHint")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button onClick={() => void handleSaveCurrent()}>
                  {saving ? "…" : t("companySettings.saveCurrent")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={customerOptions.length === 0}
                  onClick={() => void handleApplyAllAccessible()}
                >
                  {t("companySettings.applyAllAccessible")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
