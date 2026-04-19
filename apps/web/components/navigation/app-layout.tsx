"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type React from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  fullscreen?: boolean;
}

export function AppLayout({ children, breadcrumbs = [], fullscreen = false }: AppLayoutProps) {
  return (
    <RequireAuth>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden">
          <AppHeader breadcrumbs={breadcrumbs} />
          <div className={fullscreen ? "flex flex-1 overflow-hidden" : "flex flex-1 flex-col gap-4 p-4 pt-2 overflow-y-auto"}>
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RequireAuth>
  );
}
