"use client";

import { PlanLimitWrapper } from "@/components/plans/plan-limit-wrapper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getUserInitials } from "@/lib/user-initials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/i18n/useTranslation";
import { organizationAPI } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { TeamMembersTableSkeleton, SkeletonPageLayout } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  MoreHorizontal,
  Pencil,
  Shield,
  User,
  UserPlus,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface TeamMemberRole {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  color?: string | null;
  permissions: Array<{ id: string; module: string; actions: string[]; scope: string }>;
}

interface TeamMember {
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

export default function TeamPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const { currentOrganization, user, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const canManageTeam = can(Module.USERS, Action.CREATE);
  const canDeleteTeam = can(Module.USERS, Action.DELETE);
  const canEnableTeam = can(Module.USERS, Action.EDIT);

  const removeMember = async (memberId: string) => {
    if (!currentOrganization) return;

    try {
      await organizationAPI.removeMember(currentOrganization.id, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success(t('team.toastMessages.memberRemoved'), {
        description: t('team.toastMessages.memberRemovedDescription'),
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || t('team.errorMessages.failedToRemoveMember');
      toast.error(t('team.toastMessages.error'), { description: errorMessage });
    } finally {
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
    }
  };

  const enableMember = async (memberId: string) => {
    if (!currentOrganization) return;

    try {
      await organizationAPI.enableMember(currentOrganization.id, memberId);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, isActive: true } : m)));
      toast.success("Usuário reabilitado", {
        description: "O usuário foi reabilitado com sucesso.",
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Falha ao reabilitar usuário";
      toast.error(t('team.toastMessages.error'), { description: errorMessage });
    }
  };

  useEffect(() => {
    const orgId = currentOrganization?.id;
    if (!orgId) {
      setMembers([]);
      setLoadingMembers(false);
      return;
    }
    setMembers([]);
    const load = async () => {
      setLoadingMembers(true);
      try {
        const membersRes = await organizationAPI.getMembers(orgId, {
          customerId: selectedCustomerId ?? undefined,
          includeInactive: showInactive,
        });
        setMembers(membersRes.data.memberships ?? []);
      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.message || t('team.errorMessages.failedToLoadMembers');
        toast.error(t('team.toastMessages.error'), { description: errorMessage });
      } finally {
        setLoadingMembers(false);
      }
    };
    load();
  }, [currentOrganization?.id, selectedCustomerId, showInactive, t]);

  const getRoleColor = (role: TeamMemberRole) => {
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
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return "N/A";
    }
  };

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('team.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('team.selectOrganization')}</p>
        </div>
      </div>
    );
  }

  if (loadingMembers) {
    return (
      <SkeletonPageLayout showTabs={true} showCreateButton={true}>
        <TeamMembersTableSkeleton />
      </SkeletonPageLayout>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('team.title')}</h1>
          <p className="text-muted-foreground">
            {t('team.showingMembersFor', { organizationName: currentOrganization.name })}
          </p>
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar desabilitados
          </label>
        </div>
        {canManageTeam && (
          <PlanLimitWrapper resourceType="team_members" onAction={() => router.push("/team/new")}>
            <Button asChild>
              <Link href="/team/new">
                <UserPlus className="w-4 h-4 mr-2" />
                {t('team.addUser')}
              </Link>
            </Button>
          </PlanLimitWrapper>
        )}
      </div>

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.confirmDialogs.removeMember.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('team.confirmDialogs.removeMember.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('team.confirmDialogs.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToRemove && removeMember(memberToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('team.confirmDialogs.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="mt-4">
        <CardContent className="pt-6">
          {members.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">{t('team.emptyStates.noMembers')}</p>
              {canManageTeam && (
                <Button asChild>
                  <Link href="/team/new">
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t('team.emptyStates.addFirstUser')}
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('team.table.name')}</TableHead>
                  <TableHead>{t('team.table.email')}</TableHead>
                  <TableHead>{t('team.table.role')}</TableHead>
                  <TableHead>{t('team.table.access')}</TableHead>
                  <TableHead>{t('team.table.joinedAt')}</TableHead>
                  {(canManageTeam || canDeleteTeam) && (
                    <TableHead className="text-right w-[80px]">{t('team.table.actions')}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {getUserInitials(member.user.name, member.user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{member.user.name || t('team.noName')}</span>
                        {member.isActive === false && (
                          <Badge variant="secondary" className="text-xs">
                            Desabilitado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {member.user.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${getRoleColor(member.role)}`}
                        style={
                          member.role.color
                            ? { backgroundColor: `${member.role.color}20`, color: member.role.color }
                            : {}
                        }
                      >
                        <span className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {member.role.name}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {member.customerRestricted
                        ? t('team.accessLimitedTo', { count: member.customers?.length ?? 0 })
                        : t('team.accessFull')}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(member.joinedAt)}
                    </TableCell>
                    {(canManageTeam || canDeleteTeam) && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canManageTeam && member.isActive !== false && (
                              <DropdownMenuItem asChild>
                                <Link href={`/team/${member.id}`}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  {t('team.actions.editMember')}
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {canDeleteTeam && member.user.id !== user?.id && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setMemberToRemove(member.id);
                                  setRemoveDialogOpen(true);
                                }}
                                className="text-destructive"
                                disabled={member.isActive === false}
                              >
                                {t('team.actions.removeMember')}
                              </DropdownMenuItem>
                            )}
                            {canEnableTeam && member.isActive === false && (
                              <DropdownMenuItem onClick={() => enableMember(member.id)}>
                                Reabilitar usuário
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
