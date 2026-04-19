"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/i18n/useTranslation";

type ActiveOnlyFilterProps = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  id?: string;
};

export function ActiveOnlyFilter({
  checked,
  onCheckedChange,
  id = "list-filter-active-only",
}: ActiveOnlyFilterProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={t("common.activeOnly")}
      />
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
        {t("common.activeOnly")}
      </Label>
    </div>
  );
}
