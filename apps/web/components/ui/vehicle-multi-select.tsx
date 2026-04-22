"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/i18n/useTranslation";
import { vehiclesAPI, type Vehicle } from "@/lib/frontend/api-client";
import { cn } from "@/lib/utils";

export function VehicleMultiSelect({
  organizationId,
  customerIds,
  value,
  onChange,
  disabled,
}: {
  organizationId: string;
  customerIds?: string[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        // If multiple customer IDs, fetch for each and merge
        if (customerIds && customerIds.length > 0) {
          const results = await Promise.all(
            customerIds.map((cId) =>
              vehiclesAPI.list(organizationId, { customerId: cId }).catch(() => ({ data: [] as Vehicle[] })),
            ),
          );
          if (!cancelled) {
            const merged = results.flatMap((r) => (Array.isArray(r.data) ? r.data : []));
            const unique = Array.from(new Map(merged.map((v) => [v.id, v])).values());
            setVehicles(unique);
          }
        } else {
          const res = await vehiclesAPI.list(organizationId);
          if (!cancelled) {
            setVehicles(Array.isArray(res.data) ? res.data : []);
          }
        }
      } catch {
        if (!cancelled) setVehicles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, JSON.stringify(customerIds)]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const remove = (id: string) => {
    onChange(value.filter((x) => x !== id));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-9 w-full justify-between py-2 font-normal"
            disabled={disabled || loading}
          >
            <span className="truncate text-left">
              {loading
                ? t("common.loading")
                : value.length === 0
                  ? t("fuelReports.filters.vehiclesPlaceholder")
                  : t("fuelReports.filters.vehiclesSelectedCount", { count: value.length })}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("fuelReports.filters.vehiclesSearch")} />
            <CommandList>
              <CommandEmpty>{t("common.noResults")}</CommandEmpty>
              <CommandGroup>
                {vehicles.map((v) => (
                  <CommandItem
                    key={v.id}
                    value={`${v.plate ?? ""} ${v.name ?? ""} ${v.id}`}
                    onSelect={() => toggle(v.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4 shrink-0",
                        value.includes(v.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">
                      {[v.plate, v.name].filter(Boolean).join(" · ") || v.id}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => {
            const v = byId.get(id);
            const label =
              v != null ? [v.plate, v.name].filter(Boolean).join(" · ") || v.id : id;
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                <span className="max-w-[200px] truncate">{label}</span>
                {!disabled && (
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-muted"
                    aria-label={t("common.remove")}
                    onClick={() => remove(id)}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
