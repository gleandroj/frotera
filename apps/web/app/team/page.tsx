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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/i18n/useTranslation";
import { invitationAPI, organizationAPI } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { TeamMembersTableSkeleton, SkeletonPageLayout } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorMessage, Field, Form, Formik } from "formik";
import {
  CheckCircle,
  Clock,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Shield,
  User,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { toFormikValidationSchema } from "zod-formik-adapter";

interface TeamMember {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  role: string;
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  inviter: {
    name: string | null;
    email: string;
  };
}

type InvitationFormValues = {
  email: string;
  role: "ADMIN" | "MEMBER";
};

export default function TeamPage() {
  const { t, currentLanguage } = useTranslation();
  const router = useRouter();

  // Validation schema for invitation form (using translations)
  const InvitationFormSchema = z.object({
    email: z.string({
      required_error: t('team.inviteDialog.validation.emailRequired'),
      invalid_type_error: t('team.inviteDialog.validation.emailInvalid'),
    }).email(t('team.inviteDialog.validation.emailInvalid')).max(254, t('team.inviteDialog.validation.emailTooLong')),
    role: z.enum(["ADMIN", "MEMBER"], {
      required_error: t('team.inviteDialog.validation.roleRequired'),
      invalid_type_error: t('team.inviteDialog.validation.roleInvalid')
    })
  });
  const { currentOrganization, user } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "members"
  );
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [invitationToRevoke, setInvitationToRevoke] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);

  const loadTeamMembers = async () => {
    if (!currentOrganization) return;

    try {
      setLoadingMembers(true);
      const response = await organizationAPI.getMembers(currentOrganization.id);
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

  const loadInvitations = async () => {
    if (!currentOrganization) return;

    try {
      setLoadingInvitations(true);
      const response = await invitationAPI.list(currentOrganization.id);
      setInvitations(response.data.invitations);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        t('team.errorMessages.failedToLoadInvitations');
      toast.error(t('team.toastMessages.error'), {
        description: errorMessage,
      });
    } finally {
      setLoadingInvitations(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    if (!currentOrganization) return;

    try {
      await organizationAPI.updateMemberRole(currentOrganization.id, memberId, newRole);
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

  const sendInvitation = async (values: InvitationFormValues, { setSubmitting, resetForm }: any) => {
    if (!currentOrganization) return;

    try {
      setSubmitting(true);

      await invitationAPI.send(
        values.email,
        currentOrganization.id,
        values.role,
        currentLanguage
      );

      resetForm();
      setInviteDialogOpen(false);
      await loadInvitations();
      toast.success(t('team.toastMessages.invitationSent'), {
        description: t('team.toastMessages.invitationSentDescription'),
      });
    } catch (err: any) {
      // Check for specific error codes from backend
      const errorCode = err.response?.data?.errorCode;
      const errorMessage = err.response?.data?.message || err.message || t('team.errorMessages.failedToSendInvitation');

      // Handle specific error codes with user-friendly messages
      switch (errorCode) {
        case 'PLAN_LIMIT_EXCEEDED':
          toast.error(t('errors.memberLimitExceeded'), {
            description: t('errors.upgradeRequired'),
            action: {
              label: t('dashboard.planLimits.needMore.upgrade'),
              onClick: () => router.push('/settings/billing'),
            },
          });
          break;

        case 'INVITATION_ALREADY_SENT':
          toast.error(t('team.errorMessages.invitationAlreadySent'), {
            description: t('team.errorMessages.invitationAlreadySentDescription'),
          });
          break;

        case 'USER_ALREADY_EXISTS':
          toast.error(t('team.errorMessages.userAlreadyExists'), {
            description: t('team.errorMessages.userAlreadyExistsDescription'),
          });
          break;

        case 'INVITATION_EXPIRED':
          toast.error(t('team.errorMessages.invitationExpired'), {
            description: t('team.errorMessages.invitationExpiredDescription'),
          });
          break;

        case 'INVITATION_ALREADY_ACCEPTED':
          toast.error(t('team.errorMessages.invitationAlreadyAccepted'), {
            description: t('team.errorMessages.invitationAlreadyAcceptedDescription'),
          });
          break;

        default:
          // Show generic error with actual backend message
          toast.error(t('team.toastMessages.error'), {
            description: errorMessage,
          });
          break;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resendInvitation = async (invitationId: string) => {
    if (!currentOrganization) return;

    try {
      setResendingInvitationId(invitationId);
      await invitationAPI.resend(currentOrganization.id, invitationId, currentLanguage);
      await loadInvitations();
      toast.success(t('team.toastMessages.invitationResent'), {
        description: t('team.toastMessages.invitationResentDescription'),
      });
    } catch (err: any) {
      // Check for specific error codes from backend
      const errorCode = err.response?.data?.errorCode;
      const errorMessage = err.response?.data?.message || err.message || t('team.errorMessages.failedToResendInvitation');

      // Handle specific error codes with user-friendly messages
      switch (errorCode) {
        case 'PLAN_LIMIT_EXCEEDED':
          toast.error(t('errors.memberLimitExceeded'), {
            description: t('errors.upgradeRequired'),
            action: {
              label: t('dashboard.planLimits.needMore.upgrade'),
              onClick: () => router.push('/settings/billing'),
            },
          });
          break;

        case 'INVITATION_ALREADY_ACCEPTED':
          toast.error(t('team.errorMessages.invitationAlreadyAccepted'), {
            description: t('team.errorMessages.invitationAlreadyAcceptedDescription'),
          });
          break;

        case 'INVITATION_EXPIRED':
          toast.error(t('team.errorMessages.invitationExpired'), {
            description: t('team.errorMessages.invitationExpiredDescription'),
          });
          break;

        default:
          // Show generic error with actual backend message
          toast.error(t('team.toastMessages.error'), {
            description: errorMessage,
          });
          break;
      }
    } finally {
      setResendingInvitationId(null);
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    if (!currentOrganization) return;

    try {
      await invitationAPI.revoke(currentOrganization.id, invitationId);
      await loadInvitations();
      toast.success(t('team.toastMessages.invitationRevoked'), {
        description: t('team.toastMessages.invitationRevokedDescription'),
      });
    } catch (err: any) {
      // Check for specific error codes from backend
      const errorCode = err.response?.data?.errorCode;
      const errorMessage = err.response?.data?.message || err.message || t('team.errorMessages.failedToRevokeInvitation');

      // For revokeInvitation, plan limits shouldn't typically apply, but handle other specific errors if needed
      toast.error(t('team.toastMessages.error'), {
        description: errorMessage,
      });
    } finally {
      setRevokeDialogOpen(false);
      setInvitationToRevoke(null);
    }
  };

  useEffect(() => {
    loadTeamMembers();
    loadInvitations();
  }, [currentOrganization, activeTab]);

  useEffect(() => {
    // Update URL when tab changes
    router.replace(`/team?tab=${activeTab}`, { scroll: false });
  }, [activeTab, router]);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="w-4 h-4" />;
      case "ACCEPTED":
        return <CheckCircle className="w-4 h-4" />;
      case "EXPIRED":
        return <XCircle className="w-4 h-4" />;
      case "REVOKED":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "ACCEPTED":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "EXPIRED":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "REVOKED":
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800";
    }
  };

  const canManageTeam =
    currentOrganization?.role === "OWNER" ||
    currentOrganization?.role === "ADMIN";

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


  //TODO: Review it
  if (!currentOrganization || loadingMembers || loadingInvitations) {
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
            {t('team.description')}
          </p>
        </div>
        {canManageTeam && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <PlanLimitWrapper
              resourceType="team_members"
              onAction={() => setInviteDialogOpen(true)}
            >
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t('team.inviteMember')}
                </Button>
              </DialogTrigger>
            </PlanLimitWrapper>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('team.inviteDialog.title')}</DialogTitle>
                <DialogDescription>
                  {t('team.inviteDialog.description', { organizationName: currentOrganization?.name })}
                </DialogDescription>
              </DialogHeader>

              <Formik
                initialValues={{
                  email: "",
                  role: "MEMBER" as "ADMIN" | "MEMBER",
                }}
                validationSchema={toFormikValidationSchema(InvitationFormSchema)}
                onSubmit={sendInvitation}
              >
                {({ values, setFieldValue, isSubmitting, errors, touched }) => (
                  <Form className="space-y-4 px-1" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('team.inviteDialog.emailLabel')}</Label>
                      <Field
                        as={Input}
                        id="email"
                        name="email"
                        type="email"
                        placeholder={t('team.inviteDialog.emailPlaceholder')}
                        className={errors.email && touched.email ? "border-red-500" : ""}
                      />
                      <ErrorMessage
                        name="email"
                        component="div"
                        className="text-sm text-red-500 mt-1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">{t('team.inviteDialog.roleLabel')}</Label>
                      <Select
                        value={values.role}
                        onValueChange={(value: "ADMIN" | "MEMBER") =>
                          setFieldValue("role", value)
                        }
                      >
                        <SelectTrigger
                          className={errors.role && touched.role ? "border-red-500" : ""}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MEMBER">{t('team.inviteDialog.memberOption')}</SelectItem>
                          <SelectItem value="ADMIN">{t('team.inviteDialog.adminOption')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <ErrorMessage
                        name="role"
                        component="div"
                        className="text-sm text-red-500 mt-1"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      {isSubmitting ? t('team.inviteDialog.sending') : t('team.inviteDialog.sendButton')}
                    </Button>
                  </Form>
                )}
              </Formik>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.confirmDialogs.revokeInvitation.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('team.confirmDialogs.revokeInvitation.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('team.confirmDialogs.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => invitationToRevoke && revokeInvitation(invitationToRevoke)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('team.confirmDialogs.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <Tabs value={activeTab} onValueChange={setActiveTab} >
        <TabsList className="inline-flex gap-2 w-auto align-middle">
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{t('team.members')}</span>
            <Badge variant="secondary" className="ml-1">
              {members.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="invitations" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>{t('team.invitations')}</span>
            <Badge variant="secondary" className="ml-1">
              {invitations.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <Card>
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
                <div className="space-y-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50"
                    >
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(member.user.name, member.user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium">
                              {member.user.name || t('team.noName')}
                            </h3>
                            <Badge
                              className={`text-xs ${getRoleColor(member.role)}`}
                            >
                              <span className="flex items-center space-x-1">
                                <span className="text-current">{getRoleIcon(member.role)}</span>
                                <span>{member.role}</span>
                              </span>
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            <span>{member.user.email}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t('team.joined')} {formatDate(member.joinedAt)}
                          </p>
                        </div>
                      </div>

                      {canManageTeam && member.role !== "OWNER" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {member.role !== "ADMIN" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateMemberRole(member.id, "ADMIN")
                                }
                              >
                                {t('team.actions.promoteToAdmin')}
                              </DropdownMenuItem>
                            )}
                            {member.role === "ADMIN" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateMemberRole(member.id, "MEMBER")
                                }
                              >
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
                    </div>
                  ))}

                  {members.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        {t('team.emptyStates.noMembers')}
                      </p>
                      {canManageTeam && (
                        <Button onClick={() => setInviteDialogOpen(true)}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          {t('team.emptyStates.inviteFirstMember')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loadingInvitations ? (
                <div className="space-y-4">
                  {Array(3).fill(0).map((_, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Skeleton className="h-8 w-8" />
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-5 w-16" />
                          </div>
                          <Skeleton className="h-3 w-32" />
                          <div className="flex items-center space-x-4">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <Mail className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium">{invitation.email}</h3>
                            <Badge
                              className={`text-xs ${getStatusColor(
                                invitation.status
                              )}`}
                            >
                              <span className="flex items-center space-x-1">
                                {getStatusIcon(invitation.status)}
                                <span>{invitation.status}</span>
                              </span>
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {invitation.role}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t('team.invitationDetails.invitedBy')}{" "}
                            {invitation.inviter.name ||
                              invitation.inviter.email}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>
                              {t('team.invitationDetails.sent')}{" "}
                              {new Date(
                                invitation.createdAt
                              ).toLocaleDateString()}
                            </span>
                            <span>
                              {t('team.invitationDetails.expires')}{" "}
                              {new Date(
                                invitation.expiresAt
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {canManageTeam && invitation.status === "PENDING" && (
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resendInvitation(invitation.id)}
                            disabled={resendingInvitationId === invitation.id}
                          >
                            {resendingInvitationId === invitation.id ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                {t('team.actions.resend')}
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4 mr-1" />
                                {t('team.actions.resend')}
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRevokeDialogOpen(true);
                              setInvitationToRevoke(invitation.id);
                            }}
                            className="text-destructive"
                          >
                            {t('team.actions.revoke')}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {invitations.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        {t('team.emptyStates.noInvitations')}
                      </p>
                      {canManageTeam && (
                        <Button onClick={() => setInviteDialogOpen(true)}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          {t('team.emptyStates.sendFirstInvitation')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
