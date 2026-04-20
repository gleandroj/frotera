"use client";

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
import { useTranslation } from "@/i18n/useTranslation";
import { useAuth } from "@/lib/hooks/use-auth";
import { AxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

type AuthStep = "login" | "2fa";

export type AuthFormProps = {
  signupEnabled: boolean;
  redirect?: string;
  signupDisabledParam?: string;
};

export function AuthForm({ signupEnabled, redirect, signupDisabledParam }: AuthFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  const resolvePostLoginRedirect = (mustChangePassword?: boolean) => {
    if (mustChangePassword) {
      router.replace("/change-password");
      return;
    }

    if (redirect) {
      router.replace(redirect);
      return;
    }

    router.replace("/dashboard");
  };

  useEffect(() => {
    if (signupDisabledParam === "disabled") {
      toast.info(t("auth.signupDisabled"));
    }
  }, [signupDisabledParam, t]);

  // Form state
  const [step, setStep] = useState<AuthStep>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data } = await login(email, password);

      // Keep post-login destination aligned with mustChangePassword flag
      resolvePostLoginRedirect(data?.user?.mustChangePassword);
    } catch (error) {
      if (error instanceof AxiosError) {
        const errorData = error.response?.data;
        const code = errorData?.errorCode;
        const errorMessage = code ? t(`auth.${code}`) :
          code || errorData?.error || t('auth.invalidCredentials');
        // Check for 2FA requirement (403 status)
        if (error.response?.status === 403 && errorData?.requires2FA) {
          setStep("2fa");
          setIsLoading(false);
          return;
        }
        toast.error(errorMessage);
      } else {
        toast.error(error instanceof Error ? error.message : t('auth.invalidCredentials'));
      }
      setIsLoading(false);
    }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data } = await login(email, password, code);
      // Keep post-login destination aligned with mustChangePassword flag
      resolvePostLoginRedirect(data?.user?.mustChangePassword);
    } catch (error) {
      let message = "";
      if (error instanceof AxiosError) {
        message = error.response?.data?.error;
      }
      message =
        message ||
        (error instanceof Error ? error.message : "2FA verification failed");
      toast.error(message);
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setStep("login");
    setCode("");
  };

  if (step === "2fa") {
    return (
      <div className="w-full">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("auth.2faTitle")}
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("auth.2faDescription")}
          </p>
        </div>

        <Card className="w-full border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
          <CardContent className="p-8">
            <form onSubmit={handle2FA} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("auth.2faVerificationCode")}
                </Label>
                <Input
                  id="code"
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                  placeholder={t("auth.2faVerificationCodePlaceholder")}
                  maxLength={6}
                  pattern="\d{6}"
                  className="h-12 px-4 text-center tracking-widest text-lg border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>{t("auth.verifying")}</span>
                    </div>
                  ) : (
                    t("auth.verify")
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                  className="h-12 px-6 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {t("common.back")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t("auth.title")}
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {t("auth.description")}
        </p>
      </div>

      <Card className="w-full border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <CardContent className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("auth.emailLabel")}
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="h-12 px-4 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("auth.passwordLabel")}
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordLabel')}
                className="h-12 px-4 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{t("auth.signingIn")}</span>
                </div>
              ) : (
                t("auth.loginButton")
              )}
            </Button>

            <div className="text-center text-sm space-y-4">
              <div>
                <Link
                  href="/forgot-password"
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  {t("auth.forgotPasswordLink")}
                </Link>
              </div>
              {signupEnabled && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t("auth.noAccount")}</span>{" "}
                  <Link
                    href="/signup"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    {t("auth.switchToSignup")}
                  </Link>
                </div>
              )}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <LanguageSwitcherLink />
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
