"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreVertical, Pencil, Trash2, Eye, Link2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Driver } from "@/lib/frontend/api-client";

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export interface DriverColumnsOptions {
  onEdit: (driver: Driver) => void;
  onDelete: (driver: Driver) => void;
  onAssignVehicle?: (driver: Driver) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canAssignVehicle?: boolean;
}

export function getDriverColumns(
  t: TFunction,
  options: DriverColumnsOptions,
): ColumnDef<Driver>[] {
  const {
    onEdit,
    onDelete,
    onAssignVehicle,
    canEdit = true,
    canDelete = true,
    canAssignVehicle = false,
  } = options;

  return [
    {
      accessorKey: "name",
      meta: { labelKey: "common.name" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("common.name")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "cpf",
      meta: { labelKey: "drivers.cpf" },
      header: t("drivers.cpf"),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.cpf ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "cnhCategory",
      meta: { labelKey: "drivers.cnhCategory" },
      header: t("drivers.cnhCategory"),
      cell: ({ row }) => (
        <span>{row.original.cnhCategory ?? "—"}</span>
      ),
    },
    {
      id: "customer",
      accessorFn: (row) => row.customer?.name ?? "",
      meta: { labelKey: "drivers.customer" },
      header: t("drivers.customer"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.customer?.name ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "active",
      meta: { labelKey: "common.status" },
      header: t("common.status"),
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "default" : "secondary"}>
          {row.original.active ? t("common.active") : t("common.inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">{t("common.actions")}</div>,
      cell: ({ row }) => {
        const driver = row.original;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("drivers.openActionsMenu")}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/drivers/${driver.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    {t("common.view")}
                  </Link>
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem onClick={() => onEdit(driver)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("common.edit")}
                  </DropdownMenuItem>
                )}
                {canAssignVehicle && onAssignVehicle && driver.active && (
                  <DropdownMenuItem onClick={() => onAssignVehicle(driver)}>
                    <Link2 className="mr-2 h-4 w-4" />
                    {t("drivers.assignVehicle")}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(driver)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("common.delete")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
