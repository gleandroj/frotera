"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { useTranslation } from "@/i18n/useTranslation";
import { referencePointsAPI, customersAPI, geocodingAPI } from "@/lib/frontend/api-client";
import type { ReferencePoint, Customer, GeocodeResult } from "@/lib/frontend/api-client";
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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Pencil, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RecordListStatus, RECORD_STATUS_ACTIVE, listParamsForRecordStatus } from "@/components/list-filters/record-status-filter";

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
  const { currentOrganization, selectedCustomerId } = useAuth();
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
  const [listStatus, setListStatus] = useState<RecordListStatus>(RECORD_STATUS_ACTIVE);
  const [searchName, setSearchName] = useState("");
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ReferencePointType>("DEPOT");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("500");
  const [customerId, setCustomerId] = useState("");
  const [active, setActive] = useState(true);
  const [geocodeSearching, setGeocodeSearching] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const [geocodePopoverOpen, setGeocodePopoverOpen] = useState(false);
  const [focusedPoint, setFocusedPoint] = useState<[number, number] | null>(null);

  // Load points and customers
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const load = async () => {
      setLoading(true);
      try {
        const params = {
          ...listParamsForRecordStatus(listStatus, selectedCustomerId),
          ...(searchName ? { name: searchName } : {}),
        };
        const pointsRes = await referencePointsAPI.list(currentOrganization.id, params);
        setPoints(Array.isArray(pointsRes.data) ? pointsRes.data : []);
      } catch (err) {
        toast.error(getApiErrorMessage(err, t));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentOrganization?.id, selectedCustomerId, listStatus, searchName]);

  // Load customers for the form
  useEffect(() => {
    if (!currentOrganization?.id || !sheetOpen) return;

    const loadCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const res = await customersAPI.list(currentOrganization.id, { activeOnly: true });
        setCustomers(Array.isArray(res.data?.customers) ? res.data.customers : []);
      } catch (err) {
        setCustomers([]);
      } finally {
        setLoadingCustomers(false);
      }
    };

    loadCustomers();
  }, [currentOrganization?.id, sheetOpen]);

  const selectedExplicitCustomer = useMemo(() => {
    return customers.find((c) => c.id === customerId);
  }, [customers, customerId]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setType("DEPOT");
    setAddress("");
    setLatitude("");
    setLongitude("");
    setRadiusMeters("500");
    setCustomerId("");
    setActive(true);
    setEditingPoint(null);
    setGeocodeResults([]);
  };

  const handleOpenSheet = (point?: ReferencePoint) => {
    if (point) {
      setEditingPoint(point);
      setName(point.name);
      setDescription(point.description || "");
      setType(point.type);
      setAddress(point.address || "");
      setLatitude(point.latitude.toString());
      setLongitude(point.longitude.toString());
      setRadiusMeters(point.radiusMeters.toString());
      setCustomerId(point.customerId || "");
      setActive(point.active);
    } else {
      resetForm();
      // Pre-populate with selected customer if available
      if (selectedCustomerId) {
        setCustomerId(selectedCustomerId);
      }
    }
    setSheetOpen(true);
  };

  const handleGeocodeSearch = async () => {
    if (!address.trim()) return;

    setGeocodeSearching(true);
    try {
      const res = await geocodingAPI.search(address.trim(), 5);
      setGeocodeResults(res.data?.results || []);
      setGeocodePopoverOpen(true);
    } catch (err) {
      toast.error(t("common.error"));
    } finally {
      setGeocodeSearching(false);
    }
  };

  const handleSelectGeocodeResult = (result: GeocodeResult) => {
    setLatitude(result.lat.toString());
    setLongitude(result.lng.toString());
    setAddress(result.displayName);
    setGeocodePopoverOpen(false);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setLatitude(lat.toString());
    setLongitude(lng.toString());

    // Reverse geocode to get address
    try {
      const res = await geocodingAPI.reverse(lat, lng);
      if (res.data?.address) {
        setAddress(res.data.address);
      }
    } catch (err) {
      // If reverse geocode fails, just use the coordinates
    }
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
        address: address || null,
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
      const params = {
        ...listParamsForRecordStatus(listStatus, selectedCustomerId),
        ...(searchName ? { name: searchName } : {}),
      };
      const res = await referencePointsAPI.list(currentOrganization.id, params);
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

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:flex-wrap md:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">{t("common.searchByName")}</span>
            <Input
              placeholder={t("common.searchByName")}
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">{t("common.status")}</span>
            <Select value={listStatus} onValueChange={(v: any) => setListStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.all")}</SelectItem>
                <SelectItem value="ACTIVE">{t("common.active")}</SelectItem>
                <SelectItem value="INACTIVE">{t("common.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map — always mounted to avoid flicker on filter changes */}
        <div className="lg:col-span-2">
          <div className="relative h-[500px] rounded-lg overflow-hidden border">
            <ReferencePointsMapDynamic
              points={points}
              onMapClick={sheetOpen ? handleMapClick : undefined}
              latitude={sheetOpen && latitude ? parseFloat(latitude) : undefined}
              longitude={sheetOpen && longitude ? parseFloat(longitude) : undefined}
              radiusMeters={sheetOpen && radiusMeters ? parseInt(radiusMeters) : undefined}
              focusedPoint={sheetOpen ? null : focusedPoint}
            />
            {sheetOpen && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[400] bg-background/90 backdrop-blur-sm text-xs px-3 py-1.5 rounded-full border shadow-sm pointer-events-none select-none">
                {t("referencePoints.mapClickHint")}
              </div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <>
              <div className="text-sm font-medium">
                {points.length} Ponto{points.length !== 1 ? "s" : ""}
              </div>
              {points.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("referencePoints.noPoints")}</p>
              ) : (
                points.map((point) => (
                  <div
                    key={point.id}
                    className={cn(
                      "rounded-lg border p-3 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors",
                      focusedPoint?.[0] === point.latitude && focusedPoint?.[1] === point.longitude
                        ? "border-primary bg-muted/50"
                        : "",
                    )}
                    onClick={() => setFocusedPoint([point.latitude, point.longitude])}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{point.name}</p>
                        <p className="text-xs text-muted-foreground">{point.customer?.name || "—"}</p>
                        {point.address && (
                          <p className="text-xs text-muted-foreground truncate">{point.address}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {typeOptions.find((opt) => opt.value === point.type)?.label}
                      </Badge>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
            </>
          )}
        </div>
      </div>

      {/* Form Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} modal={false}>
        <SheetContent hideOverlay className="max-w-[500px] overflow-y-auto">
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

            {/* Address Search */}
            <div>
              <Label htmlFor="address-search">{t("referencePoints.address")} *</Label>
              <Popover open={geocodePopoverOpen} onOpenChange={setGeocodePopoverOpen}>
                <div className="flex gap-2">
                  <PopoverAnchor asChild>
                    <div className="flex-1">
                      <Input
                        id="address-search"
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          if (geocodePopoverOpen) setGeocodePopoverOpen(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleGeocodeSearch();
                          }
                          if (e.key === "Escape") setGeocodePopoverOpen(false);
                        }}
                        placeholder={t("referencePoints.addressSearchPlaceholder")}
                        autoComplete="off"
                      />
                    </div>
                  </PopoverAnchor>
                  <Button
                    type="button"
                    onClick={handleGeocodeSearch}
                    disabled={geocodeSearching || !address.trim()}
                  >
                    {geocodeSearching ? t("common.searching") : t("common.search")}
                  </Button>
                </div>
                {geocodeResults.length > 0 && (
                  <PopoverContent
                    align="start"
                    className="p-0 w-80"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    {geocodeResults.map((result, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectGeocodeResult(result);
                        }}
                      >
                        {result.displayName}
                      </button>
                    ))}
                  </PopoverContent>
                )}
              </Popover>
            </div>

            {/* Coordinates display (read-only) */}
            {latitude && longitude && (
              <div className="text-xs text-muted-foreground">
                {latitude}, {longitude}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="radius">{t("referencePoints.radius")}</Label>
                <span className="text-sm text-muted-foreground">{radiusMeters} m</span>
              </div>
              <Slider
                id="radius"
                min={50}
                max={50000}
                step={50}
                value={[parseInt(radiusMeters) || 500]}
                onValueChange={(v) => setRadiusMeters(String(v[0]))}
              />
            </div>

            {/* Empresa combobox */}
            <div>
              <Label>{t("referencePoints.customer")}</Label>
              <Popover open={customerComboboxOpen} onOpenChange={setCustomerComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    disabled={loadingCustomers}
                    className={cn(
                      "w-full justify-between",
                      !customerId && "text-muted-foreground"
                    )}
                  >
                    <span className="truncate">
                      {customerId && selectedExplicitCustomer ? (
                        <span style={{ paddingLeft: (selectedExplicitCustomer.depth ?? 0) * 12 }}>
                          {selectedExplicitCustomer.name}
                        </span>
                      ) : (
                        t("referencePoints.selectCompany")
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder={t("referencePoints.searchCompany")} />
                    <CommandList>
                      {customers.length === 0 ? (
                        <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {customers.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                setCustomerId(c.id);
                                setCustomerComboboxOpen(false);
                              }}
                            >
                              <span style={{ paddingLeft: (c.depth ?? 0) * 12 }}>
                                {c.name}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
