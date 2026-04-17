"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import {
  checklistAPI,
  vehiclesAPI,
  type ChecklistTemplate,
  type Vehicle,
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

export default function FillChecklistPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(params);
  const { t } = useTranslation();
  const router = useRouter();
  const { currentOrganization } = useAuth();

  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [driverName, setDriverName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Fetch template and vehicles on mount
  useEffect(() => {
    if (!currentOrganization?.id || !templateId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [templateRes, vehiclesRes] = await Promise.all([
          checklistAPI.getTemplate(currentOrganization.id, templateId),
          vehiclesAPI.list(currentOrganization.id),
        ]);

        setTemplate(templateRes.data);
        setVehicles(vehiclesRes.data ?? []);
      } catch (err) {
        console.error("Failed to load checklist data:", err);
        toast.error(t("checklist.toastError"));
        router.push("/dashboard/checklist");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentOrganization?.id, templateId, router, t]);

  const handleAnswerChange = (itemId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
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
    if (!currentOrganization?.id || !template || !selectedVehicle) {
      toast.error(t("checklist.vehicleRequired"));
      return;
    }

    if (!validateRequired()) {
      return;
    }

    try {
      setSubmitting(true);

      const payload: CreateChecklistEntryPayload = {
        templateId,
        vehicleId: selectedVehicle,
        driverId: driverName || undefined,
        answers: Object.entries(answers).map(([itemId, value]) => {
          const item = template.items.find((i) => i.id === itemId);
          return {
            itemId,
            value,
            photoUrl: item?.type === "PHOTO" ? value : undefined,
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

  return (
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
            <Label htmlFor="vehicle" className="required">
              {t("checklist.selectVehicle")} *
            </Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger id="vehicle">
                <SelectValue
                  placeholder={t("checklist.selectVehiclePlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} ({vehicle.plate})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Driver Name Input */}
          <div className="space-y-2">
            <Label htmlFor="driver">
              {t("checklist.driverOptional")}
            </Label>
            <Input
              id="driver"
              placeholder={t("checklist.driverPlaceholder")}
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
            />
          </div>

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
                  <Input
                    type="url"
                    placeholder="URL da foto"
                    value={answers[item.id] || ""}
                    onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                  />
                )}

                {/* SELECT */}
                {item.type === "SELECT" && (
                  <Select
                    value={answers[item.id] || ""}
                    onValueChange={(value) => handleAnswerChange(item.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Selecione ${item.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {item.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* SIGNATURE */}
                {item.type === "SIGNATURE" && (
                  <Input
                    type="url"
                    placeholder="URL da assinatura"
                    value={answers[item.id] || ""}
                    onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                  />
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
  );
}
