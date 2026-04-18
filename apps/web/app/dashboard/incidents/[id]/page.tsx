"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, Circle, Loader2, Paperclip } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { Action, Module, usePermissions } from "@/lib/hooks/use-permissions";
import {
  incidentsAPI,
  type Incident,
  type IncidentAttachment,
} from "@/lib/frontend/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { formatLocaleCurrency } from "@/lib/locale-decimal";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/useTranslation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { DeleteIncidentDialog } from "../delete-incident-dialog";
import { IncidentFormSheet } from "../incident-form-sheet";

const STATUS_ORDER = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

function statusBadgeClass(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "IN_PROGRESS":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    case "RESOLVED":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "CLOSED":
      return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    default:
      return "";
  }
}

function severityBadgeClass(severity: string) {
  switch (severity) {
    case "LOW":
      return "bg-slate-100 text-slate-700 hover:bg-slate-100";
    case "MEDIUM":
      return "bg-orange-100 text-orange-700 hover:bg-orange-100";
    case "HIGH":
      return "bg-red-100 text-red-700 hover:bg-red-100";
    case "CRITICAL":
      return "bg-red-900 text-red-100 hover:bg-red-900";
    default:
      return "";
  }
}

function nextStatusActions(
  status: string,
): { next: string; labelKey: string }[] {
  switch (status) {
    case "OPEN":
      return [
        { next: "IN_PROGRESS", labelKey: "incidents.statusActions.startProgress" },
        { next: "RESOLVED", labelKey: "incidents.statusActions.resolve" },
      ];
    case "IN_PROGRESS":
      return [{ next: "RESOLVED", labelKey: "incidents.statusActions.markResolved" }];
    case "RESOLVED":
      return [{ next: "CLOSED", labelKey: "incidents.statusActions.close" }];
    default:
      return [];
  }
}

