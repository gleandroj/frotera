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
import { useTranslation } from "@/i18n/useTranslation";

interface FuelColumnsProps {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function getFuelColumns(props: FuelColumnsProps): ColumnDef<FuelLog>[] {
  const { t } = useTranslation();

  const fuelTypeLabels: Record<FuelType, string> = {
    GASOLINE: t('fuel.fuelTypes.GASOLINE'),
    ETHANOL: t('fuel.fuelTypes.ETHANOL'),
    DIESEL: t('fuel.fuelTypes.DIESEL'),
    ELECTRIC: t('fuel.fuelTypes.ELECTRIC'),
    GNV: t('fuel.fuelTypes.GNV'),
  };

  return [
    {
      accessorKey: "date",
      header: t('fuel.fields.date'),
      cell: ({ row }) => {
        const date = new Date(row.getValue("date"));
        return date.toLocaleDateString('pt-BR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    },
    {
      accessorKey: "vehicle",
      header: t('fuel.fields.vehicle'),
      cell: ({ row }) => {
        const vehicle = row.original.vehicle;
        return vehicle
          ? `${vehicle.name || 'N/A'} (${vehicle.plate || 'N/A'})`
          : 'N/A';
      },
    },
    {
      accessorKey: "fuelType",
      header: t('fuel.fields.fuelType'),
      cell: ({ row }) => {
        const fuelType = row.getValue("fuelType") as FuelType;
        return fuelTypeLabels[fuelType] || fuelType;
      },
    },
    {
      accessorKey: "liters",
      header: t('fuel.fields.liters'),
      cell: ({ row }) => {
        const liters = row.getValue("liters") as number;
        return liters.toFixed(2);
      },
    },
    {
      accessorKey: "totalCost",
      header: t('fuel.fields.totalCost'),
      cell: ({ row }) => {
        const totalCost = row.getValue("totalCost") as number;
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(totalCost);
      },
    },
    {
      accessorKey: "consumption",
      header: t('fuel.fields.consumption'),
      cell: ({ row }) => {
        const consumption = row.getValue("consumption") as number | null;
        return consumption ? `${consumption.toFixed(2)} km/l` : '—';
      },
    },
    {
      accessorKey: "station",
      header: t('fuel.fields.station'),
      cell: ({ row }) => row.getValue("station") || '—',
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t('fuel.openActionsMenu')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => props.onEdit(row.original.id)}
              >
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => props.onDelete(row.original.id)}
                className="text-red-600"
              >
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
