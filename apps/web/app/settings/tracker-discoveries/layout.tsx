import { getServerTranslation } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { Suspense } from "react";
import TrackerDiscoveriesClientLayout from "./client-layout";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: t("pageTitle.trackerDiscoveries"),
    description: "List tracker devices that connected before registration.",
  };
}

export default function TrackerDiscoveriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TrackerDiscoveriesClientLayout>
      <Suspense>{children}</Suspense>
    </TrackerDiscoveriesClientLayout>
  );
}
