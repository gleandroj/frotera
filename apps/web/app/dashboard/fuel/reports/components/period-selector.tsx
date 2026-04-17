"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/useTranslation";
import { format } from "date-fns";
import { dateFnsLocaleFor } from "@/lib/date-fns-locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

type Period = "day" | "month" | "year";

interface Props {
  period: Period;
  date: Date;
  onPeriodChange: (p: Period) => void;
  onDateChange: (d: Date) => void;
}

export function PeriodSelector({ period, date, onPeriodChange, onDateChange }: Props) {
  const { t, currentLanguage } = useTranslation();
  const [open, setOpen] = useState(false);

  const periods: Period[] = ["day", "month", "year"];
  const locale = dateFnsLocaleFor(currentLanguage);

  const formatDate = (d: Date) => {
    if (period === "day") return format(d, "P", { locale });
    if (period === "month") return format(d, "MMMM yyyy", { locale });
    return format(d, "yyyy");
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex rounded-md border">
        {periods.map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "ghost"}
            size="sm"
            className="rounded-none first:rounded-l-md last:rounded-r-md"
            onClick={() => onPeriodChange(p)}
          >
            {t(`fuelReports.summary.period.${p}`)}
          </Button>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            {formatDate(date)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => { if (d) { onDateChange(d); setOpen(false); } }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
