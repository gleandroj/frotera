"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreVertical, Pencil, Trash2, Eye } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Vehicle } from "@/lib/frontend/api-client";

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export interface VehicleColumnsOptions {
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
}

export function getVehicleColumns(
  t: TFunction,
  options: VehicleColumnsOptions,
): ColumnDef<Vehicle>[] {
  const { onEdit, onDelete } = options;

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
        <span>{row.original.name ?? t("common.notAvailable")}</span>
      ),
    },
    {
      accessorKey: "plate",
      meta: { labelKey: "vehicles.plate" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("vehicles.plate")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.plate ?? "—"}</span>
      ),
    },
    {
      id: "customer",
      accessorFn: (row) => row.customer?.name ?? "",
      meta: { labelKey: "vehicles.customer" },
      header: t("vehicles.customer"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.customer?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "device",
      accessorFn: (row) =>
        row.trackerDevice
          ? `${row.trackerDevice.imei} ${row.trackerDevice.model}`
          : "",
      meta: { labelKey: "vehicles.device" },
      header: t("vehicles.device"),
      cell: ({ row }) => {
        const device = row.original.trackerDevice;
        if (!device) {
          return (
            <span className="text-muted-foreground">
              {t("vehicles.noDevice")}
            </span>
          );
        }
        return (
          <span className="font-mono text-xs">
            {device.imei}
            <span className="text-muted-foreground ml-1">
              ({device.model})
            </span>
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => (
        <div className="text-right">{t("common.actions")}</div>
      ),
      cell: ({ row }) => {
        const vehicle = row.original;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("vehicles.openActionsMenu")}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/vehicles/${vehicle.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    {t("common.view")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(vehicle)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(vehicle)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("common.delete")}
                </DropdownMenuItem>
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
