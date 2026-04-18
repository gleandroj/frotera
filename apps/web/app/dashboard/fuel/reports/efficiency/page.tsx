"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelReportsAPI, VehicleEfficiency } from "@/lib/frontend/api-client";
import { EfficiencyTable } from "../components/efficiency-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export default function EfficiencyReportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const [data, setData] = useState<VehicleEfficiency[]>([]);
  const [threshold, setThreshold] = useState(15);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    fuelReportsAPI.efficiency(currentOrganization.id, {
      thresholdPct: threshold,
      ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
    })
      .then((res) => setData(res.data))
      .catch(() => toast.error(t("fuel.toastError")))
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, threshold, selectedCustomerId, t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/fuel/reports")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("fuel.backToList")}
        </Button>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("fuelReports.efficiency.title")}</h1>
        <p className="text-muted-foreground">{t("fuelReports.efficiency.description")}</p>
      </div>

      <div className="flex items-center gap-4 max-w-xs">
        <Label className="text-sm whitespace-nowrap">
          {t("fuelReports.efficiency.threshold")}: {threshold}%
        </Label>
        <Slider
          min={5}
          max={50}
          step={5}
          value={[threshold]}
          onValueChange={([v]) => setThreshold(v)}
          className="flex-1"
        />
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">{t("common.loading")}</div>
      ) : data.length === 0 ? (
        <div className="text-center text-muted-foreground">{t("fuelReports.efficiency.noAlerts")}</div>
      ) : (
        <EfficiencyTable data={data} />
      )}
    </div>
  );
}
