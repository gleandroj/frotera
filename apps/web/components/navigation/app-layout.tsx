"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type React from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
}

export function AppLayout({ children, breadcrumbs }: AppLayoutProps) {
  return (
    <RequireAuth>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden">
          <AppHeader breadcrumbs={breadcrumbs} />
          <div className="flex flex-1 flex-col gap-4 p-4 pt-2 overflow-y-auto">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RequireAuth>
  );
}
