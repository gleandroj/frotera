"use client";

import { AppLayout } from "@/components/navigation/app-layout";

export default function TrackerDiscoveriesClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const breadcrumbs = [
    { label: "navigation.settings", href: "/settings/tracker-discoveries" },
    { label: "navigation.items.trackerDiscoveries" },
  ];

  return <AppLayout breadcrumbs={breadcrumbs}>{children}</AppLayout>;
}
