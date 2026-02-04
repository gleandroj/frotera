import type { Metadata } from "next";
import { getServerTranslation } from "@/lib/i18n-server";
import NotificationsClientLayout from './client-layout';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: t("pageTitle.notifications"),
    description: "View and manage your notifications",
  };
}

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <NotificationsClientLayout>{children}</NotificationsClientLayout>;
}
