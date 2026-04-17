"use client";

import { use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { ChecklistFillForm } from "../../checklist-fill-form";

export default function FillChecklistPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(params);
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrganization, selectedCustomerId } = useAuth();

  const vehicleId = searchParams.get("vehicleId");
  const driverId = searchParams.get("driverId");

  if (!currentOrganization?.id) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("checklist.fillChecklist")}</h1>
        </div>
        <div className="text-center text-muted-foreground">{t("common.selectOrganization")}</div>
      </div>
    );
  }

  return (
    <ChecklistFillForm
      templateId={templateId}
      organizationId={currentOrganization.id}
      selectedCustomerId={selectedCustomerId}
      initialVehicleId={vehicleId}
      initialDriverId={driverId}
      variant="page"
      onSuccess={() => router.push("/dashboard/checklist?tab=entries")}
      onCancel={() => router.back()}
      onLoadError={() => router.push("/dashboard/checklist")}
    />
  );
}
