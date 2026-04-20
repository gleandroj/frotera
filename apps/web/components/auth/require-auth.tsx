"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LoadingSpinner } from "../ui/loading-spinner";
import { useTranslation } from "@/i18n/useTranslation";

// Constants for route paths
const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  CHANGE_PASSWORD: "/change-password",
} as const;

// Loading spinner component for reuse
export const AuthLoadingSpinner = () => {
  const { t, isHydrated } = useTranslation();
  // suppressHydrationWarning is handled in LoadingSpinner component
  // to prevent hydration mismatch when server/client languages differ
  const loadingText = isHydrated ? t('loading.loadingConfiguration') : "";
  return <LoadingSpinner text={loadingText} />;
};

interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * RequireAuth is a wrapper component that ensures the user is authenticated
 * and has at least one organization before rendering its children.
 *
 * It handles:
 * - Authentication state checking
 * - Organization requirement checking
 * - Automatic redirection to login or organization creation
 * - Loading states
 *
 * @param {RequireAuthProps} props - Component props
 * @param {React.ReactNode} props.children - Child components to render when authenticated
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, isLoggingOut, organizations, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirectActioned = useRef(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (redirectActioned.current) return;

    const handleRedirect = (path: string) => {
      // Use requestAnimationFrame for smoother transitions
      requestAnimationFrame(() => {
        router.push(path);
      });
      redirectActioned.current = true;
    };

    if (!isLoading) {
      if (!isAuthenticated) {
        // Don't show toast if we're already on the login page or during logout
        if (pathname !== ROUTES.LOGIN && !isLoggingOut) {
          toast.error(t('auth.invalidCredentials'));
        }
        handleRedirect(ROUTES.LOGIN);
        return;
      }

      if (isAuthenticated && user?.mustChangePassword && pathname !== ROUTES.CHANGE_PASSWORD) {
        handleRedirect(ROUTES.CHANGE_PASSWORD);
        return;
      }

      if (isAuthenticated && (!organizations || organizations.length === 0)) {
        if (pathname !== ROUTES.DASHBOARD) {
          // Redirect to dashboard which will show the create organization modal
          handleRedirect(ROUTES.DASHBOARD);
          return;
        }
      }

      setIsChecking(false);
    }
  }, [isLoading, isAuthenticated, isLoggingOut, organizations, user, router, pathname]);

  if (isLoading || isChecking) {
    return <AuthLoadingSpinner />;
  }

  return <>{children}</>;
}
