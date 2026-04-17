"use client";

import * as React from "react";
import { format, parse, parseISO } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useTranslation } from "@/i18n/useTranslation";
import { dateFnsLocaleFor } from "@/lib/date-fns-locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Mostra um controlo para apagar a data sem abrir o calendário. */
  allowClear?: boolean;
}

/** `value` / `onChange` use `yyyy-MM-dd` (same as native `input type="date"`). */
export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
  allowClear,
}: DatePickerProps) {
  const { t, currentLanguage } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const locale = dateFnsLocaleFor(currentLanguage);
  const selected = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return Number.isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  const showClear = Boolean(allowClear && value && !disabled);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full min-w-0">
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full min-w-0 justify-start gap-2 text-left font-normal",
              showClear && "pr-9",
              !value && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate whitespace-nowrap">
              {selected
                ? format(selected, "P", { locale })
                : placeholder ?? t("common.calendar.pickDate")}
            </span>
          </Button>
          {showClear ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-sm p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={t("common.clear")}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
                setOpen(false);
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function splitDateTime(value: string): { date: string; time: string } {
  if (!value) {
    return { date: "", time: "00:00" };
  }
  const local = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(value);
  if (local) {
    return { date: local[1], time: local[2] };
  }
  try {
    const d = parseISO(value);
    if (Number.isNaN(d.getTime())) {
      return { date: "", time: "00:00" };
    }
    return {
      date: format(d, "yyyy-MM-dd"),
      time: format(d, "HH:mm"),
    };
  } catch {
    return { date: "", time: "00:00" };
  }
}

export interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Local `yyyy-MM-dd'T'HH:mm` (same shape as native `datetime-local`). */
export function DateTimePicker({
  value,
  onChange,
  disabled,
  className,
}: DateTimePickerProps) {
  const { t } = useTranslation();
  const { date: datePart, time: timePart } = splitDateTime(value);

  const setParts = (nextDate: string, nextTime: string) => {
    const d = nextDate || format(new Date(), "yyyy-MM-dd");
    const tm = nextTime && nextTime.length >= 5 ? nextTime.slice(0, 5) : "00:00";
    onChange(`${d}T${tm}`);
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch", className)}>
      <div className="w-full min-w-[13rem] flex-1 sm:min-w-[15rem]">
        <DatePicker
          value={datePart}
          onChange={(d) => setParts(d, timePart)}
          disabled={disabled}
          className="w-full"
        />
      </div>
      <div className="flex w-full min-w-0 shrink-0 items-center gap-2 sm:w-[9.5rem]">
        <span className="text-muted-foreground whitespace-nowrap text-sm sm:sr-only">
          {t("common.calendar.time")}
        </span>
        <Input
          type="time"
          step={60}
          value={timePart}
          onChange={(e) => setParts(datePart || format(new Date(), "yyyy-MM-dd"), e.target.value)}
          disabled={disabled}
          className="h-10 w-full min-w-0"
          aria-label={t("common.calendar.time")}
        />
      </div>
    </div>
  );
}
