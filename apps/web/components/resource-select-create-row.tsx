"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ResourceSelectCreateRowProps {
  children: React.ReactNode;
  onCreateClick: () => void;
  createLabel: string;
  showCreate?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ResourceSelectCreateRow({
  children,
  onCreateClick,
  createLabel,
  showCreate = true,
  disabled,
  className,
}: ResourceSelectCreateRowProps) {
  if (!showCreate) {
    return <div className={cn("w-full min-w-0", className)}>{children}</div>;
  }

  return (
    <div className={cn("flex w-full min-w-0 gap-2 items-start", className)}>
      <div className="min-w-0 flex-1 w-full">{children}</div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 shrink-0 px-2 sm:px-3"
        onClick={onCreateClick}
        disabled={disabled}
        aria-label={createLabel}
      >
        <Plus className="h-4 w-4 sm:mr-1" aria-hidden />
        <span className="hidden sm:inline">{createLabel}</span>
      </Button>
    </div>
  );
}
