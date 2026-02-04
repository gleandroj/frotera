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
import { resetPassword } from "@/lib/api/auth";
import { AxiosError } from "axios";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("Invalid reset link");
      router.push("/forgot-password");
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!token) {
      toast.error("Invalid reset token");
      return;
    }

    setIsLoading(true);

    try {
      const response = await resetPassword({ token, password });
      setIsCompleted(true);
      toast.success(response.message);
    } catch (error) {
      if (error instanceof AxiosError) {
        const errorData = error.response?.data;
        toast.error(errorData?.error || "Failed to reset password");
      } else {
        toast.error("Failed to reset password");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                {t("auth.resetPassword.success.title")}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                {t("auth.resetPassword.success.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Button
                onClick={() => router.push("/login")}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              >
                {t("auth.resetPassword.success.continueToLogin")}
              </Button>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <LanguageSwitcherLink />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                {t("auth.resetPassword.invalidToken.title")}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                {t("auth.resetPassword.invalidToken.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Link
                href="/forgot-password"
                className="block w-full"
              >
                <Button className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]">
                  {t("auth.resetPassword.invalidToken.requestNewLink")}
                </Button>
              </Link>
              <div className="text-center">
                <Link
                  href="/login"
                  className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  {t("auth.resetPassword.invalidToken.backToLogin")}
                </Link>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <LanguageSwitcherLink />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded"></div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t("auth.branding.companyName")}
            </h1>
          </div>
        </div>

        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              {t("auth.resetPassword.title")}
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              {t("auth.resetPassword.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("auth.resetPassword.newPassword")}
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.resetPassword.newPasswordPlaceholder")}
                  className="h-12 px-4 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("auth.resetPassword.confirmNewPassword")}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.resetPassword.confirmNewPasswordPlaceholder")}
                  className="h-12 px-4 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800"
                />
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p>{t("auth.resetPassword.passwordRequirements.title")}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t("auth.resetPassword.passwordRequirements.length")}</li>
                  <li>{t("auth.resetPassword.passwordRequirements.uppercase")}</li>
                  <li>{t("auth.resetPassword.passwordRequirements.number")}</li>
                  <li>{t("auth.resetPassword.passwordRequirements.special")}</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{t("auth.resetPassword.resettingPassword")}</span>
                  </div>
                ) : (
                  t("auth.resetPassword.resetPassword")
                )}
              </Button>

              <div className="text-center text-sm space-y-4">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t("auth.resetPassword.rememberPassword")}</span>{" "}
                  <Link
                    href="/login"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    {t("auth.resetPassword.backToLogin")}
                  </Link>
                </div>
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <LanguageSwitcherLink />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
