"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import {
  checklistAPI,
  ChecklistTemplate,
  ChecklistEntry,
  EntryStatus,
  ChecklistEntryFilters,
} from "@/lib/frontend/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TabType = "templates" | "entries";

const STATUS_ALL = "all";

export default function ChecklistPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentOrganization } = useAuth();
  const { can } = usePermissions();

  const [activeTab, setActiveTab] = useState<TabType>("templates");
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [entries, setEntries] = useState<ChecklistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<ChecklistTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [vehicleFilter, setVehicleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<EntryStatus | typeof STATUS_ALL>(STATUS_ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const orgId = currentOrganization?.id;

  const loadTemplates = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const res = await checklistAPI.listTemplates(orgId);
      setTemplates(res.data);
    } catch {
      toast.error(t("checklist.toastError"));
    } finally {
      setLoading(false);
    }
  };

  const buildFilters = (): ChecklistEntryFilters => ({
    ...(vehicleFilter && { vehicleId: vehicleFilter }),
    ...(statusFilter !== STATUS_ALL && { status: statusFilter as EntryStatus }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  });

  const loadEntries = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const res = await checklistAPI.listEntries(orgId, buildFilters());
      setEntries(res.data);
    } catch {
      toast.error(t("checklist.toastError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "templates") loadTemplates();
    else loadEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, orgId]);

  useEffect(() => {
    if (activeTab === "entries" && orgId) loadEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleFilter, statusFilter, dateFrom, dateTo]);

  const handleConfirmDelete = async () => {
    if (!templateToDelete || !orgId) return;
    try {
      setIsDeleting(true);
      await checklistAPI.deleteTemplate(orgId, templateToDelete.id);
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== templateToDelete.id));
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      toast.success(t("checklist.toastDeleted"));
    } catch {
      toast.error(t("checklist.toastError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const templateColumns: ColumnDef<ChecklistTemplate>[] = [
    {
      accessorKey: "name",
      header: t("checklist.columns.name"),
    },
    {
      accessorKey: "active",
      header: t("checklist.columns.active"),
      cell: ({ row }) => {
        const active = row.getValue("active") as boolean;
        return (
          <Badge variant="outline" className={active ? "text-green-700 border-green-300 bg-green-50" : "text-gray-500 border-gray-200"}>
            {active ? t("common.active") : t("common.inactive")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "items",
      header: t("checklist.columns.itemCount"),
      cell: ({ row }) => (row.getValue("items") as any[])?.length ?? 0,
    },
    {
      accessorKey: "createdAt",
      header: t("checklist.columns.createdAt"),
      cell: ({ row }) => format(new Date(row.getValue("createdAt") as string), "dd/MM/yyyy"),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const template = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t("common.actions")}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push(`/dashboard/checklist/templates/${template.id}`)}
              >
                {t("common.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/dashboard/checklist/fill/${template.id}`)}
              >
                {t("checklist.fillChecklist")}
              </DropdownMenuItem>
              {can(Module.CHECKLIST, Action.DELETE) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => { setTemplateToDelete(template); setDeleteDialogOpen(true); }}
                  >
                    {t("common.delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const statusConfig: Record<EntryStatus, string> = {
    COMPLETED: "text-green-700 border-green-300 bg-green-50",
    PENDING: "text-yellow-700 border-yellow-300 bg-yellow-50",
    INCOMPLETE: "text-red-700 border-red-300 bg-red-50",
  };

  const entryColumns: ColumnDef<ChecklistEntry>[] = [
    {
      accessorKey: "templateId",
      header: t("checklist.columns.template"),
      cell: ({ row }) => (row.getValue("templateId") as string).substring(0, 8) + "…",
    },
    {
      accessorKey: "vehicleId",
      header: t("checklist.columns.vehicle"),
      cell: ({ row }) => (row.getValue("vehicleId") as string).substring(0, 8) + "…",
    },
    {
      accessorKey: "memberId",
      header: t("checklist.columns.member"),
      cell: ({ row }) => (row.getValue("memberId") as string).substring(0, 8) + "…",
    },
    {
      accessorKey: "status",
      header: t("checklist.columns.status"),
      cell: ({ row }) => {
        const status = row.getValue("status") as EntryStatus;
        return (
          <Badge variant="outline" className={statusConfig[status]}>
            {t(`checklist.entryStatus.${status}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: t("checklist.columns.date"),
      cell: ({ row }) => format(new Date(row.getValue("createdAt") as string), "dd/MM/yyyy"),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/dashboard/checklist/entries/${row.original.id}`)}
        >
          {t("common.view")}
        </Button>
      ),
    },
  ];

  if (!orgId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{t("checklist.title")}</h1>
        <p className="text-muted-foreground">{t("common.selectOrganization")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("checklist.title")}</h1>
          <p className="text-muted-foreground">{t("checklist.title")}</p>
        </div>
        {activeTab === "templates" && can(Module.CHECKLIST, Action.CREATE) && (
          <Button onClick={() => router.push("/dashboard/checklist/templates/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("checklist.newTemplate")}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList>
          <TabsTrigger value="templates">{t("checklist.templates")}</TabsTrigger>
          <TabsTrigger value="entries">{t("checklist.entries")}</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : templates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("checklist.noTemplates")}</p>
          ) : (
            <DataTable
              columns={templateColumns}
              data={templates}
              filterPlaceholder={t("common.search")}
              filterColumnId="name"
              noResultsLabel={t("checklist.noTemplates")}
            />
          )}
        </TabsContent>

        <TabsContent value="entries" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder={t("checklist.filterByVehicle")}
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as EntryStatus | typeof STATUS_ALL)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("checklist.filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>{t("checklist.allStatuses")}</SelectItem>
                <SelectItem value="PENDING">{t("checklist.entryStatus.PENDING")}</SelectItem>
                <SelectItem value="COMPLETED">{t("checklist.entryStatus.COMPLETED")}</SelectItem>
                <SelectItem value="INCOMPLETE">{t("checklist.entryStatus.INCOMPLETE")}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("checklist.noEntries")}</p>
          ) : (
            <DataTable
              columns={entryColumns}
              data={entries}
              noResultsLabel={t("checklist.noEntries")}
            />
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("checklist.confirmDeleteTemplate.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("checklist.confirmDeleteTemplate.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting ? t("common.loading") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
