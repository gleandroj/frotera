"use client";

import * as React from "react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
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
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { publicChecklistAPI } from "@/lib/frontend/api-client";
import { ChecklistSignatureField } from "@/components/checklist/checklist-signature-field";
import {
  getChecklistAttachmentPhotoUrl,
  parseChecklistAttachment,
  stringifyChecklistAttachment,
} from "@/lib/checklist-answer-utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type ItemType = "YES_NO" | "TEXT" | "NUMBER" | "PHOTO" | "SELECT" | "SIGNATURE" | "FILE";

interface TemplateItem {
  id: string;
  label: string;
  type: ItemType;
  required: boolean;
  options: string[];
  order: number;
}

interface Template {
  id: string;
  name: string;
  description?: string | null;
  vehicleRequired: boolean;
  driverRequirement: ChecklistDriverRequirement;
  items: TemplateItem[];
}

interface VehicleOption {
  id: string;
  name?: string | null;
  plate?: string | null;
}

interface DriverOption {
  id: string;
  name: string;
}

// ── API Client ─────────────────────────────────────────────────────────────────

const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "",
});

/** Radix Select não permite SelectItem com value="". */
const NO_DRIVER_SELECT_VALUE = "__checklist_no_driver__";
const NO_VEHICLE_SELECT_VALUE = "__checklist_no_vehicle__";

type ChecklistDriverRequirement = "REQUIRED" | "OPTIONAL" | "HIDDEN";

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

// ── Page ───────────────────────────────────────────────────────────────────────

