"use client";

import * as React from "react";
import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import {
  checklistAPI,
  vehiclesAPI,
  driversAPI,
  type ChecklistTemplate,
  type Vehicle,
  type Driver,
  type CreateChecklistEntryPayload,
} from "@/lib/frontend/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ResourceSelectCreateRow } from "@/components/resource-select-create-row";
import { VehicleFormDialog } from "@/app/dashboard/vehicles/vehicle-form-dialog";
import { DriverFormDialog } from "@/app/dashboard/drivers/driver-form-dialog";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";

// ── SignaturePad ───────────────────────────────────────────────────────────────

function SignaturePad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const src = "touches" in e ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stop = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL());
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="w-full rounded border bg-white touch-none cursor-crosshair"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={stop}
      />
      <Button type="button" variant="outline" size="sm" onClick={clear}>
        Limpar assinatura
      </Button>
      {value && <p className="text-xs text-green-600">Assinatura capturada</p>}
    </div>
  );
}

/** Radix Select não permite SelectItem com value="". */
const NO_DRIVER_SELECT_VALUE = "__checklist_no_driver__";
const NO_VEHICLE_SELECT_VALUE = "__checklist_no_vehicle__";

const EMPTY_SELECT_PREFIX = "__rsf_select_empty__";

function selectItemValue(itemId: string, option: string, index: number): string {
  return option === "" ? `${EMPTY_SELECT_PREFIX}${itemId}:${index}` : option;
}

function answerFromSelectValue(itemId: string, value: string): string {
  if (!value.startsWith(EMPTY_SELECT_PREFIX)) return value;
  const rest = value.slice(EMPTY_SELECT_PREFIX.length);
  const colon = rest.indexOf(":");
  if (colon < 0) return value;
  if (rest.slice(0, colon) !== itemId) return value;
  return "";
}

