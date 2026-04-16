import { getServerTranslation } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { Suspense } from "react";
import TeamClientLayout from "./client-layout";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: t("pageTitle.team"),
    description: "Manage users and their access to your organization.",
  };
}

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TeamClientLayout>
    <Suspense>{children}</Suspense>
  </TeamClientLayout>;
}