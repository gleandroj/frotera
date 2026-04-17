"use client";

import { cn } from "@/lib/utils";

/**
 * Escurece só o painel do sheet/dialog pai quando um drawer empilhado está aberto
 * (não cobre a viewport inteira — isso continua com o overlay do fluxo principal).
 */
export function DrawerStackParentDim({
  show,
  className,
}: {
  show: boolean;
  className?: string;
}) {
  if (!show) return null;
  return (
    <div
      className={cn(
        "pointer-events-auto absolute inset-[-1px] z-40 bg-black/45 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] backdrop-blur-[0.6px] dark:bg-black/70 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
        className
      )}
      aria-hidden
    />
  );
}
