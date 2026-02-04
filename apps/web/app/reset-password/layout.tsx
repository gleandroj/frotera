import { getServerTranslation } from "@/lib/i18n-server";
import { Metadata } from "next";
import { Suspense } from "react";


export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: t("pageTitle.resetPassword"),
    description:
      "Create a new password for your account",
  };
}

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense>{children}</Suspense>;
}
