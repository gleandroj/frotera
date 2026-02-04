import { getServerTranslation } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { Suspense } from "react";
import OrganizationsClientLayout from "./client-layout";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: t("pageTitle.organizations"),
    description: "Manage your organization settings, members, and preferences.",
  };
}

export default function OrganizationSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    return <OrganizationsClientLayout>
    <Suspense>{children}</Suspense>
  </OrganizationsClientLayout>;
}
