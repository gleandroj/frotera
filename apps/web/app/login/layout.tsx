import { getServerTranslation } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: t("pageTitle.login"),
    description: "Entre na sua conta RS Frotas para gerenciar sua frota com inteligência artificial, rastrear veículos em tempo real e otimizar sua operação logística.",
  };
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense>{children}</Suspense>;
}
