import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/hooks/use-auth";
import { getServerTranslation } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type React from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslation();

  return {
    title: {
      template: "%s | Frotera",
      default: t("pageTitle.default"),
    },
    description:
      "Sistema de rastreamento e gestão inteligente de frotas impulsionado por IA. Monitore seus veículos em tempo real, otimize rotas e reduza custos operacionais.",
    keywords: [
      "rastreamento de frotas",
      "gestão de frotas",
      "GPS",
      "veículos",
      "logística",
      "IA",
      "telemetria",
    ],
    authors: [{ name: "Frotera Team" }],
    creator: "Frotera",
    publisher: "Frotera",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Frotera",
      startupImage: "/icons/apple-touch-icon.png",
    },
    icons: {
      icon: [
        { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
    other: {
      "mobile-web-app-capable": "yes",
    },
  };
}

export default async function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = await getServerTranslation();
  return (
    <html suppressHydrationWarning lang={locale}>
      <body suppressHydrationWarning className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster position="bottom-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
