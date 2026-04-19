"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ListParams } from "@/lib/frontend/api-client";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/utils";

export const RECORD_STATUS_ALL = "all";
export const RECORD_STATUS_ACTIVE = "active";
export const RECORD_STATUS_INACTIVE = "inactive";

export type RecordListStatus =
  | typeof RECORD_STATUS_ALL
  | typeof RECORD_STATUS_ACTIVE
  | typeof RECORD_STATUS_INACTIVE;

type RecordStatusFilterProps = {
  value: RecordListStatus;
  onValueChange: (value: RecordListStatus) => void;
  id?: string;
  /** Extra classes on the trigger (default matches checklist / list toolbars). */
  triggerClassName?: string;
};

export function RecordStatusFilter({
  value,
  onValueChange,
  id = "record-list-status-filter",
  triggerClassName,
}: RecordStatusFilterProps) {
  const { t } = useTranslation();
  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as RecordListStatus)}
    >
      <SelectTrigger
        id={id}
        aria-label={t("common.listStatusFilterAria")}
        className={cn("w-48 shrink-0 sm:w-56", triggerClassName)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={RECORD_STATUS_ALL}>
          {t("common.listStatusAll")}
        </SelectItem>
        <SelectItem value={RECORD_STATUS_ACTIVE}>
          {t("common.listStatusActiveOnly")}
        </SelectItem>
        <SelectItem value={RECORD_STATUS_INACTIVE}>
          {t("common.listStatusInactiveOnly")}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Maps UI status to API list query params (`activeOnly` / `inactiveOnly`). */
export function listParamsForRecordStatus(
  status: RecordListStatus,
  customerId?: string | null,
): ListParams {
  const p: ListParams = {};
  if (customerId) p.customerId = customerId;
  if (status === RECORD_STATUS_ACTIVE) p.activeOnly = true;
  else if (status === RECORD_STATUS_INACTIVE) p.inactiveOnly = true;
  return p;
}
