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
}

export function getFuelColumns(props: FuelColumnsProps): ColumnDef<FuelLog>[] {
  const { t, intlLocale } = props;

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
        return date.toLocaleDateString(intlLocale, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    },
    {
      accessorKey: "vehicle",
      meta: { labelKey: "fuel.fields.vehicle" },
      header: t("fuel.fields.vehicle"),
      cell: ({ row }) => {
        const vehicle = row.original.vehicle;
        return vehicle ? `${vehicle.name || "N/A"} (${vehicle.plate || "N/A"})` : "N/A";
      },
    },
    {
      id: "customer",
      accessorFn: (row) => row.vehicle?.customer?.name ?? "",
      meta: { labelKey: "fuel.fields.customer" },
      header: t("fuel.fields.customer"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
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
        return formatLocaleDecimal(km, intlLocale, {
          minFractionDigits: 0,
          maxFractionDigits: 0,
        });
      },
    },
    {
      id: "driver",
      meta: { labelKey: "fuel.fields.driver" },
      header: t("fuel.fields.driver"),
      cell: ({ row }) => {
        const d = row.original.driver;
        return d?.name ?? "—";
      },
    },
    {
      accessorKey: "fuelType",
      meta: { labelKey: "fuel.fields.fuelType" },
      header: t("fuel.fields.fuelType"),
      cell: ({ row }) => {
        const fuelType = row.getValue("fuelType") as FuelType;
        return fuelTypeLabels[fuelType] || fuelType;
      },
    },
    {
      accessorKey: "liters",
      meta: { labelKey: "fuel.fields.liters" },
      header: t("fuel.fields.liters"),
      cell: ({ row }) => {
        const liters = row.getValue("liters") as number;
        return formatLocaleDecimal(liters, intlLocale, {
          minFractionDigits: 2,
          maxFractionDigits: 3,
        });
      },
    },
    {
      accessorKey: "totalCost",
      meta: { labelKey: "fuel.fields.totalCost" },
      header: t("fuel.fields.totalCost"),
      cell: ({ row }) => {
        const totalCost = row.getValue("totalCost") as number;
        return formatLocaleCurrency(totalCost, intlLocale, "BRL");
      },
    },
    {
      accessorKey: "consumption",
      meta: { labelKey: "fuel.fields.consumption" },
      header: t("fuel.fields.consumption"),
      cell: ({ row }) => {
        const consumption = row.getValue("consumption") as number | null;
        return consumption
          ? `${formatLocaleDecimal(consumption, intlLocale, {
              minFractionDigits: 2,
              maxFractionDigits: 2,
            })} km/l`
          : "—";
      },
    },
    {
      accessorKey: "station",
      meta: { labelKey: "fuel.fields.station" },
      header: t("fuel.fields.station"),
      cell: ({ row }) => row.getValue("station") || "—",
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
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
            <DropdownMenuItem onClick={() => props.onEdit(row.original)}>
              {t("common.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => props.onDelete(row.original)}
              className="text-red-600"
            >
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
