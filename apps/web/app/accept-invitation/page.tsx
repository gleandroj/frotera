"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { invitationAPI } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { AlertCircle, LogOut, Users, Shield, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/useTranslation";
import { LanguageSwitcherLink } from "@/components/ui/language-switcher-link";
import { Logo } from "@/components/icons/logo";

interface InvitationData {
  email: string;
  role: string;
  expiresAt: string;
  organization: {
    name: string;
    description?: string;
  };
  inviter: {
    name?: string;
    email: string;
  };
}

interface InvitationResponse {
  invitation: InvitationData;
  userExists: boolean;
}

export default function AcceptInvitationPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    user,
    isLoading: isAuthLoading,
    isAuthenticated,
    logout,
    refreshAndSwitchOrganization,
  } = useAuth();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(
    null
  );
  const [emailMismatch, setEmailMismatch] = useState(false);
  const [userExists, setUserExists] = useState(false);

  const loadInvitationDetails = async () => {
    if (!token) {
      toast.error(t('invitation.invalidInvitation'), {
        description: t('invitation.invalidInvitationDescription'),
      });
      router.push("/login");
      return;
    }

    try {
      const { data } = (await invitationAPI.check(token)) as {
        data: InvitationResponse;
      };
      setInvitationData(data.invitation);
      setUserExists(data.userExists);

      if (user && user.email !== data.invitation.email) {
        setEmailMismatch(true);
        return;
      }
    } catch (err: any) {
      // Check for specific API error responses during loading
      const apiError = err.response?.data?.error;

      if (apiError === "Invitation already accepted") {
        toast.info(t('invitation.invitationAlreadyAccepted'));
        router.push(isAuthenticated ? "/dashboard" : "/login");
      } else {
        // Handle all other errors by redirecting to login with a toast
        toast.error(t('invitation.errorLoadingInvitation'), {
          description:
            apiError || t('invitation.errorLoadingInvitationDescription'),
        });
      }
    }
  };

  const acceptInvitation = async () => {
    if (!token || !invitationData) return;

    setLoading(true);

    try {
      // For existing users, we don't need to pass any additional data
      const result = await invitationAPI.accept(token);

      // Use the atomic operation to refresh and switch organizations
      await refreshAndSwitchOrganization(result.data.organization.id);

      toast.success(result.data.message);
      router.push("/dashboard");
    } catch (err: any) {
      // Check for specific API error responses
      const apiError = err.response?.data?.error;
      const message = apiError || err.message || t('invitation.failedToAcceptInvitation');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    router.push(
      `/login?token=${token}&redirect=${encodeURIComponent(
        window.location.href
      )}`
    );
  };

  const handleLogout = async () => {
    try {
      if (isAuthenticated) {
        await logout(false);
      }
      handleSignIn();
    } catch (err) {
      toast.error(t('invitation.failedToLogOut'));
    }
  };

  const handleCreateAccount = async () => {
    try {
      if (isAuthenticated) {
        await logout();
      }
      router.push(`/signup?token=${token}`);
    } catch (err) {
      toast.error(t('invitation.failedToLogOut'));
    }
  };

  useEffect(() => {
    if (!isAuthLoading) {
      loadInvitationDetails();
    }
  }, [token, isAuthLoading, user]);

  // Helper component for loading states with two-column layout
  const LoadingState = ({ text }: { text: string }) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-20 xl:px-24 bg-gradient-to-br from-purple-600 to-blue-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center mb-8">
            <Logo variant="light" size="lg" showTagline />
          </div>
          <div className="space-y-6 text-white">
            <h2 className="text-4xl font-bold leading-tight">
              {t('invitation.acceptInvitation')}
            </h2>
            <p className="text-xl text-purple-100 leading-relaxed">
              {text}
            </p>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12">
          <div className="w-96 h-96 bg-white/5 rounded-full"></div>
        </div>
        <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12">
          <div className="w-64 h-64 bg-white/5 rounded-full"></div>
        </div>
      </div>

      {/* Right side - Loading */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="lg:hidden mb-8">
            <div className="flex items-center justify-center mb-6">
              <Logo variant="auto" size="md" />
            </div>
          </div>
          <Card className="w-full border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-center text-foreground">{text}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  if (isAuthLoading) {
    return <LoadingState text={t('loading.loadingConfiguration')} />;
  }

  if (loading) {
    return <LoadingState text={t('loading.settingUpWorkspace')} />;
  }

  if (!invitationData) {
    return <LoadingState text={t('loading.loadingInvitationDetails')} />;
  }

  if (emailMismatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-20 xl:px-24 bg-gradient-to-br from-purple-600 to-blue-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <div className="flex items-center mb-8">
              <Logo variant="light" size="lg" showTagline />
            </div>
            <div className="space-y-6 text-white">
              <h2 className="text-4xl font-bold leading-tight">
                {t('invitation.joinOrganization')} {invitationData?.organization.name}
              </h2>
              <p className="text-xl text-purple-100 leading-relaxed">
                {t('invitation.accountMismatchDescription')}
              </p>
              <div className="grid grid-cols-1 gap-4 pt-8">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-lg">{t('invitation.organization')}: {invitationData?.organization.name}</span>
                </div>
                {invitationData?.role && (
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-lg">{t('invitation.role')}: {invitationData.role}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12">
            <div className="w-96 h-96 bg-white/5 rounded-full"></div>
          </div>
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12">
            <div className="w-64 h-64 bg-white/5 rounded-full"></div>
          </div>
        </div>

        {/* Right side - Email Mismatch Card */}
        <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm lg:w-96">
            <div className="lg:hidden mb-8">
              <div className="flex items-center justify-center mb-6">
                <Logo variant="auto" size="md" />
              </div>
            </div>
            <div className="w-full">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-6 w-6 text-orange-500" />
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {t('invitation.accountMismatch')}
                  </h2>
                </div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {t('invitation.accountMismatchDescription')}
                </p>
              </div>

              <Card className="w-full border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-6 space-y-4">
                      <div>
                        <h3 className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
                          {t('invitation.currentAccount')}
                        </h3>
                        <div className="bg-white dark:bg-gray-800 rounded-md p-3 border border-orange-200 dark:border-orange-700">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('invitation.currentlyLoggedInAs')}{" "}
                            <span className="font-medium text-gray-900 dark:text-gray-100 overflow-hidden text-ellipsis">
                              {user?.email}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
                          {t('invitation.invitationDetails')}
                        </h3>
                        <div className="bg-white dark:bg-gray-800 rounded-md p-3 border border-orange-200 dark:border-orange-700">
                          <p className="text-sm text-gray-600 dark:text-gray-400 overflow-hidden text-ellipsis">
                            {t('invitation.thisInvitationIsFor')}{" "}
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {invitationData?.email}
                            </span>
                          </p>
                          {invitationData?.organization && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                              {t('invitation.organization')}:{" "}
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {invitationData.organization.name}
                              </span>
                              {invitationData.role && (
                                <span className="text-gray-500 dark:text-gray-400">
                                  {" "}
                                  • {invitationData.role}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {userExists ? (
                        <Button
                          onClick={handleLogout}
                          variant="outline"
                          className="w-full h-12 border-blue-200 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          {t('invitation.useDifferentAccount')}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleCreateAccount}
                          className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] whitespace-normal"
                        >
                          {t('invitation.createAccount')}
                        </Button>
                      )}
                    </div>

                    <div className="text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('invitation.needHelp')}{" "}
                        <Link
                          href="/support"
                          className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        >
                          {t('invitation.contactSupport')}
                        </Link>
                      </p>
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-center">
                      <LanguageSwitcherLink />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-20 xl:px-24 bg-gradient-to-br from-purple-600 to-blue-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center mb-8">
            <Logo variant="light" size="lg" showTagline />
          </div>
          <div className="space-y-6 text-white">
            <h2 className="text-4xl font-bold leading-tight">
              {t('invitation.joinOrganization')} {invitationData?.organization.name}
            </h2>
            <p className="text-xl text-purple-100 leading-relaxed">
              {invitationData?.organization.description ||
                `${t('invitation.invitationDetails')} - ${t('invitation.role')}: ${invitationData?.role}`}
            </p>
            <div className="grid grid-cols-1 gap-4 pt-8">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg">{t('invitation.organization')}: {invitationData?.organization.name}</span>
              </div>
              {invitationData?.role && (
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-lg">{t('invitation.role')}: {invitationData.role}</span>
                </div>
              )}
              {invitationData?.inviter && (
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-lg">{t('invitation.invitedBy')}: {invitationData.inviter.name || invitationData.inviter.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12">
          <div className="w-96 h-96 bg-white/5 rounded-full"></div>
        </div>
        <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12">
          <div className="w-64 h-64 bg-white/5 rounded-full"></div>
        </div>
      </div>

      {/* Right side - Invitation Card */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="lg:hidden mb-8">
            <div className="flex items-center justify-center mb-6">
              <Logo variant="auto" size="md" />
            </div>
          </div>
          <div className="w-full">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t('invitation.acceptInvitation')}
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {t('invitation.joinOrganization')} {invitationData?.organization.name}
              </p>
            </div>

            <Card className="w-full border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6 space-y-3">
                    <h3 className="font-medium text-blue-900 dark:text-blue-100">
                      {t('invitation.invitationDetails')}
                    </h3>
                    <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <p>
                        <strong>{t('invitation.email')}:</strong> {invitationData?.email}
                      </p>
                      <p>
                        <strong>{t('invitation.organization')}:</strong>{" "}
                        {invitationData?.organization.name}
                      </p>
                      <p>
                        <strong>{t('invitation.role')}:</strong> {invitationData?.role}
                      </p>
                      <p>
                        <strong>{t('invitation.invitedBy')}:</strong>{" "}
                        {invitationData?.inviter.name || invitationData?.inviter.email}
                      </p>
                      <p>
                        <strong>{t('invitation.expires')}:</strong>{" "}
                        {invitationData?.expiresAt
                          ? new Date(invitationData.expiresAt).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  {loading && (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="mt-2 text-sm text-muted-foreground">{t('invitation.processing')}</p>
                    </div>
                  )}

                  {!loading && (
                    <div className="space-y-2">
                      {!user ? (
                        userExists ? (
                          <Button onClick={handleSignIn} className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]">
                            {t('invitation.logInToAccept')}
                          </Button>
                        ) : (
                          <Button onClick={handleCreateAccount} className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]">
                            {t('invitation.createAccount')}
                          </Button>
                        )
                      ) : (
                        <Button onClick={acceptInvitation} className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]">
                          {t('invitation.acceptInvitation')}
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-center">
                    <LanguageSwitcherLink />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
