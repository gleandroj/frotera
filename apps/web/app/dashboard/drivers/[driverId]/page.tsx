"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/i18n/useTranslation";
import { useAuth } from "@/lib/hooks/use-auth";
import { driversAPI, type Driver } from "@/lib/frontend/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { DriverFormDialog } from "../driver-form-dialog";
import { Pencil, ArrowLeft } from "lucide-react";
import { SkeletonTable } from "@/components/ui/skeleton-table";

export default function DriverDetailPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const params = useParams<{ driverId: string }>();
  const router = useRouter();

  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchDriver = () => {
    if (!currentOrganization?.id || !params.driverId) return;
    setLoading(true);
    driversAPI
      .get(currentOrganization.id, params.driverId)
      .then((res) => setDriver(res.data))
      .catch(() => setError(t("drivers.driverNotFound")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDriver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id, params.driverId]);

  if (loading) return <SkeletonTable />;

  if (error || !driver) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">{error ?? t("drivers.driverNotFound")}</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/drivers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("drivers.backToDrivers")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/drivers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{driver.name}</h1>
            <p className="text-muted-foreground">{t("drivers.driverInformation")}</p>
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          {t("common.edit")}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("drivers.sectionPersonal")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label={t("common.name")} value={driver.name} />
            <InfoRow label={t("drivers.cpf")} value={driver.cpf} mono />
            <InfoRow label={t("common.phone")} value={driver.phone} />
            <InfoRow label={t("common.email")} value={driver.email} />
            <InfoRow
              label={t("common.status")}
              value={
                <Badge variant={driver.active ? "default" : "secondary"}>
                  {driver.active ? t("common.active") : t("common.inactive")}
                </Badge>
              }
            />
            <InfoRow
              label={t("drivers.customer")}
              value={driver.customer?.name}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("drivers.sectionCnh")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label={t("drivers.cnh")} value={driver.cnh} mono />
            <InfoRow label={t("drivers.cnhCategory")} value={driver.cnhCategory} />
            <InfoRow
              label={t("drivers.cnhExpiry")}
              value={
                driver.cnhExpiry
                  ? new Date(driver.cnhExpiry).toLocaleDateString("pt-BR")
                  : undefined
              }
            />
          </CardContent>
        </Card>

        {driver.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t("drivers.notes")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{driver.notes}</p>
            </CardContent>
          </Card>
        )}

        {driver.vehicleAssignments && driver.vehicleAssignments.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t("drivers.vehicleAssignments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {driver.vehicleAssignments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <span className="font-mono">{a.vehicle?.plate ?? a.vehicleId}</span>
                    <span className="text-muted-foreground">
                      {a.vehicle?.name ?? ""}
                    </span>
                    {a.isPrimary && (
                      <Badge variant="outline">{t("drivers.primary")}</Badge>
                    )}
                    {!a.endDate && (
                      <Badge variant="default">{t("drivers.assignmentActive")}</Badge>
                    )}
                    {a.endDate && (
                      <Badge variant="secondary">{t("drivers.assignmentEnded")}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <DriverFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        driver={driver}
        organizationId={currentOrganization!.id}
        onSuccess={() => { setEditOpen(false); fetchDriver(); }}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: React.ReactNode | null;
  mono?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono" : ""}>
        {value ?? t("common.notAvailable")}
      </span>
    </div>
  );
}
