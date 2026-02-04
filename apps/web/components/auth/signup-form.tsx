"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcherLink } from "@/components/ui/language-switcher-link";
import { authAPI, invitationAPI } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadingSpinner } from "../ui/loading-spinner";
import { useTranslation } from "@/i18n/useTranslation";

interface InvitationData {
  email: string;
  role: string;
  organization: {
    name: string;
    description?: string;
  };
  inviter: {
    name?: string;
    email: string;
  };
}

export function SignupForm() {
  const { t, currentLanguage } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [invitationDetails, setInvitationDetails] =
    useState<InvitationData | null>(null);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("token");

  const [isLoadingInvitation, setIsLoadingInvitation] =
    useState(!!invitationToken);

  // Fetch invitation details if we have a token
  useEffect(() => {
    const fetchInvitationDetails = async () => {
      if (!invitationToken) return;

      setIsLoadingInvitation(true);
      try {
        const { data } = await invitationAPI.check(invitationToken);
        setInvitationDetails(data.invitation);
        setEmail(data.invitation.email); // Pre-fill email from invitation
      } catch (error: any) {
        const errorCode = error.response?.data?.errorCode;
        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          t('invitation.errorLoadingInvitationDescription');

        // Check for specific error codes that indicate invalid/expired invitation
        if (
          errorCode === 'INVALID_INVITATION_TOKEN' ||
          errorCode === 'INVITATION_EXPIRED' ||
          error.response?.status === 400
        ) {
          // Show error message and redirect to signup without token
          toast.error(t('invitation.invalidInvitation'), {
            description: t('invitation.invalidInvitationDescription'),
          });
          // Redirect to signup page without the token parameter
          router.push("/signup");
        } else if (errorCode === 'INVITATION_ALREADY_ACCEPTED' || errorMessage === t('invitation.invitationAlreadyAccepted')) {
          toast.info(t('invitation.invitationAlreadyAccepted'));
          router.push("/dashboard");
        } else {
          // For other errors, show the error message
          toast.error(errorMessage);
        }
      } finally {
        setIsLoadingInvitation(false);
      }
    };

    fetchInvitationDetails();
  }, [invitationToken, router, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // If we have an invitation token, use the invitation accept endpoint
      if (invitationToken) {
        await invitationAPI.accept(invitationToken, {
          password,
          name: name || undefined,
        });

        // After successful signup and invitation acceptance, log the user in
        await login(email, password);
        router.push("/dashboard");
        return;
      }

      // Regular signup flow
      await authAPI.signup(
        email, 
        password, 
        name || undefined, 
        currentLanguage,
        organizationName || undefined
      );

      // Show success message and redirect to login
      toast.success(t('auth.accountCreatedSuccess'));
      router.push("/login");
    } catch (error: any) {
      const code = error.response?.data?.errorCode;
      const errorMessage = code ? t(`auth.${code}`) :
        code || error.message || t('auth.signupError');
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (invitationToken && !invitationDetails && isLoadingInvitation) {
    return <LoadingSpinner text={t('loading.loadingInvitationDetails')} />;
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          {invitationToken ? t('auth.signupTitle') : t('auth.signupTitle')}
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {invitationToken
            ? invitationDetails
              ? `${t('invitation.joinOrganization')} ${invitationDetails.organization.name} ${invitationDetails.role}`
              : t('organizations.setupFirstOrganization')
            : t('auth.description')}
        </p>
      </div>

      <Card className="w-full border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {invitationToken && invitationDetails && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6 space-y-3">
                <h3 className="font-medium text-blue-900 dark:text-blue-100">
                  {t('invitation.invitationDetails')}
                </h3>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <p>
                    <strong>{t('invitation.organization')}:</strong>{" "}
                    {invitationDetails.organization.name}
                  </p>
                  <p>
                    <strong>{t('invitation.role')}:</strong> {invitationDetails.role}
                  </p>
                  <p>
                    <strong>{t('invitation.invitedBy')}:</strong>{" "}
                    {invitationDetails.inviter.name ||
                      invitationDetails.inviter.email}
                  </p>
                  {invitationDetails.organization.description && (
                    <p className="mt-2 text-blue-600 dark:text-blue-400">
                      {invitationDetails.organization.description}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('common.email')}
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                disabled={!!invitationToken}
                className="h-12 px-4 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('auth.nameOptional')}
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.namePlaceholder')}
                className="h-12 px-4 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('auth.passwordLabel')}
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                className="h-12 px-4 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800"
              />
            </div>

            {!invitationToken && (
              <div className="space-y-2">
                <Label htmlFor="organizationName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('organizations.organizationName')}
                </Label>
                <Input
                  id="organizationName"
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder={name || email.split('@')[0] || t('organizations.organizationNamePlaceholder')}
                  className="h-12 px-4 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{t('auth.creatingAccount')}</span>
                </div>
              ) : (
                t('auth.signupButton')
              )}
            </Button>

            {!invitationToken && (
              <div className="text-center text-sm space-y-4">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t('auth.hasAccount')}</span>{" "}
                  <Link
                    href="/login"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    {t('auth.switchToLogin')}
                  </Link>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-center">
              <LanguageSwitcherLink />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
