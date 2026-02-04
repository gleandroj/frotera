import { getServerTranslation } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { AppLayout } from "@/components/navigation/app-layout";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: t("pageTitle.dashboard"),
    description:
      "Manage your fleet with intelligence, track vehicles in real time and optimize your logistic operation.",
  };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
