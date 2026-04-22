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
import { customersAPI, type Customer } from "@/lib/frontend/api-client";
import { cn } from "@/lib/utils";

export function CustomerMultiSelect({
  organizationId,
  value,
  onChange,
  disabled,
}: {
  organizationId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await customersAPI.list(organizationId);
        if (!cancelled) {
          const list = Array.isArray(res.data)
            ? res.data
            : (res.data as { customers: Customer[] }).customers ?? [];
          setCustomers(list);
        }
      } catch {
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

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
                  ? t("fuelReports.filters.companiesPlaceholder")
                  : t("fuelReports.filters.companiesSelectedCount", { count: value.length })}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("fuelReports.filters.companiesSearch")} />
            <CommandList>
              <CommandEmpty>{t("common.noResults")}</CommandEmpty>
              <CommandGroup>
                {customers.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${c.id}`}
                    onSelect={() => toggle(c.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4 shrink-0",
                        value.includes(c.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{c.name}</span>
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
            const c = byId.get(id);
            const label = c?.name ?? id;
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
