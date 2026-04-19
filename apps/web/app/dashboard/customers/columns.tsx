"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Ban, MoreVertical, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Customer } from "@/lib/frontend/api-client";

const indentPx = 24;

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export interface CustomerColumnsOptions {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  canEditCustomer: boolean;
  canDeleteCustomer: boolean;
  isSuperAdmin: boolean;
}

function getParentName(customers: Customer[], parentId: string | null | undefined): string {
  if (!parentId) return "—";
  const parent = customers.find((c) => c.id === parentId);
  return parent?.name ?? '';
}

export function getCustomerColumns(
  t: TFunction,
  options: CustomerColumnsOptions,
): ColumnDef<Customer>[] {
  const {
    customers,
    onEdit,
    onDelete,
    canEditCustomer,
    canDeleteCustomer,
    isSuperAdmin,
  } = options;

  const columns: ColumnDef<Customer>[] = [
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
      cell: ({ row }) => {
        const c = row.original;
        const depth = c.depth ?? 0;
        return (
          <div
            className="flex items-center gap-1 min-w-0"
            style={{ paddingLeft: depth * indentPx }}
          >
            {depth > 0 && (
              <span
                className="shrink-0 text-muted-foreground/60 select-none text-xs"
                aria-hidden
              >
                └
              </span>
            )}
            <span
              className={`font-medium truncate text-sm ${c.inactive ? "text-muted-foreground" : ""}`}
            >
              {c.name}
            </span>
            {c.inactive ? (
              <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                {t("customers.inactiveBadge")}
              </Badge>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "parent",
      accessorFn: (row) => getParentName(customers, row.parentId),
      meta: { labelKey: "customers.parent" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("customers.parent")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {getParentName(customers, row.original.parentId)}
        </span>
      ),
    },
  ];

  if (canEditCustomer || canDeleteCustomer) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">{t("common.actions")}</div>,
      cell: ({ row }) => {
        const customer = row.original;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("common.actions")}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEditCustomer && (
                  <DropdownMenuItem onClick={() => onEdit(customer)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("common.edit")}
                  </DropdownMenuItem>
                )}
                {canDeleteCustomer &&
                  !customer.inactive &&
                  (isSuperAdmin || customer.parentId != null) && (
                  <DropdownMenuItem
                    onClick={() => onDelete(customer)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    {t("common.deactivate")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    });
  }

  return columns;
}
