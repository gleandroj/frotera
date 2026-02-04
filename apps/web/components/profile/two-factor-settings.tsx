"use client";

import type React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authAPI } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { AlertTriangle, ShieldCheck, ShieldOff } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/useTranslation";

type TwoFactorStep = "initial" | "setup" | "verifyEnable" | "confirmDisable";

export function TwoFactorSettings() {
  const { t } = useTranslation();
  const { user, refreshUser, isLoading: isAuthLoading, setTokens } = useAuth();
  const [step, setStep] = useState<TwoFactorStep>("initial");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [manualEntryKey, setManualEntryKey] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Reset component state if user's 2FA status changes externally
    setStep("initial");
    setQrCode(null);
    setManualEntryKey(null);
    setVerificationCode("");
  }, [user?.twoFactorEnabled]);

  const handleInitiateEnable2FA = async () => {
    setIsSubmitting(true);
    try {
      const response = await authAPI.setup2FA();
      setQrCode(response.data.qrCode);
      setManualEntryKey(response.data.manualEntryKey);
      setStep("setup");
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || t('twoFactor.setupFailed')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAndEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      toast.error(t('twoFactor.enterVerificationCode'));
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await authAPI.verify2FA(verificationCode, true);
      // Store the new tokens using auth context
      setTokens(
        response.data.tokens.accessToken,
        response.data.tokens.refreshToken
      );
      toast.success(t('twoFactor.setupSuccess'));
      await refreshUser();
      setStep("initial");
    } catch (error: any) {
      console.error("2FA Enable Error:", error);
      const errorMessage = error.response?.data?.error || t('twoFactor.invalidCode');
      console.log("Error message:", errorMessage);
      toast.error(errorMessage, {
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
      setVerificationCode("");
    }
  };

  const handleInitiateDisable2FA = () => {
    setStep("confirmDisable");
  };

  const handleVerifyAndDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      toast.error(t('twoFactor.enterVerificationCode'));
      return;
    }
    setIsSubmitting(true);
    try {
      await authAPI.disable2FA(verificationCode);
      toast.success(t('twoFactor.disableSuccess'));
      await refreshUser();
      setStep("initial");
    } catch (error: any) {
      console.error("2FA Disable Error:", error);
      const errorMessage = error.response?.data?.error || t('twoFactor.disableFailed');
      console.log("Error message:", errorMessage);
      toast.error(errorMessage, {
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
      setVerificationCode("");
    }
  };

  if (isAuthLoading || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('twoFactor.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-muted rounded w-1/2 animate-pulse mb-4"></div>
          <div className="h-10 bg-muted rounded w-1/4 animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('twoFactor.title')}</CardTitle>
        <CardDescription>
          {t('twoFactor.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === "initial" && (
          <div>
            {user.twoFactorEnabled ? (
              <Alert
                variant="default"
                className="bg-green-50 border-green-200 text-green-700"
              >
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <AlertTitle className="text-green-800">
                  {t('twoFactor.enabled')}
                </AlertTitle>
                <AlertDescription className="text-green-700">
                  {t('twoFactor.enabledDescription')}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert
                variant="destructive"
                className="bg-yellow-50 border-yellow-200 text-yellow-700"
              >
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <AlertTitle className="text-yellow-800">
                  {t('twoFactor.disabled')}
                </AlertTitle>
                <AlertDescription className="text-yellow-700">
                  {t('twoFactor.disabledDescription')}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "setup" && qrCode && manualEntryKey && (
          <div className="space-y-4">
            <p>
              {t('twoFactor.scanQrCode')}
            </p>
            <div className="flex justify-center p-4 bg-card rounded-md border">
              <Image
                src={qrCode || "/placeholder.svg"}
                alt={t('twoFactor.qrCodeAlt')}
                width={200}
                height={200}
              />
            </div>
            <p>{t('twoFactor.manualEntry')}</p>
            <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
              {manualEntryKey}
            </div>
            <form onSubmit={handleVerifyAndEnable2FA} className="space-y-4">
              <div>
                <Label htmlFor="verificationCodeEnable">
                  {t('twoFactor.verificationCode')}
                </Label>
                <Input
                  id="verificationCodeEnable"
                  type="text"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\s/g, ""))
                  }
                  placeholder={t('twoFactor.enterSixDigitCode')}
                  maxLength={6}
                  pattern="\d{6}"
                  required
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('twoFactor.verifying') : t('twoFactor.verifyAndEnable')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep("initial")}
                  disabled={isSubmitting}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </div>
        )}

        {step === "confirmDisable" && (
          <form onSubmit={handleVerifyAndDisable2FA} className="space-y-4">
            <p>
              {t('twoFactor.confirmDisable')}
            </p>
            <div>
              <Label htmlFor="verificationCodeDisable">{t('twoFactor.verificationCode')}</Label>
              <Input
                id="verificationCodeDisable"
                type="text"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\s/g, ""))
                }
                placeholder={t('twoFactor.enterSixDigitCode')}
                maxLength={6}
                pattern="\d{6}"
                required
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('twoFactor.disabling') : t('twoFactor.confirmAndDisable')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("initial")}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
      {step === "initial" && (
        <CardFooter>
          {user.twoFactorEnabled ? (
            <Button
              variant="destructive"
              onClick={handleInitiateDisable2FA}
              disabled={isSubmitting}
            >
              <ShieldOff className="mr-2 h-4 w-4" /> {t('twoFactor.disable2FA')}
            </Button>
          ) : (
            <Button onClick={handleInitiateEnable2FA} disabled={isSubmitting}>
              <ShieldCheck className="mr-2 h-4 w-4" /> {t('twoFactor.enable2FA')}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
