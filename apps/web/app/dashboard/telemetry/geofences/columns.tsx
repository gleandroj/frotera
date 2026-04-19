"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GeofenceZone } from "@/lib/frontend/api-client";

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export interface GeofenceColumnsOptions {
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (zone: GeofenceZone) => void;
  onDelete: (zone: GeofenceZone) => void;
}

export function getGeofenceColumns(
  t: TFunction,
  options: GeofenceColumnsOptions,
): ColumnDef<GeofenceZone>[] {
  const { canEdit, canDelete, onEdit, onDelete } = options;

  return [
    {
      accessorKey: "name",
      meta: { labelKey: "telemetry.geofences.columns.name" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("telemetry.geofences.columns.name")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      id: "company",
      accessorFn: (row) => row.customerName?.trim() ?? "",
      meta: { labelKey: "telemetry.geofences.columns.company" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("telemetry.geofences.columns.company")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.customerName?.trim() || "—"}
        </span>
      ),
    },
    {
      accessorKey: "type",
      meta: { labelKey: "telemetry.geofences.columns.type" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("telemetry.geofences.columns.type")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const typ = row.original.type;
        return typ === "CIRCLE"
          ? t("telemetry.geofences.form.typeCircle")
          : typ === "POLYGON"
            ? t("telemetry.geofences.form.typePolygon")
            : typ;
      },
    },
    {
      accessorKey: "active",
      meta: { labelKey: "telemetry.geofences.columns.status" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("telemetry.geofences.columns.status")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) =>
        row.original.active ? t("common.yes") : t("common.no"),
    },
    {
      accessorKey: "alertOnEnter",
      meta: { labelKey: "telemetry.geofences.columns.alertOnEnter" },
      header: t("telemetry.geofences.columns.alertOnEnter"),
      cell: ({ row }) =>
        row.original.alertOnEnter ? t("common.yes") : t("common.no"),
    },
    {
      accessorKey: "alertOnExit",
      meta: { labelKey: "telemetry.geofences.columns.alertOnExit" },
      header: t("telemetry.geofences.columns.alertOnExit"),
      cell: ({ row }) =>
        row.original.alertOnExit ? t("common.yes") : t("common.no"),
    },
    {
      id: "actions",
      header: () => (
        <div className="text-right">{t("telemetry.geofences.columns.actions")}</div>
      ),
      cell: ({ row }) => {
        const z = row.original;
        return (
          <div className="space-x-2 text-right">
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={() => onEdit(z)}>
                {t("telemetry.geofences.editZone")}
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="destructive" onClick={() => onDelete(z)}>
                {t("telemetry.geofences.deleteZone")}
              </Button>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
