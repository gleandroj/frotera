"use client";

import { ProfileForm } from "@/components/profile/profile-form";
import { TwoFactorSettings } from "@/components/profile/two-factor-settings";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/i18n/useTranslation";

export default function ProfileSettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('settings.profile.title')}</h1>
        <p className="text-muted-foreground">
          {t('settings.profile.description')}
        </p>
      </div>

      <ProfileForm />

      <Separator />

      <TwoFactorSettings />
    </div>
  );
}