function selectControlValue(
  itemId: string,
  answer: string | undefined,
  options: string[],
): string {
  if (answer === undefined) return "";
  if (answer !== "") return answer;
  const idx = options.findIndex((o) => o === "");
  if (idx < 0) return "";
  return `${EMPTY_SELECT_PREFIX}${itemId}:${idx}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
  const { can } = usePermissions();

  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [driverFormOpen, setDriverFormOpen] = useState(false);

  // Fetch template, vehicles, and drivers on mount
  useEffect(() => {
    if (!currentOrganization?.id || !templateId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [templateRes, vehiclesRes, driversRes] = await Promise.all([
          checklistAPI.getTemplate(currentOrganization.id, templateId),
          vehiclesAPI.list(currentOrganization.id),
          driversAPI.list(currentOrganization.id),
        ]);

        setTemplate(templateRes.data);
        setVehicles(vehiclesRes.data ?? []);
        setDrivers(driversRes.data?.drivers ?? []);

        // Pre-fill from URL params
        const paramVehicle = searchParams.get("vehicleId");
        const paramDriver = searchParams.get("driverId");
        if (paramVehicle) setSelectedVehicle(paramVehicle);
        if (paramDriver) setSelectedDriver(paramDriver);
      } catch (err) {
        console.error("Failed to load checklist data:", err);
        toast.error(t("checklist.toastError"));
        router.push("/dashboard/checklist");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentOrganization?.id, templateId, router, t, searchParams]);

  useEffect(() => {
    if (!template) return;
    if (template.driverRequirement === "HIDDEN") {
      setSelectedDriver("");
    }
  }, [template?.id, template?.driverRequirement]);

  const handleAnswerChange = (itemId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
  };

  const orgId = currentOrganization?.id;
  const canCreateVehicle = can(Module.VEHICLES, Action.CREATE);
  const canCreateDriver = can(Module.DRIVERS, Action.CREATE);

  const refreshVehiclesSilently = () => {
    if (!orgId) return;
    vehiclesAPI
      .list(orgId)
      .then((res) => setVehicles(res.data ?? []))
      .catch(() => setVehicles([]));
  };

  const refreshDriversSilently = () => {
    if (!orgId) return;
    driversAPI
      .list(orgId)
      .then((res) => setDrivers(res.data?.drivers ?? []))
      .catch(() => setDrivers([]));
  };

  const validateRequired = (): boolean => {
    if (!template) return false;

    const requiredItems = template.items.filter((item) => item.required);
    for (const item of requiredItems) {
      if (!answers[item.id]) {
        toast.error(t("checklist.requiredItemsMissing"));
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!currentOrganization?.id || !template) return;

    const { vehicleRequired, driverRequirement: driverReq } = template;

    if (vehicleRequired && !selectedVehicle) {
      toast.error(t("checklist.vehicleRequired"));
      return;
    }

    if (driverReq === "REQUIRED" && !selectedDriver) {
      toast.error(t("checklist.driverRequired"));
      return;
    }

    if (!validateRequired()) {
      return;
    }

    try {
      setSubmitting(true);

      const payload: CreateChecklistEntryPayload = {
        templateId,
        ...(selectedVehicle ? { vehicleId: selectedVehicle } : {}),
        ...(driverReq !== "HIDDEN" && selectedDriver
          ? { driverId: selectedDriver }
          : {}),
        answers: Object.entries(answers).map(([itemId, value]) => {
          const item = template.items.find((i) => i.id === itemId);
          return {
            itemId,
            value,
            photoUrl: item?.type === "PHOTO" || item?.type === "FILE" ? value : undefined,
          };
        }),
      };

      await checklistAPI.createEntry(currentOrganization.id, payload);
      toast.success(t("checklist.toastEntryCreated"));
      router.push("/dashboard/checklist?tab=entries");
    } catch (err) {
      console.error("Failed to create checklist entry:", err);
      toast.error(t("checklist.toastError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentOrganization?.id) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("checklist.fillChecklist")}
          </h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t("common.selectOrganization")}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("checklist.fillChecklist")}
          </h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("checklist.fillChecklist")}
          </h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t("checklist.toastError")}
        </div>
      </div>
    );
  }

  const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
  const { vehicleRequired, driverRequirement: driverReq } = template;

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {template.name}
        </h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("checklist.fillChecklist")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Vehicle Select */}
          <div className="space-y-2">
            <Label
              htmlFor="vehicle"
              className={vehicleRequired ? "required" : undefined}
            >
              {t("checklist.selectVehicle")}
              {vehicleRequired ? " *" : ` (${t("common.optional")})`}
            </Label>
            <ResourceSelectCreateRow
              showCreate={canCreateVehicle}
              createLabel={t("common.createNewVehicle")}
              onCreateClick={() => setVehicleFormOpen(true)}
              disabled={submitting}
            >
              <Select
                value={
                  !vehicleRequired && selectedVehicle === ""
                    ? NO_VEHICLE_SELECT_VALUE
                    : selectedVehicle
                }
                onValueChange={(v) =>
                  setSelectedVehicle(v === NO_VEHICLE_SELECT_VALUE ? "" : v)
                }
              >
                <SelectTrigger id="vehicle" className="w-full">
                  <SelectValue
                    placeholder={t("checklist.selectVehiclePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {!vehicleRequired && (
                    <SelectItem value={NO_VEHICLE_SELECT_VALUE}>
                      {t("checklist.noVehicle")}
                    </SelectItem>
                  )}
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.name ?? "—"} ({vehicle.plate ?? "—"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ResourceSelectCreateRow>
          </div>

          {/* Driver Select */}
          {driverReq !== "HIDDEN" && (
            <div className="space-y-2">
              <Label htmlFor="driver">
                {t("checklist.driver")}
                {driverReq === "REQUIRED" ? " *" : ` (${t("common.optional")})`}
              </Label>
              {driverReq === "REQUIRED" &&
              drivers.length === 0 &&
              !canCreateDriver ? (
                <p className="text-sm text-destructive">
                  {t("checklist.driverRequiredButNone")}
                </p>
              ) : (
                <ResourceSelectCreateRow
                  showCreate={canCreateDriver}
                  createLabel={t("common.createNewDriver")}
                  onCreateClick={() => setDriverFormOpen(true)}
                  disabled={submitting}
                >
                  <Select
                    value={
                      selectedDriver === ""
                        ? NO_DRIVER_SELECT_VALUE
                        : selectedDriver
                    }
                    onValueChange={(v) =>
                      setSelectedDriver(v === NO_DRIVER_SELECT_VALUE ? "" : v)
                    }
                  >
                    <SelectTrigger id="driver" className="w-full">
                      <SelectValue
                        placeholder={t("checklist.driverPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {driverReq === "OPTIONAL" && (
                        <SelectItem value={NO_DRIVER_SELECT_VALUE}>
                          {t("checklist.noDriver")}
                        </SelectItem>
                      )}
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ResourceSelectCreateRow>
              )}
            </div>
          )}

          {/* Template Items */}
          <div className="space-y-6 border-t pt-6">
            {sortedItems.map((item) => (
              <div key={item.id} className="space-y-2">
                <Label>
                  {item.label}
                  {item.required && " *"}
                </Label>

                {/* YES_NO */}
                {item.type === "YES_NO" && (
                  <RadioGroup
                    value={answers[item.id] || ""}
                    onValueChange={(value) => handleAnswerChange(item.id, value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id={`${item.id}-yes`} />
                      <Label htmlFor={`${item.id}-yes`} className="font-normal cursor-pointer">
                        Sim
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id={`${item.id}-no`} />
                      <Label htmlFor={`${item.id}-no`} className="font-normal cursor-pointer">
                        Não
                      </Label>
                    </div>
                  </RadioGroup>
                )}

                {/* TEXT */}
                {item.type === "TEXT" && (
                  <Textarea
                    placeholder={item.label}
                    value={answers[item.id] || ""}
                    onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                  />
                )}

                {/* NUMBER */}
                {item.type === "NUMBER" && (
                  <Input
                    type="number"
                    placeholder={item.label}
                    value={answers[item.id] || ""}
                    onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                  />
                )}

                {/* PHOTO */}
                {item.type === "PHOTO" && (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setAnswers((prev) => ({ ...prev, [item.id]: reader.result as string }));
                        reader.readAsDataURL(file);
                      }}
                    />
                    {answers[item.id] && (
                      <img src={answers[item.id]} alt="preview" className="h-24 w-auto rounded border object-cover" />
                    )}
                  </div>
                )}

                {/* SELECT */}
                {item.type === "SELECT" && (
                  <Select
                    value={selectControlValue(item.id, answers[item.id], item.options)}
                    onValueChange={(value) =>
                      handleAnswerChange(item.id, answerFromSelectValue(item.id, value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Selecione ${item.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {item.options.map((option, idx) => (
                        <SelectItem
                          key={`${item.id}-${idx}`}
                          value={selectItemValue(item.id, option, idx)}
                        >
                          {option || "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* SIGNATURE */}
                {item.type === "SIGNATURE" && (
                  <SignaturePad
                    value={answers[item.id] ?? ""}
                    onChange={(v) => setAnswers((prev) => ({ ...prev, [item.id]: v }))}
                  />
                )}

                {/* FILE */}
                {item.type === "FILE" && (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setAnswers((prev) => ({ ...prev, [item.id]: reader.result as string }));
                        reader.readAsDataURL(file);
                      }}
                    />
                    {answers[item.id] && (
                      <p className="text-xs text-muted-foreground">Arquivo selecionado</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <div className="flex gap-2 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => router.back()}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? t("checklist.submitting") : t("checklist.submitChecklist")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    {orgId && (
      <>
        <VehicleFormDialog
          open={vehicleFormOpen}
          onOpenChange={setVehicleFormOpen}
          vehicle={null}
          organizationId={orgId}
          defaultCustomerId={selectedCustomerId}
          onSuccess={(created) => {
            refreshVehiclesSilently();
            if (created?.id) setSelectedVehicle(created.id);
          }}
        />
        <DriverFormDialog
          open={driverFormOpen}
          onOpenChange={setDriverFormOpen}
          driver={null}
          organizationId={orgId}
          defaultCustomerId={selectedCustomerId}
          onSuccess={(created) => {
            refreshDriversSilently();
            if (created?.id) setSelectedDriver(created.id);
          }}
        />
      </>
    )}
    </>
  );
}
