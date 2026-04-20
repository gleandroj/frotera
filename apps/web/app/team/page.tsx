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
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  RecordStatusFilter,
  RECORD_STATUS_ALL,
  RECORD_STATUS_ACTIVE,
  RECORD_STATUS_INACTIVE,
  type RecordListStatus,
} from "@/components/list-filters/record-status-filter";
import { useTranslation } from "@/i18n/useTranslation";
import { organizationAPI } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { TeamMembersTableSkeleton, SkeletonPageLayout } from "@/components/ui";
import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MemberEditSheet } from "./member-edit-sheet";
import { MemberCreateSheet } from "./member-create-sheet";
import { getTeamColumns, type TeamMember } from "./columns";
import { toast } from "sonner";

export default function TeamPage() {
  const { t } = useTranslation();
  const { currentOrganization, user, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [listStatus, setListStatus] = useState<RecordListStatus>(RECORD_STATUS_ALL);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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
      toast.success(t('team.toastMessages.memberEnabled'), {
        description: t('team.toastMessages.memberEnabledDescription'),
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || t('team.errorMessages.failedToEnableMember');
      toast.error(t('team.toastMessages.error'), { description: errorMessage });
    }
  };

  const loadMembers = useCallback(async () => {
    const orgId = currentOrganization?.id;
    if (!orgId) {
      setMembers([]);
      setLoadingMembers(false);
      return;
    }
    setLoadingMembers(true);
    try {
      const membersRes = await organizationAPI.getMembers(orgId, {
        customerId: selectedCustomerId ?? undefined,
        activeOnly: listStatus === RECORD_STATUS_ACTIVE,
        inactiveOnly: listStatus === RECORD_STATUS_INACTIVE,
        includeInactive: listStatus === RECORD_STATUS_ALL,
      });
      setMembers(membersRes.data.memberships ?? []);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || t('team.errorMessages.failedToLoadMembers');
      toast.error(t('team.toastMessages.error'), { description: errorMessage });
    } finally {
      setLoadingMembers(false);
    }
  }, [currentOrganization?.id, selectedCustomerId, listStatus, t]);

  useEffect(() => {
    setMembers([]);
    loadMembers();
  }, [loadMembers]);

  const handleRequestRemove = useCallback((memberId: string) => {
    setMemberToRemove(memberId);
    setRemoveDialogOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      getTeamColumns(t, {
        currentUserId: user?.id,
        canManageTeam,
        canDeleteTeam,
        canEnableTeam,
        onEdit: setEditMemberId,
        onRemove: handleRequestRemove,
        onEnable: enableMember,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, user?.id, canManageTeam, canDeleteTeam, canEnableTeam, handleRequestRemove],
  );

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('team.title')}</h1>
          <p className="text-muted-foreground">
            {t('team.showingMembersFor', { organizationName: currentOrganization.name })}
          </p>
        </div>
        {canManageTeam && (
          <PlanLimitWrapper resourceType="team_members" onAction={() => setCreateOpen(true)}>
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              {t('team.addUser')}
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

      <DataTable<TeamMember, unknown>
        columns={columns}
        data={members}
        filterColumnId="name"
        filterPlaceholder={t("common.search")}
        noResultsLabel={
          members.length === 0
            ? t("team.emptyStates.noMembers")
            : t("common.noResults")
        }
        toolbarLeading={
          <RecordStatusFilter
            id="team-list-status"
            value={listStatus}
            onValueChange={setListStatus}
          />
        }
      />

      <MemberCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={loadMembers}
      />
      <MemberEditSheet
        open={!!editMemberId}
        onOpenChange={(open) => { if (!open) setEditMemberId(null); }}
        memberId={editMemberId}
        onSuccess={loadMembers}
      />
    </div>
  );
}
