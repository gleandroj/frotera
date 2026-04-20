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
import { useTranslation } from "@/i18n/useTranslation";
import { authAPI } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error(t("auth.changePasswordRequired.toast.newPasswordMinLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("auth.changePasswordRequired.toast.passwordsDoNotMatch"));
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      await refreshUser();
      toast.success(t("auth.changePasswordRequired.toast.passwordChangedSuccessfully"));
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        if (status === 401) {
          toast.error(t("auth.changePasswordRequired.toast.currentPasswordIncorrect"));
        } else {
          toast.error(t("auth.changePasswordRequired.toast.failedToChangePassword"));
        }
      } else {
        toast.error(t("auth.changePasswordRequired.toast.failedToChangePassword"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <div className="w-6 h-6 bg-white rounded"></div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("auth.branding.companyName")}</h1>
        </div>

        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              {t("auth.changePasswordRequired.title")}
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              {t("auth.changePasswordRequired.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("auth.changePasswordRequired.currentPassword")}
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t("auth.changePasswordRequired.currentPasswordPlaceholder")}
                  className="h-12 px-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("auth.changePasswordRequired.newPassword")}
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("auth.changePasswordRequired.newPasswordPlaceholder")}
                  className="h-12 px-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("auth.changePasswordRequired.confirmNewPassword")}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.changePasswordRequired.confirmNewPasswordPlaceholder")}
                  className="h-12 px-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{t("auth.changePasswordRequired.changing")}</span>
                  </div>
                ) : (
                  t("auth.changePasswordRequired.submit")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
