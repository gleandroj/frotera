"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/i18n/useTranslation";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { driversAPI, type Driver, type DriverVehicleAssignment } from "@/lib/frontend/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { DriverFormDialog } from "../driver-form-dialog";
import { Pencil, ArrowLeft, Link2, Unlink } from "lucide-react";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { AssignVehicleSheet } from "../assign-vehicle-sheet";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DriverDetailPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const params = useParams<{ driverId: string }>();
  const router = useRouter();

  const { can } = usePermissions();
  const canEditDriver = can(Module.DRIVERS, Action.EDIT);

  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [assignmentToUnassign, setAssignmentToUnassign] = useState<DriverVehicleAssignment | null>(null);

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

  const handleUnassign = async () => {
    if (!currentOrganization?.id || !assignmentToUnassign) return;
    setUnassigning(true);
    try {
      await driversAPI.unassignVehicle(currentOrganization.id, driver.id, assignmentToUnassign.vehicleId);
      toast.success(t("drivers.assignmentEndedSuccess"));
      setAssignmentToUnassign(null);
      fetchDriver();
    } catch {
      toast.error(t("drivers.toastError"));
    } finally {
      setUnassigning(false);
    }
  };

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
        {canEditDriver && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAssignDialogOpen(true)}>
              <Link2 className="mr-2 h-4 w-4" />
              {t("drivers.assignVehicle")}
            </Button>
            <Button onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("common.edit")}
            </Button>
          </div>
        )}
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
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono">{a.vehicle?.plate ?? a.vehicleId}</span>
                    <span className="text-muted-foreground">{a.vehicle?.name ?? ""}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.startDate).toLocaleDateString("pt-BR")}
                      {" - "}
                      {a.endDate ? new Date(a.endDate).toLocaleDateString("pt-BR") : t("drivers.indeterminateShort")}
                    </span>
                    {a.isPrimary && <Badge variant="outline">{t("drivers.primary")}</Badge>}
                    {!a.endDate && <Badge variant="default">{t("drivers.assignmentActive")}</Badge>}
                    {a.endDate && <Badge variant="secondary">{t("drivers.assignmentEnded")}</Badge>}
                    {!a.endDate && canEditDriver && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => setAssignmentToUnassign(a)}
                      >
                        <Unlink className="mr-2 h-4 w-4" />
                        {t("drivers.endAssignment")}
                      </Button>
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
      <AssignVehicleSheet
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        organizationId={currentOrganization!.id}
        driverId={driver.id}
        driverName={driver.name}
        onSuccess={fetchDriver}
      />
      <AlertDialog
        open={!!assignmentToUnassign}
        onOpenChange={(open) => !open && setAssignmentToUnassign(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("drivers.endAssignment")}</AlertDialogTitle>
            <AlertDialogDescription>{t("drivers.endAssignmentConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unassigning}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnassign} disabled={unassigning}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
