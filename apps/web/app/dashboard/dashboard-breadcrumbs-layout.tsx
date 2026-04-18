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
  if (pathname === "/dashboard/settings/company") {
    return [{ label: "navigation.items.companyFleetSettings" }];
  }
  return [];
}

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
  return <AppLayout breadcrumbs={breadcrumbs}>{children}</AppLayout>;
}
