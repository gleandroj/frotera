import { getServerTranslation } from "@/lib/i18n-server";
import type { Metadata } from "next";
import ProfileClientLayout from "./client-layout";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: t("pageTitle.profile"),
    description: "Manage your personal profile information and preferences.",
  };
}

export default function ProfileSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProfileClientLayout>{children}</ProfileClientLayout>;
}
