"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import {
  checklistAPI,
  type ChecklistAnswer,
  type ChecklistEntry,
  EntryStatus,
} from "@/lib/frontend/api-client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseChecklistAttachment } from "@/lib/checklist-answer-utils";
import { parseChecklistSignaturePayload } from "@/lib/checklist-signature";

/** URL ou data URL de foto/arquivo (photoUrl ou JSON em value). */
function checklistAttachmentSrc(answer: ChecklistAnswer): string | null {
  const pu = answer.photoUrl?.trim();
  if (
    pu &&
    (pu.startsWith("data:image") || pu.startsWith("http://") || pu.startsWith("https://"))
  ) {
    return pu;
  }
  const att = parseChecklistAttachment(answer.value ?? undefined);
  if (att?.photoUrl) return att.photoUrl;
  const val = answer.value?.trim();
  if (
    val &&
    (val.startsWith("data:image") || val.startsWith("http://") || val.startsWith("https://"))
  ) {
    return val;
  }
  return null;
}

export default function ChecklistEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation();
  const router = useRouter();
  const { currentOrganization } = useAuth();
  const { can } = usePermissions();

  const [entry, setEntry] = useState<ChecklistEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const orgId = currentOrganization?.id;

  // Load entry and template in parallel
  useEffect(() => {
    if (!orgId || !id) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const entryRes = await checklistAPI.getEntry(orgId, id);
        setEntry(entryRes.data);
      } catch (err) {
        console.error("Failed to load entry:", err);
        toast.error(t("checklist.toastError"));
        router.push("/dashboard/checklist");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orgId, id, router, t]);

  const handleStatusChange = async (newStatus: EntryStatus) => {
    if (!orgId || !entry) return;

    try {
      setUpdating(true);
      const res = await checklistAPI.updateEntryStatus(orgId, id, newStatus);
      setEntry(res.data);
      toast.success(t("checklist.toastEntryUpdated"));
    } catch (err) {
      console.error("Failed to update entry status:", err);
      toast.error(t("checklist.toastError"));
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadgeColor = (status: EntryStatus) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "INCOMPLETE":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatAnswerValue = (answer: ChecklistAnswer | undefined, itemType: string): string => {
    if (!answer) return "—";
    if (itemType === "PHOTO" || itemType === "FILE") {
      return checklistAttachmentSrc(answer) ? t("checklist.photoAttached") : "—";
    }
    if (itemType === "SIGNATURE") {
      const p = parseChecklistSignaturePayload(answer.value ?? undefined);
      if (p) {
        const parts: string[] = [];
        if (p.mode === "text" && p.text) parts.push(p.text);
        if (p.mode === "draw" && p.drawImageUrl) parts.push(t("checklist.signatureDrawAttached"));
        if (p.server?.ip != null && p.server.ip !== "")
          parts.push(`${t("checklist.signatureIp")}: ${p.server.ip}`);
        return parts.length > 0 ? parts.join(" · ") : "—";
      }
      if (answer.value?.startsWith("data:image")) return t("checklist.signatureLegacy");
      return answer.value && answer.value.length > 0 ? answer.value.slice(0, 120) : "—";
    }
    if (answer.value === undefined || answer.value === null || answer.value === "") {
      return answer.photoUrl ? t("checklist.photoAttached") : "—";
    }

    switch (itemType) {
      case "YES_NO":
        return answer.value === "true" ? t("common.yes") : t("common.no");
      default:
        return String(answer.value);
    }
  };

  if (!orgId) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("checklist.entryDetail")}
          </h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t("common.selectOrganization")}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("checklist.entryDetail")}
          </h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("checklist.entryDetail")}
          </h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t("checklist.toastError")}
        </div>
      </div>
    );
  }

  // Sort answers by snapshot order
  const sortedAnswers = [...entry.answers].sort((a, b) => (a.itemOrder ?? 0) - (b.itemOrder ?? 0));

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Button>

      {/* Header Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("checklist.entryDetail")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Template */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("checklist.template")}
              </p>
              <p className="text-base">{entry.templateName ?? "—"}</p>
            </div>

            {/* Vehicle */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("checklist.vehicle")}
              </p>
              <p className="text-base">
                {entry.vehicleName || entry.vehiclePlate
                  ? `${entry.vehicleName ?? ""} ${entry.vehiclePlate ? `(${entry.vehiclePlate})` : ""}`.trim()
                  : entry.vehicleId ?? "—"}
              </p>
            </div>

            {/* Driver */}
            {(entry.driverId || entry.driverName) && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("checklist.driver")}
                </p>
                <p className="text-base">{entry.driverName ?? entry.driverId}</p>
              </div>
            )}

            {/* Member */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("checklist.answeredBy")}
              </p>
              <p className="text-base">{entry.memberName ?? entry.memberId}</p>
            </div>

            {/* Status Badge */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("checklist.columns.status")}
              </p>
              <div className="mt-1">
                <Badge
                  className={getStatusBadgeColor(entry.status)}
                  variant="outline"
                >
                  {t(`checklist.entryStatus.${entry.status}`)}
                </Badge>
              </div>
            </div>

            {/* Date */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("checklist.answeredAt")}
              </p>
              <p className="text-base">
                {format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm")}
              </p>
            </div>
          </div>

          {/* Status Change Section (Admin/Owner Only) */}
          {can(Module.CHECKLIST, Action.EDIT) && (
            <div className="border-t pt-4">
              <label className="text-sm font-medium text-muted-foreground">
                {t("common.status")}
              </label>
              <Select
                value={entry.status}
                onValueChange={(value) =>
                  handleStatusChange(value as EntryStatus)
                }
                disabled={updating}
              >
                <SelectTrigger className="w-full md:w-48 mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">
                    {t("checklist.entryStatus.PENDING")}
                  </SelectItem>
                  <SelectItem value="COMPLETED">
                    {t("checklist.entryStatus.COMPLETED")}
                  </SelectItem>
                  <SelectItem value="INCOMPLETE">
                    {t("checklist.entryStatus.INCOMPLETE")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Answers Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("checklist.templateItems")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("checklist.itemLabel")}</TableHead>
                  <TableHead>{t("checklist.itemType")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAnswers.map((answer) => (
                  <TableRow key={answer.id}>
                    <TableCell className="font-medium">
                      {answer.itemLabel ?? "—"}
                      {answer.itemRequired && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </TableCell>
                    <TableCell>{answer.itemType ? t(`checklist.itemTypes.${answer.itemType}`) : "—"}</TableCell>
                    <TableCell>
                      {(() => {
                        const type = answer.itemType ?? "";
                        if (type === "PHOTO" || type === "FILE") {
                          const src = checklistAttachmentSrc(answer);
                          if (!src) {
                            return formatAnswerValue(answer, type);
                          }
                          const isHttp =
                            src.startsWith("http://") || src.startsWith("https://");
                          return isHttp ? (
                            <a
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline break-all"
                            >
                              {type === "FILE"
                                ? t("checklist.openAttachment")
                                : t("common.view")}
                            </a>
                          ) : (
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-primary"
                              onClick={() => setPhotoPreview(src)}
                            >
                              {t("common.view")}
                            </Button>
                          );
                        }
                        if (type === "SIGNATURE") {
                          const p = parseChecklistSignaturePayload(answer.value ?? undefined);
                          const drawUrl = p?.drawImageUrl;
                          const isHttpDraw =
                            drawUrl &&
                            (drawUrl.startsWith("http://") ||
                              drawUrl.startsWith("https://"));
                          return (
                            <div className="space-y-1 text-sm">
                              <div>{formatAnswerValue(answer, type)}</div>
                              {isHttpDraw && (
                                <a
                                  href={drawUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline break-all"
                                >
                                  {t("checklist.signatureDrawAttached")}
                                </a>
                              )}
                              {drawUrl?.startsWith("data:image") && (
                                <Button
                                  type="button"
                                  variant="link"
                                  className="h-auto p-0 text-primary"
                                  onClick={() => setPhotoPreview(drawUrl)}
                                >
                                  {t("checklist.signatureDrawAttached")}
                                </Button>
                              )}
                            </div>
                          );
                        }
                        return formatAnswerValue(answer, type);
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!photoPreview} onOpenChange={(open) => !open && setPhotoPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("checklist.photoPreview")}</DialogTitle>
          </DialogHeader>
          {photoPreview && (
            <img
              src={photoPreview}
              alt=""
              className="max-h-[70vh] w-full object-contain rounded-md border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
