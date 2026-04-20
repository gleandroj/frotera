import { ColumnDef } from "@tanstack/react-table";
import { FuelLog, FuelType } from "@/lib/frontend/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import {
  formatLocaleCurrency,
  formatLocaleDecimal,
} from "@/lib/locale-decimal";

interface FuelColumnsProps {
  onEdit: (log: FuelLog) => void;
  onDelete: (log: FuelLog) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  intlLocale: string;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function getFuelColumns(props: FuelColumnsProps): ColumnDef<FuelLog>[] {
  const { t, intlLocale, canEdit = true, canDelete = true } = props;

  const fuelTypeLabels: Record<FuelType, string> = {
    GASOLINE: t("fuel.fuelTypes.GASOLINE"),
    ETHANOL: t("fuel.fuelTypes.ETHANOL"),
    DIESEL: t("fuel.fuelTypes.DIESEL"),
    ELECTRIC: t("fuel.fuelTypes.ELECTRIC"),
    GNV: t("fuel.fuelTypes.GNV"),
  };

  return [
    {
      accessorKey: "date",
      meta: { labelKey: "fuel.fields.date" },
      header: t("fuel.fields.date"),
      cell: ({ row }) => {
        const date = new Date(row.getValue("date"));
        return (
          <span className="whitespace-nowrap">
            {date.toLocaleDateString(intlLocale, {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        );
      },
    },
    {
      accessorKey: "vehicle",
      meta: { labelKey: "fuel.fields.vehicle" },
      header: t("fuel.fields.vehicle"),
      cell: ({ row }) => {
        const vehicle = row.original.vehicle;
        const plate = vehicle?.plate?.trim();
        return (
          <span className="block max-w-[7.5rem] truncate font-medium tabular-nums sm:max-w-none">
            {plate || "—"}
          </span>
        );
      },
    },
    {
      id: "customer",
      accessorFn: (row) => row.vehicle?.customer?.name ?? "",
      meta: { labelKey: "fuel.fields.customer" },
      header: t("fuel.fields.customer"),
      cell: ({ row }) => (
        <span className="block max-w-[10rem] truncate text-muted-foreground sm:max-w-[14rem]">
          {row.original.vehicle?.customer?.name ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "odometer",
      meta: { labelKey: "fuel.fields.odometer" },
      header: t("fuel.fields.odometer"),
      cell: ({ row }) => {
        const km = row.getValue("odometer") as number;
        return (
          <span className="whitespace-nowrap tabular-nums">
            {formatLocaleDecimal(km, intlLocale, {
              minFractionDigits: 0,
              maxFractionDigits: 0,
            })}
          </span>
        );
      },
    },
    {
      id: "driver",
      meta: { labelKey: "fuel.fields.driver" },
      header: t("fuel.fields.driver"),
      cell: ({ row }) => {
        const d = row.original.driver;
        return (
          <span className="block max-w-[8rem] truncate sm:max-w-[12rem]">{d?.name ?? "—"}</span>
        );
      },
    },
    {
      accessorKey: "fuelType",
      meta: { labelKey: "fuel.fields.fuelType" },
      header: t("fuel.fields.fuelType"),
      cell: ({ row }) => {
        const fuelType = row.getValue("fuelType") as FuelType;
        return (
          <span className="whitespace-nowrap">{fuelTypeLabels[fuelType] || fuelType}</span>
        );
      },
    },
    {
      accessorKey: "liters",
      meta: { labelKey: "fuel.fields.liters" },
      header: t("fuel.fields.liters"),
      cell: ({ row }) => {
        const liters = row.getValue("liters") as number;
        return (
          <span className="whitespace-nowrap tabular-nums">
            {formatLocaleDecimal(liters, intlLocale, {
              minFractionDigits: 2,
              maxFractionDigits: 3,
            })}
          </span>
        );
      },
    },
    {
      accessorKey: "totalCost",
      meta: { labelKey: "fuel.fields.totalCost" },
      header: t("fuel.fields.totalCost"),
      cell: ({ row }) => {
        const totalCost = row.getValue("totalCost") as number;
        return (
          <span className="whitespace-nowrap tabular-nums">
            {formatLocaleCurrency(totalCost, intlLocale, "BRL")}
          </span>
        );
      },
    },
    {
      accessorKey: "consumption",
      meta: { labelKey: "fuel.fields.consumption" },
      header: t("fuel.fields.consumption"),
      cell: ({ row }) => {
        const consumption = row.getValue("consumption") as number | null;
        return consumption ? (
          <span className="whitespace-nowrap tabular-nums">
            {`${formatLocaleDecimal(consumption, intlLocale, {
              minFractionDigits: 2,
              maxFractionDigits: 2,
            })} km/l`}
          </span>
        ) : (
          "—"
        );
      },
    },
    {
      id: "station",
      accessorFn: (row) => row.station ?? "",
      meta: { labelKey: "fuel.fields.station" },
      header: t("fuel.fields.station"),
      cell: ({ row }) => (
        <span className="block max-w-[10rem] truncate sm:max-w-[16rem]">
          {row.original.station?.trim() || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        if (!canEdit && !canDelete) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t("fuel.openActionsMenu")}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canEdit && (
                <DropdownMenuItem onClick={() => props.onEdit(row.original)}>
                  {t("common.edit")}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => props.onDelete(row.original)}
                  className="text-red-600"
                >
                  {t("common.delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
