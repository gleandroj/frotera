"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { ChecklistTemplateFormDialog } from "./checklist-template-form-dialog";
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
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChecklistFillForm } from "./checklist-fill-form";

type TabType = "templates" | "entries";

const STATUS_ALL = "all";

const TEMPLATE_LIST_ALL = "all";
const TEMPLATE_LIST_ACTIVE = "active";
const TEMPLATE_LIST_INACTIVE = "inactive";

export default function ChecklistPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrganization, selectedCustomerId } = useAuth();
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
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<ChecklistTemplate | null>(null);
  const [templateListFilter, setTemplateListFilter] = useState<
    typeof TEMPLATE_LIST_ALL | typeof TEMPLATE_LIST_ACTIVE | typeof TEMPLATE_LIST_INACTIVE
  >(TEMPLATE_LIST_ACTIVE);
  const [fillOpen, setFillOpen] = useState(false);
  const [fillTemplateId, setFillTemplateId] = useState<string | null>(null);

  const orgId = currentOrganization?.id;

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "entries") setActiveTab("entries");
  }, [searchParams]);

  const filteredTemplates = useMemo(() => {
    if (templateListFilter === TEMPLATE_LIST_ACTIVE) {
      return templates.filter((tpl) => tpl.active);
    }
    if (templateListFilter === TEMPLATE_LIST_INACTIVE) {
      return templates.filter((tpl) => !tpl.active);
    }
    return templates;
  }, [templates, templateListFilter]);

  const fillTemplateTitle = useMemo(() => {
    if (!fillTemplateId) return t("checklist.fillChecklist");
    return templates.find((tpl) => tpl.id === fillTemplateId)?.name ?? t("checklist.fillChecklist");
  }, [fillTemplateId, templates, t]);

  const hasActiveEntryFilters = useMemo(
    () =>
      vehicleFilter.trim() !== "" ||
      statusFilter !== STATUS_ALL ||
      dateFrom !== "" ||
      dateTo !== "",
    [vehicleFilter, statusFilter, dateFrom, dateTo],
  );

  const resetEntryFilters = () => {
    setVehicleFilter("");
    setStatusFilter(STATUS_ALL);
    setDateFrom("");
    setDateTo("");
  };

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
      const res = await checklistAPI.deleteTemplate(orgId, templateToDelete.id);
      const msg = res.data?.message;
      if (msg === "CHECKLIST_TEMPLATE_DEACTIVATED") {
        setTemplates((prev) =>
          prev.map((tpl) =>
            tpl.id === templateToDelete.id ? { ...tpl, active: false } : tpl,
          ),
        );
        toast.success(t("checklist.toastTemplateDeactivated"));
      } else {
        setTemplates((prev) => prev.filter((tpl) => tpl.id !== templateToDelete.id));
        toast.success(t("checklist.toastDeleted"));
      }
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch {
      toast.error(t("checklist.toastError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const templateColumns: ColumnDef<ChecklistTemplate>[] = [
    {
      accessorKey: "name",
      meta: { labelKey: "checklist.columns.name" },
      header: t("checklist.columns.name"),
    },
    {
      accessorKey: "active",
      meta: { labelKey: "checklist.columns.active" },
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
      meta: { labelKey: "checklist.columns.itemCount" },
      header: t("checklist.columns.itemCount"),
      cell: ({ row }) => (row.getValue("items") as any[])?.length ?? 0,
    },
    {
      accessorKey: "createdAt",
      meta: { labelKey: "checklist.columns.createdAt" },
      header: t("checklist.columns.createdAt"),
      cell: ({ row }) => format(new Date(row.getValue("createdAt") as string), "dd/MM/yyyy"),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const template = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!template.active}
              title={!template.active ? t("checklist.templateInactiveHint") : undefined}
              onClick={() => {
                if (!template.active) return;
                setFillTemplateId(template.id);
                setFillOpen(true);
              }}
            >
              {t("checklist.fillChecklist")}
            </Button>
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
                  onClick={() => { setEditTemplate(template); setTemplateFormOpen(true); }}
                >
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!template.active}
                  onClick={() => {
                    if (!template.active) return;
                    const url = `${window.location.origin}/fill?orgId=${orgId}&templateId=${template.id}`;
                    navigator.clipboard.writeText(url);
                    toast.success(t("checklist.linkCopied"));
                  }}
                >
                  {t("checklist.copyLink")}
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
          </div>
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
      id: "template",
      accessorKey: "templateName",
      meta: { labelKey: "checklist.columns.template" },
      header: t("checklist.columns.template"),
      cell: ({ row }) => {
        const e = row.original;
        return e.templateName ?? e.templateId;
      },
    },
    {
      id: "vehicle",
      accessorFn: (row) =>
        [row.vehicleName, row.vehiclePlate].filter(Boolean).join(" ") || row.vehicleId,
      meta: { labelKey: "checklist.columns.vehicle" },
      header: t("checklist.columns.vehicle"),
      cell: ({ row }) => {
        const e = row.original;
        if (e.vehicleName || e.vehiclePlate) {
          return `${e.vehicleName ?? ""}${e.vehiclePlate ? ` (${e.vehiclePlate})` : ""}`.trim();
        }
        return e.vehicleId;
      },
    },
    {
      id: "member",
      accessorKey: "memberName",
      meta: { labelKey: "checklist.columns.member" },
      header: t("checklist.columns.member"),
      cell: ({ row }) => {
        const e = row.original;
        return e.memberName ?? e.memberId;
      },
    },
    {
      accessorKey: "status",
      meta: { labelKey: "checklist.columns.status" },
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
      meta: { labelKey: "checklist.columns.date" },
      header: t("checklist.columns.date"),
      cell: ({ row }) => format(new Date(row.getValue("createdAt") as string), "dd/MM/yyyy"),
    },
    {
      id: "actions",
      enableHiding: false,
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
          <p className="text-muted-foreground">{t("checklist.pageSubtitle")}</p>
        </div>
        {activeTab === "templates" && can(Module.CHECKLIST, Action.CREATE) && (
          <Button onClick={() => { setEditTemplate(null); setTemplateFormOpen(true); }} className="gap-2">
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
              data={filteredTemplates}
              filterPlaceholder={t("common.search")}
              filterColumnId="name"
              noResultsLabel={t("checklist.noTemplatesMatchFilter")}
              toolbarLeading={
                <Select
                  value={templateListFilter}
                  aria-label={t("checklist.templateListFilter")}
                  onValueChange={(v) =>
                    setTemplateListFilter(
                      v as typeof TEMPLATE_LIST_ALL | typeof TEMPLATE_LIST_ACTIVE | typeof TEMPLATE_LIST_INACTIVE,
                    )
                  }
                >
                  <SelectTrigger className="w-48 shrink-0 sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TEMPLATE_LIST_ACTIVE}>
                      {t("checklist.templateListFilterActive")}
                    </SelectItem>
                    <SelectItem value={TEMPLATE_LIST_INACTIVE}>
                      {t("checklist.templateListFilterInactive")}
                    </SelectItem>
                    <SelectItem value={TEMPLATE_LIST_ALL}>
                      {t("checklist.templateListFilterAll")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="entries" className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              placeholder={t("checklist.filterByVehicle")}
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="w-48"
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as EntryStatus | typeof STATUS_ALL)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("checklist.filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>{t("checklist.allStatuses")}</SelectItem>
                <SelectItem value="PENDING">{t("checklist.entryStatus.PENDING")}</SelectItem>
                <SelectItem value="COMPLETED">{t("checklist.entryStatus.COMPLETED")}</SelectItem>
                <SelectItem value="INCOMPLETE">{t("checklist.entryStatus.INCOMPLETE")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex min-w-[10.5rem] flex-col gap-1">
              <span className="text-xs font-medium leading-none text-muted-foreground">
                {t("common.from")}
              </span>
              <DatePicker
                value={dateFrom || undefined}
                onChange={(v) => setDateFrom(v)}
                className="w-full min-w-0"
                placeholder={t("common.calendar.pickDate")}
                allowClear
              />
            </div>
            <div className="flex min-w-[10.5rem] flex-col gap-1">
              <span className="text-xs font-medium leading-none text-muted-foreground">
                {t("common.to")}
              </span>
              <DatePicker
                value={dateTo || undefined}
                onChange={(v) => setDateTo(v)}
                className="w-full min-w-0"
                placeholder={t("common.calendar.pickDate")}
                allowClear
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={!hasActiveEntryFilters}
              onClick={resetEntryFilters}
            >
              {t("checklist.clearFilters")}
            </Button>
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
            <AlertDialogDescription className="whitespace-pre-line text-left">
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
              {isDeleting ? t("common.loading") : t("checklist.confirmDeleteTemplate.confirmButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChecklistTemplateFormDialog
        open={templateFormOpen}
        onOpenChange={(o) => { if (!o) { setTemplateFormOpen(false); setEditTemplate(null); } else { setTemplateFormOpen(true); } }}
        template={editTemplate}
        organizationId={orgId}
        onSuccess={loadTemplates}
      />

      <Sheet
        open={fillOpen}
        onOpenChange={(open) => {
          setFillOpen(open);
          if (!open) setFillTemplateId(null);
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full max-h-[100dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
            <SheetTitle>{fillTemplateTitle}</SheetTitle>
          </SheetHeader>
          {fillTemplateId && orgId && (
            <ChecklistFillForm
              key={fillTemplateId}
              templateId={fillTemplateId}
              organizationId={orgId}
              selectedCustomerId={selectedCustomerId}
              variant="sheet"
              onSuccess={() => {
                setFillOpen(false);
                setFillTemplateId(null);
                setActiveTab("entries");
                void loadEntries();
              }}
              onCancel={() => {
                setFillOpen(false);
                setFillTemplateId(null);
              }}
              onLoadError={() => {
                setFillOpen(false);
                setFillTemplateId(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
