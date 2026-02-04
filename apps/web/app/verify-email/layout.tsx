import { getServerTranslation } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: t("pageTitle.verifyEmail"),
    description: "Verify your email address to complete your account setup.",
  };
}

export default function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense>{children}</Suspense>;
}
