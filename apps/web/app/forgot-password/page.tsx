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
import { forgotPassword } from "@/lib/api/auth";
import { AxiosError } from "axios";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const { t, currentLanguage } = useTranslation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await forgotPassword({
        email,
        language: currentLanguage
      });
      setIsSubmitted(true);
      toast.success(response.message);
    } catch (error) {
      if (error instanceof AxiosError) {
        const errorData = error.response?.data;
        toast.error(errorData?.error || "Failed to send password reset email");
      } else {
        toast.error("Failed to send password reset email");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
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
                {t("auth.forgotPassword.emailSent.title")}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                {t("auth.forgotPassword.emailSent.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <Link
                  href="/login"
                  className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  {t("auth.forgotPassword.emailSent.backToLogin")}
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
              {t("auth.forgotPassword.title")}
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              {t("auth.forgotPassword.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("auth.forgotPassword.emailAddress")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.forgotPassword.emailPlaceholder")}
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
                    <span>{t("auth.forgotPassword.sending")}</span>
                  </div>
                ) : (
                  t("auth.forgotPassword.sendResetLink")
                )}
              </Button>

              <div className="text-center text-sm space-y-4">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t("auth.forgotPassword.rememberPassword")}</span>{" "}
                  <Link
                    href="/login"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    {t("auth.forgotPassword.backToLogin")}
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
