"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, MoreVertical, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Incident } from "@/lib/frontend/api-client";
import { cn } from "@/lib/utils";

type TFunction = (key: string, options?: Record<string, unknown>) => string;

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

export interface IncidentColumnsOptions {
  onDelete: (incident: Incident) => void;
  canDelete: boolean;
  formatCost: (value: number | null) => string;
  formatDate: (iso: string) => string;
}

export function getIncidentColumns(
  t: TFunction,
  options: IncidentColumnsOptions,
): ColumnDef<Incident>[] {
  const { onDelete, canDelete, formatCost, formatDate } = options;

  return [
    {
      accessorKey: "title",
      meta: { labelKey: "incidents.columns.title" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("incidents.columns.title")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/incidents/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "type",
      meta: { labelKey: "incidents.columns.type" },
      header: t("incidents.columns.type"),
      cell: ({ row }) => (
        <span>{t(`incidents.type.${row.original.type}`)}</span>
      ),
    },
    {
      id: "vehicle",
      accessorFn: (row) =>
        row.vehicle
          ? [row.vehicle.name, row.vehicle.plate].filter(Boolean).join(" · ")
          : "",
      meta: { labelKey: "incidents.columns.vehicle" },
      header: t("incidents.columns.vehicle"),
      cell: ({ row }) => {
        const v = row.original.vehicle;
        if (!v) return <span className="text-muted-foreground">—</span>;
        const label = [v.name, v.plate].filter(Boolean).join(" · ") || "—";
        return <span className="text-muted-foreground">{label}</span>;
      },
    },
    {
      id: "customer",
      accessorFn: (row) => row.customer?.name ?? "",
      meta: { labelKey: "incidents.columns.customer" },
      header: t("incidents.columns.customer"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.customer?.name ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "date",
      meta: { labelKey: "incidents.columns.date" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("incidents.columns.date")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      accessorKey: "status",
      meta: { labelKey: "incidents.columns.status" },
      header: t("incidents.columns.status"),
      cell: ({ row }) => (
        <Badge
          variant="secondary"
          className={cn("font-normal", statusBadgeClass(row.original.status))}
        >
          {t(`incidents.status.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "severity",
      meta: { labelKey: "incidents.columns.severity" },
      header: t("incidents.columns.severity"),
      cell: ({ row }) => (
        <Badge
          variant="secondary"
          className={cn("font-normal", severityBadgeClass(row.original.severity))}
        >
          {t(`incidents.severity.${row.original.severity}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "cost",
      meta: { labelKey: "incidents.columns.cost" },
      header: t("incidents.columns.cost"),
      cell: ({ row }) => formatCost(row.original.cost),
    },
    {
      id: "actions",
      meta: { labelKey: "incidents.columns.actions" },
      enableHiding: false,
      cell: ({ row }) => {
        const incident = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                <span className="sr-only">{t("incidents.openActionsMenu")}</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/incidents/${incident.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  {t("common.view")}
                </Link>
              </DropdownMenuItem>
              {canDelete ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(incident)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("incidents.deleteIncident")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
