"use client";
import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { useTranslation } from "@/i18n/useTranslation";
import { referencePointsAPI, customersAPI } from "@/lib/frontend/api-client";
import type { ReferencePoint, Customer } from "@/lib/frontend/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const ReferencePointsMapDynamic = dynamic(
  () => import("./reference-points-map").then((m) => ({ default: m.ReferencePointsMap })),
  { ssr: false }
);

const TYPE_VALUES = ["DEPOT", "CUSTOMER_SITE", "FUEL_STATION", "WORKSHOP", "OTHER"] as const;
type ReferencePointType = typeof TYPE_VALUES[number];

export default function ReferencePointsPage() {
  const { t } = useTranslation();

  const typeOptions = TYPE_VALUES.map((value) => ({
    value,
    label: t(`referencePoints.types.${value}`),
  }));
  const { currentOrganization } = useAuth();
  const { can } = usePermissions();
  const canView = can(Module.REFERENCE_POINTS, Action.VIEW);
  const canCreate = can(Module.REFERENCE_POINTS, Action.CREATE);
  const canEdit = can(Module.REFERENCE_POINTS, Action.EDIT);
  const canDelete = can(Module.REFERENCE_POINTS, Action.DELETE);

  const [points, setPoints] = useState<ReferencePoint[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<ReferencePoint | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ReferencePointType>("DEPOT");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("500");
  const [customerId, setCustomerId] = useState("");
  const [active, setActive] = useState(true);

  // Load points and customers
  useEffect(() => {
    if (!currentOrganization?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [pointsRes, customersRes] = await Promise.all([
          referencePointsAPI.list(currentOrganization.id),
          customersAPI.list(currentOrganization.id),
        ]);
        setPoints(Array.isArray(pointsRes.data) ? pointsRes.data : []);
        setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      } catch (err) {
        toast.error(getApiErrorMessage(err, t));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentOrganization?.id]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setType("DEPOT");
    setLatitude("");
    setLongitude("");
    setRadiusMeters("500");
    setCustomerId("");
    setActive(true);
    setEditingPoint(null);
  };

  const handleOpenSheet = (point?: ReferencePoint) => {
    if (point) {
      setEditingPoint(point);
      setName(point.name);
      setDescription(point.description || "");
      setType(point.type);
      setLatitude(point.latitude.toString());
      setLongitude(point.longitude.toString());
      setRadiusMeters(point.radiusMeters.toString());
      setCustomerId(point.customerId || "");
      setActive(point.active);
    } else {
      resetForm();
    }
    setSheetOpen(true);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setLatitude(lat.toString());
    setLongitude(lng.toString());
  };

  const handleSave = async () => {
    if (!currentOrganization?.id || !name || !latitude || !longitude) {
      toast.error(t("common.formValidationFailed"));
      return;
    }

    setSaving(true);
    try {
      const data = {
        name,
        description,
        type,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusMeters: parseInt(radiusMeters),
        customerId: customerId || null,
        active,
      };

      if (editingPoint) {
        await referencePointsAPI.update(currentOrganization.id, editingPoint.id, data);
        toast.success(t("common.updated"));
      } else {
        await referencePointsAPI.create(currentOrganization.id, data);
        toast.success(t("common.created"));
      }

      // Reload points
      const res = await referencePointsAPI.list(currentOrganization.id);
      setPoints(Array.isArray(res.data) ? res.data : []);
      setSheetOpen(false);
      resetForm();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentOrganization?.id) return;
    if (!confirm(t("common.delete"))) return;

    try {
      await referencePointsAPI.remove(currentOrganization.id, id);
      toast.success(t("common.updated"));
      setPoints(points.filter((p) => p.id !== id));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t));
    }
  };

  if (!canView) return <p className="text-muted-foreground">{t("common.noPermission")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("referencePoints.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("referencePoints.description")}</p>
        </div>
        {canCreate && (
          <Button onClick={() => handleOpenSheet()} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("referencePoints.newPoint")}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="h-[500px] rounded-lg overflow-hidden border">
              <ReferencePointsMapDynamic
                points={points}
                onMapClick={sheetOpen ? handleMapClick : undefined}
                latitude={sheetOpen && latitude ? parseFloat(latitude) : undefined}
                longitude={sheetOpen && longitude ? parseFloat(longitude) : undefined}
              />
            </div>
          </div>

          {/* List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            <div className="text-sm font-medium">
              {points.length} Ponto{points.length !== 1 ? "s" : ""}
            </div>
            {points.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("referencePoints.noPoints")}</p>
            ) : (
              points.map((point) => (
                <div key={point.id} className="rounded-lg border p-3 space-y-2 hover:bg-muted/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{point.name}</p>
                      <p className="text-xs text-muted-foreground">{point.customer?.name || "—"}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {typeOptions.find((opt) => opt.value === point.type)?.label}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleOpenSheet(point)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => handleDelete(point.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Form Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingPoint ? t("referencePoints.editPoint") : t("referencePoints.newPointForm")}
            </SheetTitle>
            <SheetDescription>
              {t("referencePoints.mapInstructions")}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            <div>
              <Label htmlFor="name">{t("common.name")} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("referencePoints.namePlaceholder")}
              />
            </div>

            <div>
              <Label htmlFor="type">{t("referencePoints.typeLabel")} *</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">{t("common.description")}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("referencePoints.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lat">{t("referencePoints.latitude")} *</Label>
                <Input
                  id="lat"
                  type="number"
                  step="0.000001"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder={t("referencePoints.latitudePlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="lng">{t("referencePoints.longitude")} *</Label>
                <Input
                  id="lng"
                  type="number"
                  step="0.000001"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder={t("referencePoints.longitudePlaceholder")}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="radius">{t("referencePoints.radius")}</Label>
              <Input
                id="radius"
                type="number"
                min="1"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(e.target.value)}
                placeholder="500"
              />
            </div>

            <div>
              <Label htmlFor="customer">{t("referencePoints.customer")}</Label>
              <Select value={customerId || ""} onValueChange={(v) => setCustomerId(v || "")}>
                <SelectTrigger id="customer">
                  <SelectValue placeholder={t("referencePoints.noCustomer")} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={active}
                onCheckedChange={(v) => setActive(!!v)}
              />
              <Label htmlFor="active" className="cursor-pointer">
                {t("common.active")}
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setSheetOpen(false)}
                className="flex-1"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
              >
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
