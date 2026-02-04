"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlanLimitWrapper } from "./plan-limit-wrapper";

interface PlanAwareCreateButtonProps {
  /** The type of resource being created */
  resourceType: 'team_members';
  /** The route to navigate to if within limits */
  createRoute: string;
  /** Button content */
  children: ReactNode;
  /** Button variant */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Custom onClick handler (overrides navigation) */
  onClick?: () => void | Promise<void>;
}

/**
 * A smart button component that checks plan limits before allowing creation actions.
 * Automatically handles navigation or shows upgrade dialog based on plan limits.
 */
export function PlanAwareCreateButton({
  resourceType,
  createRoute,
  children,
  variant = "default",
  size = "default",
  className,
  disabled = false,
  isLoading = false,
  onClick,
}: PlanAwareCreateButtonProps) {
  const router = useRouter();

  const handleAction = async () => {
    if (onClick) {
      await onClick();
    } else {
      router.push(createRoute);
    }
  };

  return (
    <PlanLimitWrapper
      resourceType={resourceType}
      onAction={handleAction}
      disabled={disabled}
      isLoading={isLoading}
    >
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || isLoading}
      >
        {children}
      </Button>
    </PlanLimitWrapper>
  );
}
