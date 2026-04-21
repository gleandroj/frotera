"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { Action, Module, usePermissions } from "@/lib/hooks/use-permissions";
import { useUnreadAlerts } from "@/lib/hooks/use-unread-alerts";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BarChart3,
  Bell,
  Building,
  Building2,
  Car,
  ChevronRight,
  ClipboardList,
  FileText,
  Fuel,
  HelpCircle,
  Home,
  MapPin,
  MapPinned,
  Radio,
  Smartphone,
  SlidersHorizontal,
  User,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "../icons/logo";

const CURRENT_YEAR = new Date().getFullYear();

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon | React.ElementType;
  isActive: boolean;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function NavGroupItem({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={item.isActive}>
        <Link href={item.href}>
          <Icon className="size-4" />
          <span>{item.title}</span>
          {item.badge != null && item.badge > 0 && (
            <Badge
              variant="destructive"
              className="ml-auto min-h-5 min-w-5 shrink-0 px-1 text-xs tabular-nums"
            >
              {item.badge > 99 ? "99+" : item.badge}
            </Badge>
          )}
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function NavCollapsibleGroup({ group }: { group: NavGroup }) {
  const isAnyActive = group.items.some((i) => i.isActive);
  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen className="group/collapsible w-full">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isAnyActive}>
            <span>{group.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.items.map((item) => (
              <NavGroupItem key={item.href} item={item} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { currentOrganization, user } = useAuth();
  const { can, canGlobal, canAnyModule, canAccessTrackerHelp } = usePermissions();
  const unreadTelemetry = useUnreadAlerts(currentOrganization?.id);

  // Permissions
  const canViewTracking = can(Module.TRACKING, Action.VIEW);
  const canViewDashboard = can(Module.DASHBOARD, Action.VIEW);
  const canViewVehicles = can(Module.VEHICLES, Action.VIEW);
  const canViewDevices = can(Module.DEVICES, Action.VIEW);
  const canViewDrivers = can(Module.DRIVERS, Action.VIEW);
  const canViewDocuments = can(Module.DOCUMENTS, Action.VIEW);
  const canViewChecklist =
    can(Module.CHECKLIST, Action.VIEW) ||
    can(Module.CHECKLIST_TEMPLATES, Action.VIEW);
  const canViewIncidents = can(Module.INCIDENTS, Action.VIEW);
  const canViewFuel = can(Module.FUEL, Action.VIEW);
  const canViewTelemetry = can(Module.TELEMETRY, Action.VIEW);
  const canViewReferencePoints = can(Module.REFERENCE_POINTS, Action.VIEW);
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
  const canViewChecklistReports = can(Module.CHECKLIST, Action.VIEW);
  const canViewAnyReport =
    canViewAnyFuelReport || canViewTrackingReports || canViewChecklistReports;
  const canViewCustomers = can(Module.COMPANIES, Action.VIEW);
  const canViewTeam = can(Module.USERS, Action.VIEW);
  const canEditCompanySettings = can(Module.COMPANIES, Action.EDIT);

  const isMember = currentOrganization
    ? !(
        currentOrganization.role?.permissions?.some(
          (p) => p.module === "USERS" && p.actions.includes("CREATE"),
        ) ?? false
      )
    : false;
  const isSuperAdmin = user?.isSuperAdmin === true;
  const canViewTrackerDiscoveries = canGlobal(
    Module.TRACKER_DISCOVERIES,
    Action.VIEW,
  );

  // --- Build collapsible groups ---

  const fleetItems: NavItem[] = [];
  if (canViewVehicles)
    fleetItems.push({
      title: t("navigation.items.vehicles"),
      href: "/dashboard/vehicles",
      icon: Car,
      isActive: pathname.startsWith("/dashboard/vehicles"),
    });
  if (canViewDevices)
    fleetItems.push({
      title: t("navigation.items.devices"),
      href: "/dashboard/devices",
      icon: Smartphone,
      isActive: pathname.startsWith("/dashboard/devices"),
    });
  if (canViewDrivers)
    fleetItems.push({
      title: t("navigation.items.drivers"),
      href: "/dashboard/drivers",
      icon: UserRound,
      isActive: pathname.startsWith("/dashboard/drivers"),
    });
  if (canViewDocuments)
    fleetItems.push({
      title: t("navigation.items.documents"),
      href: "/dashboard/documents",
      icon: FileText,
      isActive: pathname.startsWith("/dashboard/documents"),
    });

  const operationsItems: NavItem[] = [];
  if (canViewChecklist)
    operationsItems.push({
      title: t("navigation.items.checklist"),
      href: "/dashboard/checklist",
      icon: ClipboardList,
      isActive: pathname.startsWith("/dashboard/checklist"),
    });
  if (canViewIncidents)
    operationsItems.push({
      title: t("navigation.items.incidents"),
      href: "/dashboard/incidents",
      icon: AlertCircle,
      isActive: pathname.startsWith("/dashboard/incidents"),
    });
  if (canViewFuel)
    operationsItems.push({
      title: t("navigation.items.fuel"),
      href: "/dashboard/fuel",
      icon: Fuel,
      isActive:
        pathname.startsWith("/dashboard/fuel") &&
        !pathname.startsWith("/dashboard/fuel/reports"),
    });

  const monitoringItems: NavItem[] = [];
  if (canViewTelemetry)
    monitoringItems.push({
      title: t("navigation.items.telemetry"),
      href: "/dashboard/telemetry",
      icon: Bell,
      isActive: pathname.startsWith("/dashboard/telemetry"),
      badge: unreadTelemetry > 0 ? unreadTelemetry : undefined,
    });
  if (canViewReferencePoints)
    monitoringItems.push({
      title: t("navigation.items.referencePoints"),
      href: "/dashboard/reference-points",
      icon: MapPinned,
      isActive: pathname.startsWith("/dashboard/reference-points"),
    });

  const reportsItems: NavItem[] = [];
  if (canViewAnyReport)
    reportsItems.push({
      title: t("common.reports"),
      href: "/dashboard/reports",
      icon: BarChart3,
      isActive:
        pathname.startsWith("/dashboard/reports") ||
        pathname.startsWith("/dashboard/fuel/reports") ||
        pathname.startsWith("/dashboard/vehicles/reports") ||
        pathname.startsWith("/dashboard/checklist/reports"),
    });

  const customersItems: NavItem[] = [];
  if (canViewCustomers)
    customersItems.push({
      title: t("navigation.items.customers"),
      href: "/dashboard/customers",
      icon: Building,
      isActive: pathname.startsWith("/dashboard/customers"),
    });

  const navGroups: NavGroup[] = [
    ...(fleetItems.length > 0
      ? [{ title: t("navigation.sections.fleet"), items: fleetItems }]
      : []),
    ...(operationsItems.length > 0
      ? [{ title: t("navigation.sections.operations"), items: operationsItems }]
      : []),
    ...(monitoringItems.length > 0
      ? [{ title: t("navigation.sections.monitoring"), items: monitoringItems }]
      : []),
    ...(reportsItems.length > 0
      ? [{ title: t("navigation.sections.reports"), items: reportsItems }]
      : []),
    ...(customersItems.length > 0
      ? [{ title: t("navigation.sections.customers"), items: customersItems }]
      : []),
  ];

  // --- Settings items ---
  const settingsItems: NavItem[] = [
    ...(!isMember && isSuperAdmin
      ? [
          {
            title: t("navigation.items.organization"),
            href: "/settings/organizations",
            icon: Building2,
            isActive: pathname.startsWith("/settings/organizations"),
          },
        ]
      : []),
    ...(canViewTrackerDiscoveries
      ? [
          {
            title: t("navigation.items.trackerDiscoveries"),
            href: "/settings/tracker-discoveries",
            icon: Radio,
            isActive: pathname.startsWith("/settings/tracker-discoveries"),
          },
        ]
      : []),
    ...(canEditCompanySettings && currentOrganization
      ? [
          {
            title: t("navigation.items.companyFleetSettings"),
            href: "/dashboard/settings/company",
            icon: SlidersHorizontal,
            isActive: pathname.startsWith("/dashboard/settings/company"),
          },
        ]
      : []),
    {
      title: t("navigation.items.profile"),
      href: "/settings/profile",
      icon: User,
      isActive: pathname.startsWith("/settings/profile"),
    },
  ];

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
                {currentOrganization.name || ""}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main navigation group */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Rastreamento — standalone root item (tela principal) */}
              {canViewTracking && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/dashboard/tracking")}
                  >
                    <Link href="/dashboard/tracking">
                      <MapPin className="size-4" />
                      <span>{t("navigation.items.tracking")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Dashboard — standalone root item */}
              {canViewDashboard && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/dashboard/panel"}
                  >
                    <Link href="/dashboard/panel">
                      <Home className="size-4" />
                      <span>{t("navigation.items.dashboard")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Domain collapsible groups */}
              {navGroups.map((group) => (
                <NavCollapsibleGroup key={group.title} group={group} />
              ))}

              {/* Help — standalone, only for privileged users */}
              {canAccessTrackerHelp && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/dashboard/help")}
                  >
                    <Link href="/dashboard/help">
                      <HelpCircle className="size-4" />
                      <span>{t("navigation.items.help")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Team Management */}
        {canViewTeam && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("navigation.sections.teamManagement")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/team")}
                  >
                    <Link href="/team">
                      <Users className="size-4" />
                      <span>{t("navigation.items.teamMembers")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Settings */}
        {settingsItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("navigation.sections.settings")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={item.isActive}>
                        <Link href={item.href}>
                          <Icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="p-4 text-xs text-sidebar-foreground/70">
          <p>{t("navigation.footer.copyright", { year: CURRENT_YEAR })}</p>
          <p>{t("navigation.footer.description")}</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
