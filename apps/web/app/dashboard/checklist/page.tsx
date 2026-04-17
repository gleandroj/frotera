"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { checklistAPI, ChecklistTemplate, ChecklistEntry, EntryStatus, ChecklistEntryFilters } from "@/lib/frontend/api-client";
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

  // Filters for entries
  const [filters, setFilters] = useState<ChecklistEntryFilters>({});

  const orgId = currentOrganization?.id;

  // Load templates
  const loadTemplates = async () => {
    if (!orgId) return;

    try {
      setLoading(true);
      const response = await checklistAPI.listTemplates(orgId);
      setTemplates(response.data);
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error(t("checklist.toastError"));
    } finally {
      setLoading(false);
    }
  };

  // Load entries
  const loadEntries = async () => {
    if (!orgId) return;

    try {
      setLoading(true);
      const response = await checklistAPI.listEntries(orgId, filters);
      setEntries(response.data);
    } catch (error) {
      console.error("Failed to load entries:", error);
      toast.error(t("checklist.toastError"));
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount and when tab changes
  useEffect(() => {
    if (activeTab === "templates") {
      loadTemplates();
    } else {
      loadEntries();
    }
  }, [activeTab, orgId]);

  // Load entries when filters change
  useEffect(() => {
    if (activeTab === "entries" && orgId) {
      loadEntries();
    }
  }, [filters, orgId, activeTab]);

  const handleDeleteTemplate = (template: ChecklistTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete || !orgId) return;

    try {
      setIsDeleting(true);
      await checklistAPI.deleteTemplate(orgId, templateToDelete.id);
      setTemplates(templates.filter((t) => t.id !== templateToDelete.id));
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      toast.success(t("checklist.toastDeleted"));
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error(t("checklist.toastError"));
    } finally {
      setIsDeleting(false);
    }
  };

  // Template columns
  const templateColumns: ColumnDef<ChecklistTemplate>[] = [
    {
      accessorKey: "name",
      header: t("checklist.columns.name"),
      cell: ({ row }) => row.getValue("name"),
    },
    {
      accessorKey: "active",
      header: t("checklist.columns.active"),
      cell: ({ row }) => {
        const active = row.getValue("active") as boolean;
        return (
          <Badge
            className={active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
            variant="outline"
          >
            {active ? t("common.active") : t("common.inactive")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "items",
      header: t("checklist.columns.itemCount"),
      cell: ({ row }) => {
        const items = row.getValue("items") as any[];
        return items?.length || 0;
      },
    },
    {
      accessorKey: "createdAt",
      header: t("checklist.columns.createdAt"),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt") as string);
        return format(date, "dd/MM/yyyy");
      },
    },
    {
      id: "actions",
      header: t("common.actions"),
      cell: ({ row }) => {
        const template = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/dashboard/checklist/templates/${template.id}`)}>
                {t("common.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/checklist/fill/${template.id}`)}>
                {t("checklist.fillChecklist")}
              </DropdownMenuItem>
              {can(Module.CHECKLIST, Action.DELETE) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => handleDeleteTemplate(template)}
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

  // Entry columns
  const entryColumns: ColumnDef<ChecklistEntry>[] = [
    {
      accessorKey: "templateId",
      header: t("checklist.columns.template"),
      cell: ({ row }) => {
        const templateId = row.getValue("templateId") as string;
        return templateId.substring(0, 8);
      },
    },
    {
      accessorKey: "vehicleId",
      header: t("checklist.columns.vehicle"),
      cell: ({ row }) => {
        const vehicleId = row.getValue("vehicleId") as string;
        return vehicleId.substring(0, 8);
      },
    },
    {
      accessorKey: "memberId",
      header: t("checklist.columns.member"),
      cell: ({ row }) => {
        const memberId = row.getValue("memberId") as string;
        return memberId.substring(0, 8);
      },
    },
    {
      accessorKey: "status",
      header: t("checklist.columns.status"),
      cell: ({ row }) => {
        const status = row.getValue("status") as EntryStatus;
        const statusConfig: Record<EntryStatus, { className: string }> = {
          COMPLETED: {
            className: "bg-green-100 text-green-800",
          },
          PENDING: {
            className: "bg-yellow-100 text-yellow-800",
          },
          INCOMPLETE: {
            className: "bg-red-100 text-red-800",
          },
        };
        const config = statusConfig[status];
        return (
          <Badge className={config.className} variant="outline">
            {t(`checklist.entryStatus.${status}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: t("checklist.columns.date"),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt") as string);
        return format(date, "dd/MM/yyyy");
      },
    },
  ];

  if (!orgId) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("checklist.title")}</h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t("common.selectOrganization")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("checklist.title")}</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as TabType)}>
        <TabsList>
          <TabsTrigger value="templates">{t("checklist.templates")}</TabsTrigger>
          <TabsTrigger value="entries">{t("checklist.entries")}</TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            {can(Module.CHECKLIST, Action.CREATE) && (
              <Button
                onClick={() => router.push("/dashboard/checklist/templates/new")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {t("checklist.newTemplate")}
              </Button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("checklist.noTemplates")}
            </div>
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

        {/* Entries Tab */}
        <TabsContent value="entries" className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder={t("checklist.filterByVehicle")}
                value={filters.vehicleId || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    vehicleId: e.target.value || undefined,
                  })
                }
              />
              <Select
                value={filters.status || ""}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    status: (value as EntryStatus) || undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("checklist.filterByStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("checklist.allStatuses")}</SelectItem>
                  <SelectItem value="PENDING">{t("checklist.entryStatus.PENDING")}</SelectItem>
                  <SelectItem value="COMPLETED">{t("checklist.entryStatus.COMPLETED")}</SelectItem>
                  <SelectItem value="INCOMPLETE">{t("checklist.entryStatus.INCOMPLETE")}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    dateFrom: e.target.value || undefined,
                  })
                }
                placeholder={t("common.fromDate")}
              />
              <Input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    dateTo: e.target.value || undefined,
                  })
                }
                placeholder={t("common.toDate")}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("checklist.noEntries")}
            </div>
          ) : (
            <div
              onClick={(e) => {
                const row = (e.target as HTMLElement).closest("tr");
                if (row && row !== (e.target as HTMLElement).closest("tr[data-actions]")) {
                  const entryId = row.getAttribute("data-entry-id");
                  if (entryId) {
                    router.push(`/dashboard/checklist/entries/${entryId}`);
                  }
                }
              }}
              className="cursor-pointer"
            >
              <DataTable
                columns={entryColumns}
                data={entries}
                noResultsLabel={t("checklist.noEntries")}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Template Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("checklist.confirmDeleteTemplate.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("checklist.confirmDeleteTemplate.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? t("common.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
