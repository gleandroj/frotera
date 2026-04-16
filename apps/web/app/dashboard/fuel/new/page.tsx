"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelAPI, CreateFuelLogPayload } from "@/lib/frontend/api-client";
import { FuelForm } from "../components/fuel-form";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NewFuelPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentOrganization } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (payload: CreateFuelLogPayload) => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      await fuelAPI.create(currentOrganization.id, payload);
      toast.success(t('fuel.toastCreated'));
      router.push('/dashboard/fuel');
    } catch (err) {
      console.error('Failed to create fuel log:', err);
      toast.error(t('fuel.toastError'));
    } finally {
      setLoading(false);
    }
  };

  if (!currentOrganization?.id) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('fuel.newLog')}</h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t('common.selectOrganization')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('fuel.backToList')}
        </Button>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('fuel.newLog')}</h1>
      </div>
      <div className="max-w-2xl">
        <FuelForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  );
}
