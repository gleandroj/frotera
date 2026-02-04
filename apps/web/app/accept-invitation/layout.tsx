import { getServerTranslation } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: t("pageTitle.acceptInvitation"),
    description: "Accept your team invitation to join an organization.",
  };
}

export default function AcceptInvitationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense>{children}</Suspense>;
}
