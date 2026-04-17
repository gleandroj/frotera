import {
  endOfDay,
  endOfMonth,
  endOfYear,
  parse,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
} from "date-fns";

export type FuelDatePresetKey = "today" | "yesterday" | "thisMonth" | "thisYear" | "custom";

export function rangeForFuelPreset(
  preset: FuelDatePresetKey,
  customFrom: string,
  customTo: string,
  now = new Date(),
): { from: Date; to: Date } {
  if (preset === "custom") {
    let from = startOfMonth(now);
    let to = endOfMonth(now);
    if (customFrom) {
      const d = parse(customFrom, "yyyy-MM-dd", now);
      if (!Number.isNaN(d.getTime())) from = startOfDay(d);
    }
    if (customTo) {
      const d = parse(customTo, "yyyy-MM-dd", now);
      if (!Number.isNaN(d.getTime())) to = endOfDay(d);
    }
    if (from.getTime() > to.getTime()) {
      return { from: startOfDay(to), to: endOfDay(from) };
    }
    return { from, to };
  }
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const d = subDays(startOfDay(now), 1);
      return { from: d, to: endOfDay(d) };
    }
    case "thisMonth":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "thisYear":
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}
