"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/i18n/useTranslation";
import { referencePointsAPI, type ReferencePoint } from "@/lib/frontend/api-client";
import { cn } from "@/lib/utils";

export function ReferencePointMultiSelect({ organizationId, value, onChange, disabled }: {
  organizationId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReferencePoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await referencePointsAPI.list(organizationId, { activeOnly: true });
        if (!cancelled) setItems(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId]);

  const byId = useMemo(() => new Map(items.map((r) => [r.id, r])), [items]);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" className="h-auto min-h-9 w-full justify-between py-2 font-normal" disabled={disabled || loading}>
            <span className="truncate text-left">
              {loading ? t("common.loading") : value.length === 0 ? t("reports.referencePoints.filters.referencePointsPlaceholder") : t("reports.referencePoints.filters.referencePointsSelected", { count: value.length })}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("common.search")} />
            <CommandList>
              <CommandEmpty>{t("common.noResults")}</CommandEmpty>
              <CommandGroup>
                {items.map((r) => (
                  <CommandItem key={r.id} value={`${r.name} ${r.id}`} onSelect={() => toggle(r.id)}>
                    <Check className={cn("mr-2 size-4 shrink-0", value.includes(r.id) ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{r.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-[200px] truncate">{byId.get(id)?.name ?? id}</span>
              {!disabled && (
                <button type="button" className="rounded-sm p-0.5 hover:bg-muted" onClick={() => onChange(value.filter((x) => x !== id))}>
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
