"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { AppLayout, type BreadcrumbItem } from "@/components/navigation/app-layout";

function getBreadcrumbsForPathname(pathname: string | null): BreadcrumbItem[] {
  if (!pathname) return [];
  if (pathname === "/dashboard/vehicles") {
    return [{ label: "navigation.items.vehicles" }];
  }
  const vehicleDetailMatch = pathname.match(/^\/dashboard\/vehicles\/([^/]+)$/);
  if (vehicleDetailMatch) {
    return [
      { label: "navigation.items.vehicles", href: "/dashboard/vehicles" },
      { label: "vehicles.viewVehicle" },
    ];
  }
  if (pathname === "/dashboard/customers") {
    return [{ label: "navigation.items.customers" }];
  }
  if (pathname.startsWith("/dashboard/tracking")) {
    return [{ label: "navigation.items.tracking" }];
  }
  if (pathname === "/dashboard/settings/company") {
    return [{ label: "navigation.items.companyFleetSettings" }];
  }
  return [];
}

const FULLSCREEN_PATHS = ["/dashboard/tracking"];

export function DashboardBreadcrumbsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const breadcrumbs = useMemo(
    () => getBreadcrumbsForPathname(pathname),
    [pathname]
  );
  const fullscreen = FULLSCREEN_PATHS.some((p) => pathname?.startsWith(p));
  return <AppLayout breadcrumbs={breadcrumbs} fullscreen={fullscreen}>{children}</AppLayout>;
}
