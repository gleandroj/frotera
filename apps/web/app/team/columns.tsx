"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Mail, MoreHorizontal, Pencil, Shield } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUserInitials } from "@/lib/user-initials";

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export interface TeamMemberRole {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  color?: string | null;
  permissions: Array<{ id: string; module: string; actions: string[]; scope: string }>;
}

export interface TeamMember {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  role: TeamMemberRole;
  joinedAt: string;
  isActive?: boolean;
  customerRestricted?: boolean;
  customers?: { id: string; name: string }[];
}

export interface TeamColumnsOptions {
  currentUserId?: string;
  canManageTeam: boolean;
  canDeleteTeam: boolean;
  canEnableTeam: boolean;
  onEdit: (memberId: string) => void;
  onRemove: (memberId: string) => void;
  onEnable: (memberId: string) => void;
}

function getRoleColor(role: TeamMemberRole): string {
  if (role.color) return "";
  switch (role.name) {
    case "Dono da Empresa":
      return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900";
    case "Administrador":
      return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900";
    case "Operador":
      return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900";
    case "Motorista":
      return "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800";
  }
}

function formatDate(
  dateString: string | null | undefined,
  fallback: string,
): string {
  if (!dateString) return fallback;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return fallback;
  }
}

export function getTeamColumns(
  t: TFunction,
  options: TeamColumnsOptions,
): ColumnDef<TeamMember>[] {
  const {
    currentUserId,
    canManageTeam,
    canDeleteTeam,
    canEnableTeam,
    onEdit,
    onRemove,
    onEnable,
  } = options;

  const showActions = canManageTeam || canDeleteTeam || canEnableTeam;

  const columns: ColumnDef<TeamMember>[] = [
    {
      id: "name",
      accessorFn: (row) => row.user.name ?? row.user.email,
      meta: { labelKey: "team.table.name" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8"
        >
          {t("team.table.name")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getUserInitials(member.user.name, member.user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">
              {member.user.name || t("team.noName")}
            </span>
            {member.isActive === false && (
              <Badge variant="secondary" className="text-xs">
                {t("team.inactiveBadge")}
              </Badge>
            )}
          </div>
        );
      },
      filterFn: (row, _columnId, filterValue) => {
        const query = String(filterValue ?? "").toLowerCase().trim();
        if (!query) return true;
        const member = row.original;
        return (
          (member.user.name ?? "").toLowerCase().includes(query) ||
          member.user.email.toLowerCase().includes(query)
        );
      },
    },
    {
      accessorKey: "email",
      accessorFn: (row) => row.user.email,
      meta: { labelKey: "team.table.email" },
      header: t("team.table.email"),
      cell: ({ row }) => (
        <span className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-4 w-4" />
          {row.original.user.email}
        </span>
      ),
    },
    {
      id: "role",
      accessorFn: (row) => row.role.name,
      meta: { labelKey: "team.table.role" },
      header: t("team.table.role"),
      cell: ({ row }) => {
        const role = row.original.role;
        return (
          <Badge
            className={`text-xs ${getRoleColor(role)}`}
            style={
              role.color
                ? { backgroundColor: `${role.color}20`, color: role.color }
                : {}
            }
          >
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {role.name}
            </span>
          </Badge>
        );
      },
    },
    {
      id: "access",
      meta: { labelKey: "team.table.access" },
      header: t("team.table.access"),
      cell: ({ row }) => {
        const member = row.original;
        return (
          <span className="text-muted-foreground text-sm">
            {member.customerRestricted
              ? t("team.accessLimitedTo", {
                  count: member.customers?.length ?? 0,
                })
              : t("team.accessFull")}
          </span>
        );
      },
    },
    {
      accessorKey: "joinedAt",
      meta: { labelKey: "team.table.joinedAt" },
      header: t("team.table.joinedAt"),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(row.original.joinedAt, t("common.notAvailable"))}
        </span>
      ),
    },
  ];

  if (showActions) {
    columns.push({
      id: "actions",
      header: () => (
        <div className="text-right">{t("team.table.actions")}</div>
      ),
      cell: ({ row }) => {
        const member = row.original;
        const canEdit = canManageTeam && member.isActive !== false;
        const canRemove = canDeleteTeam && member.user.id !== currentUserId;
        const canEnable = canEnableTeam && member.isActive === false;
        if (!canEdit && !canRemove && !canEnable) return null;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={() => onEdit(member.id)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    {t("team.actions.editMember")}
                  </DropdownMenuItem>
                )}
                {canRemove && (
                  <DropdownMenuItem
                    onClick={() => onRemove(member.id)}
                    className="text-destructive"
                    disabled={member.isActive === false}
                  >
                    {t("team.actions.removeMember")}
                  </DropdownMenuItem>
                )}
                {canEnable && (
                  <DropdownMenuItem onClick={() => onEnable(member.id)}>
                    {t("team.actions.enableMember")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    });
  }

  return columns;
}
