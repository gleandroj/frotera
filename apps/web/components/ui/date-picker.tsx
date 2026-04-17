"use client";

import * as React from "react";
import { format, parse, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
}

/** `value` / `onChange` use `yyyy-MM-dd` (same as native `input type="date"`). */
export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
}: DatePickerProps) {
  const { t, currentLanguage } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const locale = dateFnsLocaleFor(currentLanguage);
  const selected = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return Number.isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full min-w-0 justify-start gap-2 text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate sm:overflow-visible sm:whitespace-normal sm:text-clip">
            {selected
              ? format(selected, "P", { locale })
              : placeholder ?? t("common.calendar.pickDate")}
          </span>
        </Button>
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
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-stretch", className)}>
      <DatePicker
        value={datePart}
        onChange={(d) => setParts(d, timePart)}
        disabled={disabled}
        className="min-w-0 w-full flex-1 sm:min-w-[min(100%,17rem)]"
      />
      <div className="flex w-full shrink-0 items-center gap-2 sm:w-44">
        <span className="text-muted-foreground whitespace-nowrap text-sm sm:sr-only">
          {t("common.calendar.time")}
        </span>
        <Input
          type="time"
          step={60}
          value={timePart}
          onChange={(e) => setParts(datePart || format(new Date(), "yyyy-MM-dd"), e.target.value)}
          disabled={disabled}
          className="h-10"
          aria-label={t("common.calendar.time")}
        />
      </div>
    </div>
  );
}
