import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(
  date: string | number | Date | null | undefined
): string {
  if (!date) return "";
  let d: Date;
  if (typeof date === "string") {
    d = isNaN(Date.parse(date)) ? new Date(Number(date)) : parseISO(date);
  } else if (typeof date === "number") {
    d = new Date(date);
  } else {
    d = date;
  }
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 2) return "now";
  if (diffSec < 20) return diffSec + "s";
  if (diffSec < 60) return "1m";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}
