"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/i18n/useTranslation";
import {
  superadminTrackerDiscoveryAPI,
  type SuperadminVehicleWithoutTrackerRow,
  type TrackerDiscoveryLoginRow,
} from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { Link2, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export default function TrackerDiscoveriesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<TrackerDiscoveryLoginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedImei, setSelectedImei] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [vehicles, setVehicles] = useState<SuperadminVehicleWithoutTrackerRow[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superadminTrackerDiscoveryAPI.list();
      setRows(res.data);
    } catch {
      toast.error(t("settings.trackerDiscoveries.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!user?.isSuperAdmin) {
      router.replace("/dashboard");
      return;
    }
    void loadList();
  }, [user?.isSuperAdmin, router, loadList]);

  useEffect(() => {
    if (!dialogOpen || !user?.isSuperAdmin) return;
    setLoadingOrgs(true);
    superadminTrackerDiscoveryAPI
      .listOrganizations()
      .then((res) => setOrgs(res.data))
      .catch(() => toast.error(t("settings.trackerDiscoveries.loadOrgsFailed")))
      .finally(() => setLoadingOrgs(false));
  }, [dialogOpen, user?.isSuperAdmin, t]);

  useEffect(() => {
    if (!orgId) {
      setVehicles([]);
      setVehicleId("");
      return;
    }
    setLoadingVehicles(true);
    superadminTrackerDiscoveryAPI
      .listVehiclesWithoutTracker(orgId)
      .then((res) => {
        setVehicles(res.data);
        setVehicleId("");
      })
      .catch(() => toast.error(t("settings.trackerDiscoveries.loadVehiclesFailed")))
      .finally(() => setLoadingVehicles(false));
  }, [orgId, t]);

  const openLinkDialog = (imei: string) => {
    setSelectedImei(imei);
    setOrgId("");
    setVehicleId("");
    setVehicles([]);
    setDialogOpen(true);
  };

  const handleRegister = async () => {
    if (!selectedImei || !vehicleId) {
      toast.error(t("settings.trackerDiscoveries.chooseVehicleToast"));
      return;
    }
    setSubmitting(true);
    try {
      await superadminTrackerDiscoveryAPI.registerToVehicle(selectedImei, vehicleId);
      toast.success(t("settings.trackerDiscoveries.linkSuccess"));
      setDialogOpen(false);
      void loadList();
    } catch (e: unknown) {
      const code =
        typeof e === "object" &&
        e !== null &&
        "response" in e &&
        typeof (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message === "string"
          ? (e as { response: { data: { message: string } } }).response.data.message
          : null;
      toast.error(code ?? t("settings.trackerDiscoveries.linkFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user?.isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("settings.trackerDiscoveries.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings.trackerDiscoveries.description")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadList()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {t("settings.trackerDiscoveries.refresh")}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("settings.trackerDiscoveries.colImei")}</TableHead>
              <TableHead>{t("settings.trackerDiscoveries.colFirstSeen")}</TableHead>
              <TableHead>{t("settings.trackerDiscoveries.colLastSeen")}</TableHead>
              <TableHead className="text-right">{t("settings.trackerDiscoveries.colLogins")}</TableHead>
              <TableHead>{t("settings.trackerDiscoveries.colIp")}</TableHead>
              <TableHead className="w-[120px] text-right">
                {t("settings.trackerDiscoveries.colActions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  <Loader2 className="h-6 w-6 animate-spin inline mr-2 align-middle" />
                  {t("loading.processing")}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  {t("settings.trackerDiscoveries.empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.imei}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.firstSeenAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.lastSeenAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.loginCount}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {r.lastRemoteAddress ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openLinkDialog(r.imei)}>
                      <Link2 className="h-4 w-4 mr-1" />
                      {t("settings.trackerDiscoveries.link")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.trackerDiscoveries.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.trackerDiscoveries.dialogDescription", {
                imei: selectedImei ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("settings.trackerDiscoveries.selectOrg")}</Label>
              <Select
                value={orgId || undefined}
                onValueChange={setOrgId}
                disabled={loadingOrgs}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("settings.trackerDiscoveries.orgPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("settings.trackerDiscoveries.vehicleLabel")}</Label>
              <Select
                value={vehicleId || undefined}
                onValueChange={setVehicleId}
                disabled={!orgId || loadingVehicles}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingVehicles
                        ? t("settings.trackerDiscoveries.loadingVehicles")
                        : t("settings.trackerDiscoveries.vehiclePlaceholder")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {[v.plate, v.name].filter(Boolean).join(" · ") || v.id}
                      {" — "}
                      {v.customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {orgId && !loadingVehicles && vehicles.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("settings.trackerDiscoveries.noVehiclesWithoutTracker")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("settings.trackerDiscoveries.cancel")}
            </Button>
            <Button onClick={() => void handleRegister()} disabled={submitting || !vehicleId}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("settings.trackerDiscoveries.linking")}
                </>
              ) : (
                t("settings.trackerDiscoveries.confirmLink")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
