import { getServerTranslation } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: t("pageTitle.signup"),
    description: "Crie sua conta Rotera para começar a rastrear e gerenciar sua frota com tecnologia de ponta, reduza custos e aumente a eficiência operacional.",
  };
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense>{children}</Suspense>;
}