export default function IncidentDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { t } = useTranslation();
  const intlLocale = useIntlLocale();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const canEdit = can(Module.INCIDENTS, Action.EDIT);
  const canCreate = can(Module.INCIDENTS, Action.CREATE);
  const canDelete = can(Module.INCIDENTS, Action.DELETE);

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const [attBusy, setAttBusy] = useState(false);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const currency = currentOrganization?.currency ?? "BRL";

  const load = useCallback(async () => {
    if (!currentOrganization?.id || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await incidentsAPI.getOne(currentOrganization.id, id);
      setIncident(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, t));
      setIncident(null);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = useMemo(
    () => (iso: string) =>
      new Date(iso).toLocaleString(intlLocale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [intlLocale],
  );

  const currentIdx = incident
    ? STATUS_ORDER.indexOf(incident.status as (typeof STATUS_ORDER)[number])
    : -1;

  const handleStatus = (next: string) => {
    if (!currentOrganization?.id || !incident) return;
    setStatusBusy(true);
    incidentsAPI
      .update(currentOrganization.id, incident.id, { status: next })
      .then((res) => {
        setIncident(res.data);
        toast.success(
          t("incidents.toast.statusUpdated", {
            status: t(`incidents.status.${next}`),
          }),
        );
      })
      .catch(() => toast.error(t("incidents.toast.error")))
      .finally(() => setStatusBusy(false));
  };

  const handleAttachmentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!currentOrganization?.id || !incident || !canCreate || !file) return;
    setAttBusy(true);
    try {
      const { data: row } = await incidentsAPI.uploadAttachment(
        currentOrganization.id,
        incident.id,
        file,
      );
      setIncident((prev) =>
        prev ? { ...prev, attachments: [...prev.attachments, row] } : prev,
      );
      toast.success(t("incidents.toast.attachmentAdded"));
    } catch {
      toast.error(t("incidents.attachments.uploadError"));
    } finally {
      setAttBusy(false);
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    if (!currentOrganization?.id || !incident || !canDelete) return;
    incidentsAPI
      .removeAttachment(currentOrganization.id, incident.id, attachmentId)
      .then(() => {
        setIncident((prev) =>
          prev
            ? {
                ...prev,
                attachments: prev.attachments.filter((a) => a.id !== attachmentId),
              }
            : prev,
        );
        toast.success(t("incidents.toast.attachmentRemoved"));
      })
      .catch(() => toast.error(t("incidents.toast.error")));
  };

  const handleDeleteSuccess = () => {
    router.push("/dashboard/incidents");
  };

  if (!currentOrganization) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">{t("incidents.selectOrganization")}</p>
      </div>
    );
  }

  if (loading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  if (error || !incident) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error ?? t("incidents.incidentNotFound")}</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/incidents">{t("incidents.backToIncidents")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="w-fit px-0" asChild>
            <Link href="/dashboard/incidents">{t("incidents.backToIncidents")}</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{incident.title}</h1>
            <Badge
              variant="secondary"
              className={cn("font-normal", statusBadgeClass(incident.status))}
            >
              {t(`incidents.status.${incident.status}`)}
            </Badge>
            <Badge
              variant="secondary"
              className={cn("font-normal", severityBadgeClass(incident.severity))}
            >
              {t(`incidents.severity.${incident.severity}`)}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button variant="outline" onClick={() => setEditSheetOpen(true)}>
              {t("common.edit")}
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              {t("incidents.deleteIncident")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("incidents.fields.type")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t("incidents.fields.type")}: </span>
              <span className="font-medium">{t(`incidents.type.${incident.type}`)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("incidents.fields.date")}: </span>
              <span className="font-medium">{formatDate(incident.date)}</span>
            </div>
            {incident.vehicle ? (
              <div>
                <span className="text-muted-foreground">{t("incidents.fields.vehicle")}: </span>
                <span className="font-medium">
                  {[incident.vehicle.name, incident.vehicle.plate].filter(Boolean).join(" · ")}
                </span>
              </div>
            ) : null}
            {incident.driverId ? (
              <div>
                <span className="text-muted-foreground">{t("incidents.fields.driver")}: </span>
                <span className="font-medium">{incident.driverId}</span>
              </div>
            ) : null}
            {incident.location ? (
              <div>
                <span className="text-muted-foreground">{t("incidents.fields.location")}: </span>
                <span className="font-medium">{incident.location}</span>
              </div>
            ) : null}
            <div>
              <span className="text-muted-foreground">{t("incidents.fields.cost")}: </span>
              <span className="font-medium">
                {incident.cost != null
                  ? formatLocaleCurrency(incident.cost, intlLocale, currency)
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("incidents.fields.insuranceClaim")}: </span>
              <span className="font-medium">{incident.insuranceClaim ? t("common.yes") : t("common.no")}</span>
            </div>
            {incident.claimNumber ? (
              <div>
                <span className="text-muted-foreground">{t("incidents.fields.claimNumber")}: </span>
                <span className="font-medium">{incident.claimNumber}</span>
              </div>
            ) : null}
            {incident.resolvedAt ? (
              <div>
                <span className="text-muted-foreground">{t("incidents.fields.resolvedAt")}: </span>
                <span className="font-medium">{formatDate(incident.resolvedAt)}</span>
              </div>
            ) : null}
            {incident.description ? (
              <div className="pt-2">
                <p className="text-muted-foreground">{t("incidents.fields.description")}</p>
                <p className="mt-1 whitespace-pre-wrap">{incident.description}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("incidents.timeline.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("incidents.timeline.currentStatus")}: {t(`incidents.status.${incident.status}`)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-0">
              {STATUS_ORDER.map((st, stepIdx) => {
                const done = currentIdx >= stepIdx;
                const active = incident.status === st;
                const isLast = stepIdx === STATUS_ORDER.length - 1;
                return (
                  <li key={st} className="flex gap-4">
                    <div className="flex w-10 shrink-0 flex-col items-center">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                          done && "border-green-600/40",
                          active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                        )}
                      >
                        {done ? (
                          <Check className="h-4 w-4 text-green-600" aria-hidden />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />
                        )}
                      </div>
                      {!isLast ? (
                        <div
                          className="mt-1 w-px flex-1 min-h-[0.75rem] bg-border"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "min-w-0 flex-1 pt-1.5",
                        !isLast && "pb-8",
                      )}
                    >
                      <p
                        className={cn(
                          "text-sm font-medium leading-snug",
                          active && "text-primary",
                          !active && "text-foreground",
                        )}
                      >
                        {t(`incidents.status.${st}`)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {canEdit && nextStatusActions(incident.status).length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {nextStatusActions(incident.status).map((a) => (
                  <Button
                    key={a.next}
                    size="sm"
                    disabled={statusBusy}
                    onClick={() => handleStatus(a.next)}
                  >
                    {t(a.labelKey)}
                  </Button>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("incidents.fields.attachments")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {incident.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("incidents.attachments.noAttachments")}</p>
          ) : (
            <ul className="space-y-2">
              {incident.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.fileType}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={a.fileUrl} target="_blank" rel="noopener noreferrer">
                        {t("incidents.attachments.download")}
                      </a>
                    </Button>
                    {canDelete ? (
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveAttachment(a.id)}>
                        {t("incidents.attachments.delete")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canCreate ? (
            <div className="space-y-3 border-t pt-4">
              <div>
                <p className="text-sm font-medium">{t("incidents.attachments.add")}</p>
                <p className="text-xs text-muted-foreground">{t("incidents.attachments.uploadHint")}</p>
              </div>
              <input
                ref={attachmentFileInputRef}
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                tabIndex={-1}
                onChange={handleAttachmentFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={attBusy}
                onClick={() => attachmentFileInputRef.current?.click()}
              >
                {attBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {t("incidents.attachments.uploading")}
                  </>
                ) : (
                  <>
                    <Paperclip className="mr-2 h-4 w-4" aria-hidden />
                    {t("incidents.attachments.chooseFile")}
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {incident.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("incidents.fields.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{incident.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <DeleteIncidentDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        incident={incident}
        organizationId={currentOrganization.id}
        onSuccess={handleDeleteSuccess}
      />

      {canEdit ? (
        <IncidentFormSheet
          open={editSheetOpen}
          onOpenChange={setEditSheetOpen}
          organizationId={currentOrganization.id}
          selectedCustomerId={selectedCustomerId}
          incident={incident}
          onSuccess={(updated) => {
            setIncident(updated);
          }}
        />
      ) : null}
    </div>
  );
}
