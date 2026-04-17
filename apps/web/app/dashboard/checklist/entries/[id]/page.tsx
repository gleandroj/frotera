"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import {
  checklistAPI,
  ChecklistEntry,
  ChecklistTemplate,
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
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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

  // Load template after entry is loaded
  useEffect(() => {
    if (!orgId || !entry) return;

    const loadTemplate = async () => {
      try {
        const templateRes = await checklistAPI.getTemplate(orgId, entry.templateId);
        setTemplate(templateRes.data);
      } catch (err) {
        console.error("Failed to load template:", err);
        toast.error(t("checklist.toastError"));
      }
    };

    loadTemplate();
  }, [orgId, entry, t]);

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

  const formatAnswerValue = (answer: any, itemType: string): string => {
    if (!answer || !answer.value) {
      return answer?.photoUrl ? `📎 ${answer.photoUrl}` : "—";
    }

    switch (itemType) {
      case "YES_NO":
        return answer.value === "true" || answer.value === true
          ? t("common.yes")
          : t("common.no");
      case "PHOTO":
        return answer.photoUrl || answer.value;
      default:
        return answer.value;
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

  if (!entry || !template) {
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

  // Sort template items by order
  const sortedItems = [...template.items].sort((a, b) => a.order - b.order);

  // Create a map of answers by itemId for easy lookup
  const answerMap = new Map(entry.answers.map((a) => [a.itemId, a]));

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
              <p className="text-base">{template.name}</p>
            </div>

            {/* Vehicle */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("checklist.vehicle")}
              </p>
              <p className="text-base">{entry.vehicleId}</p>
            </div>

            {/* Driver */}
            {entry.driverId && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Motorista
                </p>
                <p className="text-base">{entry.driverId}</p>
              </div>
            )}

            {/* Member */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("checklist.answeredBy")}
              </p>
              <p className="text-base">{entry.memberId}</p>
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
                {sortedItems.map((item) => {
                  const answer = answerMap.get(item.id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.label}
                        {item.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </TableCell>
                      <TableCell>{t(`checklist.itemTypes.${item.type}`)}</TableCell>
                      <TableCell>
                        {item.type === "PHOTO" && answer?.photoUrl ? (
                          <a
                            href={answer.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline break-all"
                          >
                            {t("common.view")}
                          </a>
                        ) : (
                          formatAnswerValue(answer, item.type)
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
