"use client";
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
  Building,
  Building2,
  Car,
  Home,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "../icons/logo";
import { useTranslation } from "@/i18n/useTranslation";

const CURRENT_YEAR = new Date().getFullYear();

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon | React.ElementType;
  current: boolean;
  disabled?: boolean;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export function AppSidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { currentOrganization, user } = useAuth();

  const isMember = currentOrganization?.role === "MEMBER";
  const settingsItems: NavigationItem[] = [
    ...(!isMember
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

  const mainNavigation: NavigationSection[] = [
    {
      title: t('navigation.sections.overview'),
      items: [
        {
          name: t('navigation.items.dashboard'),
          href: "/dashboard",
          icon: Home,
          current: pathname === "/dashboard",
        },
        {
          name: t('navigation.items.vehicles'),
          href: "/dashboard/vehicles",
          icon: Car,
          current: pathname.startsWith("/dashboard/vehicles"),
        },
        {
          name: t('navigation.items.customers'),
          href: "/dashboard/customers",
          icon: Building,
          current: pathname.startsWith("/dashboard/customers"),
        },
      ],
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
