"use client";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTranslation } from "@/i18n/useTranslation";
import { authAPI } from "@/lib/frontend/api-client";
import { AxiosError } from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const verificationExecuted = useRef(false);

  useEffect(() => {
    // Prevent duplicate execution in development mode
    if (verificationExecuted.current) return;

    const token = searchParams.get("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const verifyEmail = async () => {
      if (verificationExecuted.current) return;
      verificationExecuted.current = true;

      try {
        await authAPI.verifyEmail(token);
        toast.success(t('auth.emailVerification.success'));
        router.push("/login");
      } catch (error) {
        router.push("/login");
        toast.error(
          error instanceof AxiosError
            ? error.response?.data?.error
            : t('auth.emailVerification.failed')
        );
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return <LoadingSpinner text={t('loading.verifyingEmail')} />;
}
