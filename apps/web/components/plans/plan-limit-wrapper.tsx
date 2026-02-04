"use client";

import React from "react";

interface PlanLimitWrapperProps {
  resourceType?: string;
  onAction?: () => void;
  children: React.ReactNode;
}

/**
 * A wrapper component for plan-limited features.
 * Currently passes through children without restrictions.
 * TODO: Implement actual plan limit checking logic.
 */
export function PlanLimitWrapper({
  resourceType,
  onAction,
  children
}: PlanLimitWrapperProps) {
  return <>{children}</>;
}
