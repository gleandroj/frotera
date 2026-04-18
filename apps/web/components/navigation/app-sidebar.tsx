"use client";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BarChart3,
  Bell,
  Building,
  Building2,
  Car,
  ClipboardList,
  FileText,
  Fuel,
  Home,
  User,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "../icons/logo";
import { useTranslation } from "@/i18n/useTranslation";
import { Action, Module, usePermissions } from "@/lib/hooks/use-permissions";
import { useUnreadAlerts } from "@/lib/hooks/use-unread-alerts";

const CURRENT_YEAR = new Date().getFullYear();

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon | React.ElementType;
  current: boolean;
  disabled?: boolean;
  badge?: number;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export function AppSidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { currentOrganization, user } = useAuth();
  const { can } = usePermissions();
  const unreadTelemetry = useUnreadAlerts(currentOrganization?.id);
  const canViewTelemetry = can(Module.TELEMETRY, Action.VIEW);

  const isMember = currentOrganization
    ? !(currentOrganization.role?.permissions?.some((p) => p.module === 'USERS' && p.actions.includes('CREATE')) ?? false)
    : false;
  const isSuperAdmin = user?.isSuperAdmin === true;
  const settingsItems: NavigationItem[] = [
    ...(!isMember && isSuperAdmin
      ? [
          {
            name: t('navigation.items.organization'),
            href: "/settings/organizations",
            icon: Building2,
            current: pathname.startsWith("/settings/organizations"),
          },
        ]
      : []),
    {
      name: t('navigation.items.profile'),
      href: "/settings/profile",
      icon: User,
      current: pathname.startsWith("/settings/profile"),
    },
  ];

  const overviewItems = useMemo((): NavigationItem[] => {
    const items: NavigationItem[] = [
      {
        name: t("navigation.items.dashboard"),
        href: "/dashboard",
        icon: Home,
        current: pathname === "/dashboard",
      },
      {
        name: t("navigation.items.vehicles"),
        href: "/dashboard/vehicles",
        icon: Car,
        current: pathname.startsWith("/dashboard/vehicles"),
      },
      {
        name: t("navigation.items.checklist"),
        href: "/dashboard/checklist",
        icon: ClipboardList,
        current: pathname.startsWith("/dashboard/checklist"),
      },
      {
        name: t("navigation.items.incidents"),
        href: "/dashboard/incidents",
        icon: AlertCircle,
        current: pathname.startsWith("/dashboard/incidents"),
      },
      {
        name: t("navigation.items.drivers"),
        href: "/dashboard/drivers",
        icon: UserRound,
        current: pathname.startsWith("/dashboard/drivers"),
      },
      {
        name: t("navigation.items.documents"),
        href: "/dashboard/documents",
        icon: FileText,
        current: pathname.startsWith("/dashboard/documents"),
      },
      {
        name: t("navigation.items.fuel"),
        href: "/dashboard/fuel",
        icon: Fuel,
        current:
          pathname.startsWith("/dashboard/fuel") &&
          !pathname.startsWith("/dashboard/fuel/reports"),
      },
      {
        name: t("navigation.items.fuelReports"),
        href: "/dashboard/fuel/reports",
        icon: BarChart3,
        current: pathname.startsWith("/dashboard/fuel/reports"),
      },
    ];
    if (canViewTelemetry) {
      items.push({
        name: t("navigation.items.telemetry"),
        href: "/dashboard/telemetry",
        icon: Bell,
        current: pathname.startsWith("/dashboard/telemetry"),
        badge: unreadTelemetry > 0 ? unreadTelemetry : undefined,
      });
    }
    items.push({
      name: t("navigation.items.customers"),
      href: "/dashboard/customers",
      icon: Building,
      current: pathname.startsWith("/dashboard/customers"),
    });
    return items;
  }, [t, pathname, canViewTelemetry, unreadTelemetry]);

  const mainNavigation: NavigationSection[] = [
    {
      title: t("navigation.sections.overview"),
      items: overviewItems,
    },
    {
      title: t('navigation.sections.teamManagement'),
      items: [
        {
          name: t('navigation.items.teamMembers'),
          href: "/team",
          icon: Users,
          current: pathname.startsWith("/team"),
        },
      ],
    },
    {
      title: t('navigation.sections.settings'),
      items: settingsItems,
    },
  ];

  const allNavigation = [...mainNavigation];

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex flex-1 items-center">
            <Logo variant="auto" size="sm" />
          </div>
          {currentOrganization && (
            <div className="grid flex-1 text-left text-xs leading-tight">
              <span className="truncate text-sidebar-foreground/70">
                {currentOrganization?.name || ''}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {allNavigation.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.current}
                        disabled={item.disabled}
                        className={
                          item.disabled ? "opacity-50 cursor-not-allowed" : ""
                        }
                      >
                        <Link href={item.disabled ? "#" : item.href}>
                          <Icon className="size-4" />
                          <span>{item.name}</span>
                          {item.badge != null && item.badge > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-auto min-h-5 min-w-5 shrink-0 px-1 text-xs tabular-nums"
                            >
                              {item.badge > 99 ? "99+" : item.badge}
                            </Badge>
                          )}
                          {item.disabled && (
                            <Badge
                              variant="secondary"
                              className="ml-auto text-xs"
                            >
                              {t('navigation.badges.soon')}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="p-4 text-xs text-sidebar-foreground/70">
          <p>{t('navigation.footer.copyright', { year: CURRENT_YEAR })}</p>
          <p>{t('navigation.footer.description')}</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
