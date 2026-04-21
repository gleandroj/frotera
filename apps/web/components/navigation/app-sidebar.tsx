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
  BarChart2,
  BarChart3,
  Bell,
  Building,
  Building2,
  Car,
  ClipboardList,
  FileText,
  Fuel,
  HelpCircle,
  Home,
  MapPin,
  MapPinned,
  Radio,
  SlidersHorizontal,
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
  const { can, canGlobal, canAnyModule, canAccessTrackerHelp } = usePermissions();
  const unreadTelemetry = useUnreadAlerts(currentOrganization?.id);
  const canViewTelemetry = can(Module.TELEMETRY, Action.VIEW);
  const canViewTracking = can(Module.TRACKING, Action.VIEW);
  const canEditCompanySettings = can(Module.COMPANIES, Action.EDIT);
  const canViewDashboard = can(Module.DASHBOARD, Action.VIEW);
  const canViewVehicles = can(Module.VEHICLES, Action.VIEW);
  const canViewChecklist =
    can(Module.CHECKLIST, Action.VIEW) ||
    can(Module.CHECKLIST_TEMPLATES, Action.VIEW);
  const canViewIncidents = can(Module.INCIDENTS, Action.VIEW);
  const canViewDrivers = can(Module.DRIVERS, Action.VIEW);
  const canViewDocuments = can(Module.DOCUMENTS, Action.VIEW);
  const canViewFuel = can(Module.FUEL, Action.VIEW);
  const canViewCustomers = can(Module.COMPANIES, Action.VIEW);
  const canViewTeam = can(Module.USERS, Action.VIEW);
  const canViewAnyFuelReport = canAnyModule(
    [
      Module.REPORTS_FUEL_CONSUMPTION,
      Module.REPORTS_FUEL_COSTS,
      Module.REPORTS_FUEL_BENCHMARK,
      Module.REPORTS_FUEL_EFFICIENCY,
      Module.REPORTS_FUEL_SUMMARY,
    ],
    Action.VIEW,
  );
  const canViewTrackingReports = can(Module.REPORTS_TRACKING, Action.VIEW);
  const canViewReferencePoints = can(Module.REFERENCE_POINTS, Action.VIEW);

  const isMember = currentOrganization
    ? !(currentOrganization.role?.permissions?.some((p) => p.module === 'USERS' && p.actions.includes('CREATE')) ?? false)
    : false;
  const isSuperAdmin = user?.isSuperAdmin === true;
  const canViewTrackerDiscoveries = canGlobal(Module.TRACKER_DISCOVERIES, Action.VIEW);
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
    ...(canViewTrackerDiscoveries
      ? [
          {
            name: t("navigation.items.trackerDiscoveries"),
            href: "/settings/tracker-discoveries",
            icon: Radio,
            current: pathname.startsWith("/settings/tracker-discoveries"),
          },
        ]
      : []),
    ...(canEditCompanySettings && currentOrganization
      ? [
          {
            name: t("navigation.items.companyFleetSettings"),
            href: "/dashboard/settings/company",
            icon: SlidersHorizontal,
            current: pathname.startsWith("/dashboard/settings/company"),
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
    const items: NavigationItem[] = [];
    if (canViewTracking) {
      items.push({
        name: t("navigation.items.tracking"),
        href: "/dashboard/tracking",
        icon: MapPin,
        current: pathname.startsWith("/dashboard/tracking"),
      });
    }
    if (canViewDashboard) {
      items.push({
        name: t("navigation.items.dashboard"),
        href: "/dashboard/panel",
        icon: Home,
        current: pathname === "/dashboard/panel",
      });
    }
    if (canViewVehicles) {
      items.push({
        name: t("navigation.items.vehicles"),
        href: "/dashboard/vehicles",
        icon: Car,
        current: pathname.startsWith("/dashboard/vehicles"),
      });
    }
    if (canAccessTrackerHelp) {
      items.push({
        name: t("navigation.items.help"),
        href: "/dashboard/help",
        icon: HelpCircle,
        current: pathname.startsWith("/dashboard/help"),
      });
    }
    if (canViewChecklist) {
      items.push({
        name: t("navigation.items.checklist"),
        href: "/dashboard/checklist",
        icon: ClipboardList,
        current: pathname.startsWith("/dashboard/checklist"),
      });
    }
    if (canViewIncidents) {
      items.push({
        name: t("navigation.items.incidents"),
        href: "/dashboard/incidents",
        icon: AlertCircle,
        current: pathname.startsWith("/dashboard/incidents"),
      });
    }
    if (canViewDrivers) {
      items.push({
        name: t("navigation.items.drivers"),
        href: "/dashboard/drivers",
        icon: UserRound,
        current: pathname.startsWith("/dashboard/drivers"),
      });
    }
    if (canViewDocuments) {
      items.push({
        name: t("navigation.items.documents"),
        href: "/dashboard/documents",
        icon: FileText,
        current: pathname.startsWith("/dashboard/documents"),
      });
    }
    if (canViewFuel) {
      items.push({
        name: t("navigation.items.fuel"),
        href: "/dashboard/fuel",
        icon: Fuel,
        current:
          pathname.startsWith("/dashboard/fuel") &&
          !pathname.startsWith("/dashboard/fuel/reports"),
      });
    }
    if (canViewAnyFuelReport) {
      items.push({
        name: t("navigation.items.fuelReports"),
        href: "/dashboard/fuel/reports",
        icon: BarChart3,
        current: pathname.startsWith("/dashboard/fuel/reports"),
      });
    }
    if (canViewTrackingReports) {
      items.push({
        name: t("navigation.items.trackingReports"),
        href: "/dashboard/vehicles/reports",
        icon: BarChart2,
        current: pathname.startsWith("/dashboard/vehicles/reports"),
      });
    }
    if (canViewReferencePoints) {
      items.push({
        name: t("navigation.items.referencePoints"),
        href: "/dashboard/reference-points",
        icon: MapPinned,
        current: pathname.startsWith("/dashboard/reference-points"),
      });
    }
    if (canViewTelemetry) {
      items.push({
        name: t("navigation.items.telemetry"),
        href: "/dashboard/telemetry",
        icon: Bell,
        current: pathname.startsWith("/dashboard/telemetry"),
        badge: unreadTelemetry > 0 ? unreadTelemetry : undefined,
      });
    }
    if (canViewCustomers) {
      items.push({
        name: t("navigation.items.customers"),
        href: "/dashboard/customers",
        icon: Building,
        current: pathname.startsWith("/dashboard/customers"),
      });
    }
    return items;
  }, [
    t, pathname, canViewTracking, canViewDashboard, canViewVehicles,
    canAccessTrackerHelp,
    canViewChecklist, canViewIncidents, canViewDrivers, canViewDocuments,
    canViewFuel, canViewAnyFuelReport, canViewTrackingReports, canViewReferencePoints, canViewTelemetry, canViewCustomers,
    unreadTelemetry,
  ]);

  const mainNavigation: NavigationSection[] = [
    {
      title: t("navigation.sections.overview"),
      items: overviewItems,
    },
    ...(canViewTeam
      ? [
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
        ]
      : []),
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
