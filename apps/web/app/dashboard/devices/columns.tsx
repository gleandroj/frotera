"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Device {
  id: string;
  organizationId: string;
  imei: string;
  model: string;
  name?: string | null;
  vehicleId?: string | null;
  createdAt: string;
  updatedAt: string;
}

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export interface DeviceColumnsOptions {
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  canEditDevice?: boolean;
  canDeleteDevice?: boolean;
}

export function getDeviceColumns(
  t: TFunction,
  options: DeviceColumnsOptions,
): ColumnDef<Device>[] {
  const { onEdit, onDelete, canEditDevice = true, canDeleteDevice = true } =
    options;

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
      accessorKey: "imei",
      meta: { labelKey: "devices.imei" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("devices.imei")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.imei}</span>
      ),
    },
    {
      accessorKey: "model",
      meta: { labelKey: "devices.model" },
      header: t("devices.model"),
      cell: ({ row }) => <span>{row.original.model}</span>,
    },
    {
      id: "actions",
      header: () => (
        <div className="text-right">{t("common.actions")}</div>
      ),
      cell: ({ row }) => {
        const device = row.original;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("devices.openActionsMenu")}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEditDevice && (
                  <DropdownMenuItem onClick={() => onEdit(device)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("common.edit")}
                  </DropdownMenuItem>
                )}
                {canDeleteDevice && (
                  <DropdownMenuItem
                    onClick={() => onDelete(device)}
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