function PublicFillPageContent() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") ?? "";
  const templateId = searchParams.get("templateId") ?? "";
  const initVehicleId = searchParams.get("vehicleId") ?? "";
  const initDriverId = searchParams.get("driverId") ?? "";

  const [template, setTemplate] = useState<Template | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedVehicle, setSelectedVehicle] = useState(initVehicleId);
  const [selectedDriver, setSelectedDriver] = useState(initDriverId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attachmentUploadingId, setAttachmentUploadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !templateId) {
      setError("Link inválido: organização ou template não encontrado.");
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const [templateRes, vehiclesRes, driversRes] = await Promise.all([
          publicApi.get(`/api/public/checklist/template`, {
            params: { organizationId: orgId, templateId },
          }),
          publicApi.get(`/api/public/checklist/vehicles`, {
            params: { organizationId: orgId },
          }),
          publicApi.get(`/api/public/checklist/drivers`, {
            params: { organizationId: orgId },
          }),
        ]);
        setTemplate(templateRes.data);
        setVehicles(vehiclesRes.data ?? []);
        setDrivers(driversRes.data ?? []);
      } catch {
        setError(
          "Não foi possível carregar o checklist. Verifique o link e tente novamente."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orgId, templateId]);

  useEffect(() => {
    if (!template) return;
    if (template.driverRequirement === "HIDDEN") {
      setSelectedDriver("");
    }
  }, [template?.id, template?.driverRequirement]);

  const handleAnswerChange = (itemId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleSubmit = async () => {
    if (!template) return;

    const { vehicleRequired, driverRequirement: driverReq } = template;

    if (vehicleRequired && !selectedVehicle) {
      toast.error("Selecione um veículo antes de enviar.");
      return;
    }
    if (driverReq === "REQUIRED" && !selectedDriver) {
      toast.error("Selecione um motorista antes de enviar.");
      return;
    }

    const requiredItems = template.items.filter((i) => i.required);
    for (const item of requiredItems) {
      const raw = answers[item.id];
      if (item.type === "PHOTO" || item.type === "FILE") {
        if (!getChecklistAttachmentPhotoUrl(raw)) {
          toast.error(`Campo obrigatório não preenchido: ${item.label}`);
          return;
        }
        continue;
      }
      if (!raw?.trim()) {
        toast.error(`Campo obrigatório não preenchido: ${item.label}`);
        return;
      }
    }

    try {
      setSubmitting(true);
      await publicApi.post(`/api/public/checklist/entries`, {
        organizationId: orgId,
        templateId,
        ...(selectedVehicle ? { vehicleId: selectedVehicle } : {}),
        ...(driverReq !== "HIDDEN" && selectedDriver
          ? { driverId: selectedDriver }
          : {}),
        answers: Object.entries(answers).map(([itemId, raw]) => {
          const item = template.items.find((i) => i.id === itemId);
          if (item?.type === "PHOTO" || item?.type === "FILE") {
            const att = parseChecklistAttachment(raw);
            const meta =
              att?.originalName || att?.mimeType
                ? JSON.stringify({
                    originalName: att.originalName,
                    mimeType: att.mimeType,
                  })
                : undefined;
            return {
              itemId,
              value: meta,
              photoUrl: att?.photoUrl,
            };
          }
          return { itemId, value: raw, photoUrl: undefined };
        }),
      });
      setSubmitted(true);
    } catch {
      toast.error("Erro ao enviar checklist. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center text-muted-foreground">
            {error ?? "Checklist não encontrado."}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Checklist enviado com sucesso!</h2>
            <p className="text-muted-foreground">Obrigado por preencher o checklist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
  const { vehicleRequired, driverRequirement: driverReq } = template;

  return (
    <div className="min-h-screen bg-muted/30 p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6">
        <div className="pt-6">
          <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
          {template.description && (
            <p className="text-muted-foreground mt-1">{template.description}</p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vehicle */}
            <div className="space-y-2">
              <Label>
                Veículo
                {vehicleRequired ? " *" : " (opcional)"}
              </Label>
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
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um veículo" />
                </SelectTrigger>
                <SelectContent>
                  {!vehicleRequired && (
                    <SelectItem value={NO_VEHICLE_SELECT_VALUE}>
                      Sem veículo
                    </SelectItem>
                  )}
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} {v.plate ? `(${v.plate})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Driver */}
            {driverReq !== "HIDDEN" && (
              <div className="space-y-2">
                <Label>
                  Motorista
                  {driverReq === "REQUIRED" ? " *" : " (opcional)"}
                </Label>
                {driverReq === "REQUIRED" && drivers.length === 0 ? (
                  <p className="text-sm text-destructive">
                    Não há motoristas cadastrados. Entre em contato com a
                    organização.
                  </p>
                ) : (
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
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um motorista" />
                    </SelectTrigger>
                    <SelectContent>
                      {driverReq === "OPTIONAL" && (
                        <SelectItem value={NO_DRIVER_SELECT_VALUE}>
                          Nenhum
                        </SelectItem>
                      )}
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perguntas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {sortedItems.map((item) => (
              <div key={item.id} className="space-y-2">
                <Label>
                  {item.label}
                  {item.required && <span className="text-destructive ml-1">*</span>}
                </Label>

                {item.type === "YES_NO" && (
                  <RadioGroup
                    value={answers[item.id] || ""}
                    onValueChange={(value) => handleAnswerChange(item.id, value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id={`${item.id}-yes`} />
                      <Label
                        htmlFor={`${item.id}-yes`}
                        className="font-normal cursor-pointer"
                      >
                        Sim
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id={`${item.id}-no`} />
                      <Label
                        htmlFor={`${item.id}-no`}
                        className="font-normal cursor-pointer"
                      >
                        Não
                      </Label>
                    </div>
                  </RadioGroup>
                )}

                {item.type === "TEXT" && (
                  <Textarea
                    value={answers[item.id] || ""}
                    onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                  />
                )}

                {item.type === "NUMBER" && (
                  <Input
                    type="number"
                    value={answers[item.id] || ""}
                    onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                  />
                )}

                {item.type === "PHOTO" && (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={submitting || attachmentUploadingId === item.id}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setAttachmentUploadingId(item.id);
                        try {
                          const { data } = await publicChecklistAPI.uploadAttachment(
                            orgId,
                            templateId,
                            file,
                            "photo",
                          );
                          handleAnswerChange(
                            item.id,
                            stringifyChecklistAttachment({
                              photoUrl: data.fileUrl,
                              originalName: file.name,
                              mimeType: file.type || data.mimeType,
                            }),
                          );
                        } catch {
                          toast.error("Falha ao enviar a imagem. Tente novamente.");
                        } finally {
                          setAttachmentUploadingId(null);
                          e.target.value = "";
                        }
                      }}
                    />
                    {attachmentUploadingId === item.id && (
                      <p className="text-xs text-muted-foreground">A enviar ficheiro…</p>
                    )}
                    {getChecklistAttachmentPhotoUrl(answers[item.id]) && (
                      <img
                        src={getChecklistAttachmentPhotoUrl(answers[item.id])!}
                        alt=""
                        className="h-24 w-auto rounded border object-cover"
                      />
                    )}
                  </div>
                )}

                {item.type === "SELECT" && (
                  <Select
                    value={selectControlValue(item.id, answers[item.id], item.options)}
                    onValueChange={(value) =>
                      handleAnswerChange(item.id, answerFromSelectValue(item.id, value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={`Selecione ${item.label.toLowerCase()}`}
                      />
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

                {item.type === "SIGNATURE" && (
                  <ChecklistSignatureField
                    value={answers[item.id] ?? ""}
                    onChange={(v) => handleAnswerChange(item.id, v)}
                    disabled={submitting}
                    uploadPngBlob={async (blob) => {
                      const file = new File([blob], "signature.png", { type: "image/png" });
                      const { data } = await publicChecklistAPI.uploadAttachment(
                        orgId,
                        templateId,
                        file,
                        "signature",
                      );
                      return data.fileUrl;
                    }}
                  />
                )}

                {item.type === "FILE" && (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      disabled={submitting || attachmentUploadingId === item.id}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setAttachmentUploadingId(item.id);
                        try {
                          const { data } = await publicChecklistAPI.uploadAttachment(
                            orgId,
                            templateId,
                            file,
                            "file",
                          );
                          handleAnswerChange(
                            item.id,
                            stringifyChecklistAttachment({
                              photoUrl: data.fileUrl,
                              originalName: file.name,
                              mimeType: file.type || data.mimeType,
                            }),
                          );
                        } catch {
                          toast.error("Falha ao enviar o arquivo. Tente novamente.");
                        } finally {
                          setAttachmentUploadingId(null);
                          e.target.value = "";
                        }
                      }}
                    />
                    {attachmentUploadingId === item.id && (
                      <p className="text-xs text-muted-foreground">A enviar ficheiro…</p>
                    )}
                    {parseChecklistAttachment(answers[item.id])?.originalName && (
                      <p className="text-xs text-muted-foreground">
                        {parseChecklistAttachment(answers[item.id])?.originalName}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="pb-8">
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !!attachmentUploadingId ||
              (vehicleRequired && !selectedVehicle)
            }
            className="w-full"
            size="lg"
          >
            {submitting ? "Enviando..." : "Enviar Checklist"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PublicFillPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      }
    >
      <PublicFillPageContent />
    </Suspense>
  );
}
