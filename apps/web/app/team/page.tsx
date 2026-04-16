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
import { TeamMembersTableSkeleton, SkeletonPageLayout } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  MoreHorizontal,
  Pencil,
  Shield,
  User,
  UserPlus,
  Users,
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

interface TeamMember {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  role: string;
  joinedAt: string;
  customerRestricted?: boolean;
  customers?: { id: string; name: string }[];
}

export default function TeamPage() {
  const { t, currentLanguage } = useTranslation();
  const router = useRouter();

  const { currentOrganization, user, selectedCustomerId } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

  const loadTeamMembers = async () => {
    if (!currentOrganization) return;

    try {
      setLoadingMembers(true);
      const response = await organizationAPI.getMembers(currentOrganization.id, {
        customerId: selectedCustomerId ?? undefined,
      });
      setMembers(response.data.memberships);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        t('team.errorMessages.failedToLoadMembers');
      toast.error(t('team.toastMessages.error'), {
        description: errorMessage,
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    if (!currentOrganization) return;

    try {
      await organizationAPI.updateMember(currentOrganization.id, memberId, { role: newRole });
      await loadTeamMembers();
      toast.success(t('team.toastMessages.memberRoleUpdated'), {
        description: t('team.toastMessages.memberRoleUpdatedDescription'),
      });
    } catch (err: any) {
      // Check for specific error codes from backend
      const errorCode = err.response?.data?.errorCode;
      const errorMessage = err.response?.data?.message || err.message || t('team.errorMessages.failedToUpdateMemberRole');

      if (errorCode === 'PLAN_LIMIT_EXCEEDED') {
        // Show specific plan limit error
        toast.error(t('errors.memberLimitExceeded'), {
          description: t('errors.upgradeRequired'),
          action: {
            label: t('dashboard.planLimits.needMore.upgrade'),
            onClick: () => router.push('/settings/billing'),
          },
        });
      } else {
        // Show generic error with actual backend message
        toast.error(t('team.toastMessages.error'), {
          description: errorMessage,
        });
      }
    }
  };

  const removeMember = async (memberId: string) => {
    if (!currentOrganization) return;

    try {
      await organizationAPI.removeMember(currentOrganization.id, memberId);
      await loadTeamMembers();
      toast.success(t('team.toastMessages.memberRemoved'), {
        description: t('team.toastMessages.memberRemovedDescription'),
      });
    } catch (err: any) {
      // Check for specific error codes from backend
      const errorCode = err.response?.data?.errorCode;
      const errorMessage = err.response?.data?.message || err.message || t('team.errorMessages.failedToRemoveMember');

      // For removeMember, plan limits shouldn't typically apply, but handle other specific errors if needed
      toast.error(t('team.toastMessages.error'), {
        description: errorMessage,
      });
    } finally {
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
    }
  };

  // Load members for the current organization, respecting global customer filter.
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
        });
        setMembers(membersRes.data.memberships ?? []);
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          t('team.errorMessages.failedToLoadMembers');
        toast.error(t('team.toastMessages.error'), { description: errorMessage });
      } finally {
        setLoadingMembers(false);
      }
    };
    load();
  }, [currentOrganization?.id, selectedCustomerId, t]);

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "OWNER":
        return <Shield className="w-4 h-4" />;
      case "ADMIN":
        return <Shield className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "OWNER":
        return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900";
      case "ADMIN":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800";
    }
  };

  const canManageTeam =
    currentOrganization?.role === "OWNER" ||
    currentOrganization?.role === "ADMIN";

  const currentUserMembership = members.find((m) => m.user.id === user?.id);
  const currentUserRestricted = currentUserMembership?.customerRestricted === true;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (e) {
      return "N/A";
    }
  };


  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('team.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('team.selectOrganization')}
          </p>
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
              {loadingMembers ? (
                <div className="space-y-4">
                  {Array(4).fill(0).map((_, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-5 w-16" />
                          </div>
                          <Skeleton className="h-3 w-48" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-8" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {members.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        {t('team.emptyStates.noMembers')}
                      </p>
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
                          {canManageTeam && (
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
                                    {getInitials(member.user.name, member.user.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">
                                  {member.user.name || t('team.noName')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                {member.user.email}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${getRoleColor(member.role)}`}>
                                <span className="flex items-center gap-1">
                                  <span className="text-current">{getRoleIcon(member.role)}</span>
                                  {member.role}
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
                            {canManageTeam && (
                              <TableCell className="text-right">
                                {member.role !== "OWNER" && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem asChild>
                                        <Link href={`/team/${member.id}`}>
                                          <Pencil className="w-4 h-4 mr-2" />
                                          {t('team.actions.editMember')}
                                        </Link>
                                      </DropdownMenuItem>
                                      {member.role !== "ADMIN" && (
                                        <DropdownMenuItem onClick={() => updateMemberRole(member.id, "ADMIN")}>
                                          {t('team.actions.promoteToAdmin')}
                                        </DropdownMenuItem>
                                      )}
                                      {member.role === "ADMIN" && (
                                        <DropdownMenuItem onClick={() => updateMemberRole(member.id, "MEMBER")}>
                                          {t('team.actions.demoteToMember')}
                                        </DropdownMenuItem>
                                      )}
                                      {member.user.id !== user?.id && (
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setMemberToRemove(member.id);
                                            setRemoveDialogOpen(true);
                                          }}
                                          className="text-destructive"
                                        >
                                          {t('team.actions.removeMember')}
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </CardContent>
          </Card>
    </div>
  );
}
