"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { GripVertical, Trash2, Plus } from "lucide-react";
import {
  checklistAPI,
  customersAPI,
  type ChecklistDriverRequirement,
  type ChecklistTemplate,
  type CreateChecklistTemplatePayload,
  type Customer,
  type ItemType,
} from "@/lib/frontend/api-client";
import { toast } from "sonner";

interface ChecklistTemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ChecklistTemplate | null;
  organizationId: string;
  /** Empresa dona do template ao criar (cabeçalho do dashboard). */
  defaultCustomerId?: string | null;
  onSuccess: () => void;
}

interface FormItem {
  tempId: string;
  label: string;
  type: ItemType;
  required: boolean;
  options: string[];
}

const ITEM_TYPES: ItemType[] = [
  "YES_NO",
  "TEXT",
  "NUMBER",
  "PHOTO",
  "SELECT",
  "SIGNATURE",
  "FILE",
];

interface SortableItemProps {
  item: FormItem;
  onUpdate: (tempId: string, patch: Partial<FormItem>) => void;
  onRemove: (tempId: string) => void;
  t: (key: string) => string;
}

function SortableItem({ item, onUpdate, onRemove, t }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.tempId });

  const transformStr = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
    : undefined;

  const style = {
    transform: transformStr,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-start">
      <button
        type="button"
        className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0"
        title={t("checklist.dragToReorder")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <Card className="flex-1">
        <CardContent className="pt-4 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <Input
                value={item.label}
                onChange={(e) => onUpdate(item.tempId, { label: e.target.value })}
                placeholder={t("checklist.itemLabelPlaceholder")}
              />
            </div>

            <div className="w-44">
              <Select
                value={item.type}
                onValueChange={(val) => onUpdate(item.tempId, { type: val as ItemType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`checklist.itemTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {item.type === "SELECT" && (
            <div>
              <Input
                value={item.options.join(",")}
                onChange={(e) =>
                  onUpdate(item.tempId, {
                    options: e.target.value.split(",").map((o) => o.trimStart()),
                  })
                }
                placeholder={t("checklist.itemOptions")}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id={`required-${item.tempId}`}
              checked={item.required}
              onCheckedChange={(checked) =>
                onUpdate(item.tempId, { required: !!checked })
              }
            />
            <Label htmlFor={`required-${item.tempId}`} className="text-sm cursor-pointer">
              {t("checklist.itemRequired")}
            </Label>
          </div>
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={() => onRemove(item.tempId)}
        className="mt-2 text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors"
        title={t("checklist.removeItem")}
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </div>
  );
}

export function ChecklistTemplateFormDialog({
  open,
  onOpenChange,
  template,
  organizationId,
  defaultCustomerId = null,
  onSuccess,
}: ChecklistTemplateFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!template;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [vehicleRequired, setVehicleRequired] = useState(true);
  const [driverRequirement, setDriverRequirement] =
    useState<ChecklistDriverRequirement>("OPTIONAL");
  const [items, setItems] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerId, setCustomerId] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open) return;

    if (template) {
      setName(template.name);
      setDescription(template.description ?? "");
      setActive(template.active);
      setVehicleRequired(template.vehicleRequired);
      setDriverRequirement(template.driverRequirement);
      setCustomerId(template.customerId ?? "");
      setItems(
        template.items.map((item) => ({
          tempId: item.id,
          label: item.label,
          type: item.type,
          required: item.required,
          options: item.options ?? [],
        }))
      );
    } else {
      setName("");
      setDescription("");
      setActive(true);
      setVehicleRequired(true);
      setDriverRequirement("OPTIONAL");
      setCustomerId(defaultCustomerId ?? "");
      setItems([]);
    }
    // defaultCustomerId omitted: avoid wiping the form when the header filter changes while the sheet is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on open / template identity
  }, [open, template?.id]);

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoadingCustomers(true);
    customersAPI
      .list(organizationId)
      .then((res) => {
        const list = res.data?.customers ?? [];
        setCustomers(Array.isArray(list) ? list : []);
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [open, organizationId]);

  useEffect(() => {
    if (!open || template || customers.length === 0) return;
    setCustomerId((prev) => {
      if (prev && customers.some((c) => c.id === prev)) return prev;
      if (defaultCustomerId && customers.some((c) => c.id === defaultCustomerId)) {
        return defaultCustomerId;
      }
      if (customers.length === 1) return customers[0].id;
      return "";
    });
  }, [open, template, customers, defaultCustomerId]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.tempId === active.id);
        const newIndex = prev.findIndex((i) => i.tempId === over!.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function addItem() {
    const newItem: FormItem = {
      tempId: crypto.randomUUID(),
      label: "",
      type: "YES_NO",
      required: false,
      options: [],
    };
    setItems((prev) => [...prev, newItem]);
  }

  function updateItem(tempId: string, patch: Partial<FormItem>) {
    setItems((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(tempId: string) {
    setItems((prev) => prev.filter((item) => item.tempId !== tempId));
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    if (!isEdit && !customerId) {
      toast.error(t("checklist.templateCustomerRequired"));
      return;
    }

    const payload: CreateChecklistTemplatePayload = {
      name: name.trim(),
      ...(!isEdit && customerId ? { customerId } : {}),
      description: description.trim() || undefined,
      active,
      vehicleRequired,
      driverRequirement,
      items: items.map((item, index) => ({
        label: item.label,
        type: item.type,
        required: item.required,
        options: item.options.filter(Boolean).length > 0 ? item.options.filter(Boolean) : undefined,
        order: index + 1,
      })),
    };

    try {
      setLoading(true);
      if (isEdit) {
        await checklistAPI.updateTemplate(organizationId, template!.id, payload);
        toast.success(t("checklist.toastUpdated"));
      } else {
        await checklistAPI.createTemplate(organizationId, payload);
        toast.success(t("checklist.toastCreated"));
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("checklist.toastError");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[700px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>
            {isEdit ? t("checklist.editTemplate") : t("checklist.newTemplate")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {isEdit ? (
            <div className="space-y-1.5">
              <Label>{t("checklist.templateCompanyLabel")}</Label>
              <p className="text-sm rounded-md border bg-muted/30 px-3 py-2">
                {loadingCustomers
                  ? "—"
                  : customers.find((c) => c.id === template?.customerId)?.name ??
                    template?.customerId ??
                    "—"}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="template-customer">
                {t("checklist.templateCompanyLabel")}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Select
                value={customerId}
                onValueChange={setCustomerId}
                disabled={loading || loadingCustomers}
              >
                <SelectTrigger id="template-customer" className="w-full">
                  <SelectValue placeholder={t("checklist.templateCompanyPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("checklist.templateCompanyHint")}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="template-name">
              {t("checklist.templateName")}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("checklist.templateNamePlaceholder")}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-description">
              {t("checklist.templateDescription")}
            </Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("checklist.templateDescriptionPlaceholder")}
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="template-active"
              checked={active}
              onCheckedChange={setActive}
              disabled={loading}
            />
            <Label htmlFor="template-active" className="cursor-pointer">
              {t("checklist.templateActive")}
            </Label>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <p className="text-sm font-medium">{t("checklist.templateFillContextTitle")}</p>
            <div className="flex items-center gap-3">
              <Switch
                id="template-vehicle-required"
                checked={vehicleRequired}
                onCheckedChange={setVehicleRequired}
                disabled={loading}
              />
              <Label htmlFor="template-vehicle-required" className="cursor-pointer leading-snug">
                {t("checklist.templateVehicleRequiredSwitch")}
              </Label>
            </div>
            <div className="space-y-2">
              <Label>{t("checklist.templateDriverRequirementLabel")}</Label>
              <Select
                value={driverRequirement}
                onValueChange={(v) => setDriverRequirement(v as ChecklistDriverRequirement)}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REQUIRED">
                    {t("checklist.driverRequirement.REQUIRED")}
                  </SelectItem>
                  <SelectItem value="OPTIONAL">
                    {t("checklist.driverRequirement.OPTIONAL")}
                  </SelectItem>
                  <SelectItem value="HIDDEN">
                    {t("checklist.driverRequirement.HIDDEN")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t("checklist.templateItems")}</h3>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((i) => i.tempId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {items.map((item) => (
                    <SortableItem
                      key={item.tempId}
                      item={item}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                      t={t}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              className="w-full gap-2"
              disabled={loading}
            >
              <Plus className="h-4 w-4" />
              {t("checklist.addItem")}
            </Button>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2 bg-background">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || (!isEdit && (!customerId || loadingCustomers))}
          >
            {loading ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
