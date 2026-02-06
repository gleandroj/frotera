"use client";

import React, { useCallback, useEffect, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcherLink } from "@/components/ui/language-switcher-link";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { CreateOrganizationDialog } from "@/components/organizations";
import { useAuth } from "@/lib/hooks/use-auth";
import { customersAPI, type Customer } from "@/lib/frontend/api-client";
import {
  Building,
  Building2,
  ChevronDown,
  LogOut,
  Plus,
  Shield,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n/useTranslation";

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

interface AppHeaderProps {
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
}

export function AppHeader({ breadcrumbs = [] }: AppHeaderProps) {
  const router = useRouter();
  const {
    user,
    organizations,
    currentOrganization,
    selectedCustomerId,
    setSelectedCustomerId,
    refreshAndSwitchOrganization,
    logout,
  } = useAuth();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);
  const [headerCustomers, setHeaderCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const { t } = useTranslation();
  const canManageOrganizations = user?.isSuperAdmin === true && currentOrganization?.role !== "MEMBER";

  const loadHeaderCustomers = useCallback(() => {
    if (!currentOrganization?.id) {
      setHeaderCustomers([]);
      return;
    }
    setLoadingCustomers(true);
    customersAPI
      .list(currentOrganization.id)
      .then((res) => {
        const list = res.data?.customers ?? [];
        setHeaderCustomers(Array.isArray(list) ? list : []);
      })
      .catch(() => setHeaderCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [currentOrganization?.id]);

  useEffect(() => {
    loadHeaderCustomers();
  }, [loadHeaderCustomers]);

  const selectedCustomer = selectedCustomerId
    ? headerCustomers.find((c) => c.id === selectedCustomerId)
    : null;
  const customerLabel = selectedCustomer
    ? selectedCustomer.name
    : t("navigation.header.allCustomers");

  const handleLogout = async () => {
    await logout();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "OWNER":
        return <Shield className="w-3 h-3" />;
      case "ADMIN":
        return <Shield className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "OWNER":
        return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200";
      case "ADMIN":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200";
    }
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <>
          <Breadcrumb className="hidden md:block">
            <BreadcrumbList>
              {breadcrumbs.map((breadcrumb, index) => (
                <React.Fragment key={index}>
                  <BreadcrumbItem>
                    {breadcrumb.href ? (
                      <BreadcrumbLink href={breadcrumb.href}>
                        {t(breadcrumb.label)}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{t(breadcrumb.label)}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex-1" />
        </>
      )}

      {!breadcrumbs.length && <div className="flex-1" />}

      {/* Organization Switcher */}
      {currentOrganization && (
        <DropdownMenu open={orgDropdownOpen} onOpenChange={setOrgDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex items-center gap-2 max-w-48"
            >
              <Building2 className="w-4 h-4" />
              <span className="truncate">{currentOrganization?.name || ''}</span>
              <ChevronDown className="w-4 h-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>{t('navigation.header.switchOrganization')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => {
                  refreshAndSwitchOrganization(org.id);
                  setOrgDropdownOpen(false);
                }}
                className="flex items-center justify-between px-3 py-2 cursor-pointer"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium truncate">{org.name}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {org.currency === 'BRL' ? 'R$' : '$'} {org.currency}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Badge
                    variant="secondary"
                    className={`text-xs ${getRoleColor(org.role)}`}
                  >
                    <span className="flex items-center gap-1">
                      {getRoleIcon(org.role)}
                      <span>{org.role}</span>
                    </span>
                  </Badge>
                  {currentOrganization?.id === org.id ? (
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  ) : <div className="w-2 h-2 bg-transparent rounded-full" />}
                </div>
              </DropdownMenuItem>
            ))}
            {canManageOrganizations && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => router.push("/settings/organizations")}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  {t('navigation.header.manageOrganizations')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    setOrgDropdownOpen(false);
                    setCreateOrgDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('navigation.header.createOrganization')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Customer filter (only when org is selected) */}
      {currentOrganization && (
        <DropdownMenu open={customerDropdownOpen} onOpenChange={setCustomerDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex items-center gap-2 max-w-48"
              disabled={loadingCustomers}
            >
              <Building className="w-4 h-4 shrink-0" />
              <span className="truncate">{customerLabel}</span>
              <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
            <DropdownMenuLabel>{t("navigation.header.filterByCustomer")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setSelectedCustomerId(null);
                setCustomerDropdownOpen(false);
              }}
              className="cursor-pointer"
            >
              <span className={!selectedCustomerId ? "font-medium" : ""}>
                {t("navigation.header.allCustomers")}
              </span>
              {!selectedCustomerId && (
                <span className="ml-2 w-2 h-2 bg-green-500 rounded-full inline-block" />
              )}
            </DropdownMenuItem>
            {headerCustomers.map((c) => {
              const depth = c.depth ?? 0;
              const isRoot = depth === 0;
              const indentPx = 12 + depth * 20;
              return (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    setCustomerDropdownOpen(false);
                  }}
                  className={`cursor-pointer ${isRoot ? "bg-muted/30" : ""}`}
                  style={{ paddingLeft: indentPx }}
                >
                  <div className="flex items-center gap-1 min-w-0 w-full">
                    {depth > 0 && (
                      <span className="shrink-0 text-muted-foreground/60 select-none" aria-hidden>
                        └
                      </span>
                    )}
                    <span className={selectedCustomerId === c.id ? "font-medium truncate" : "truncate"}>
                      {c.name}
                    </span>
                    {selectedCustomerId === c.id && (
                      <span className="ml-auto shrink-0 w-2 h-2 bg-green-500 rounded-full inline-block" />
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Notifications */}
      <NotificationBell />

      {/* Language Switcher */}
      <LanguageSwitcherLink />

      {/* Theme Switcher */}
      <ThemeSwitcher />

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {currentOrganization?.name
                  ? getInitials(currentOrganization.name)
                  : "U"}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t('navigation.header.myAccount')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => router.push("/settings/profile")}
          >
            <User className="w-4 h-4 mr-2" />
            {t('navigation.header.profileSettings')}
          </DropdownMenuItem>
          {canManageOrganizations && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push("/settings/organizations")}
            >
              <Building2 className="w-4 h-4 mr-2" />
              {t('navigation.header.organizations')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t('navigation.header.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={createOrgDialogOpen}
        onOpenChange={setCreateOrgDialogOpen}
        onSuccess={() => {
          setCreateOrgDialogOpen(false);
        }}
      />
    </header>
  );
}
