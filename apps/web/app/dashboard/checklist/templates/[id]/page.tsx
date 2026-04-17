"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import {
  checklistAPI,
  ChecklistTemplate,
  CreateChecklistTemplatePayload,
  ItemType,
} from "@/lib/frontend/api-client";
import { toast } from "sonner";

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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, GripVertical, Trash2, Plus } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── SortableItem component ────────────────────────────────────────────────────

interface SortableItemProps {
  item: FormItem;
  onUpdate: (tempId: string, patch: Partial<FormItem>) => void;
  onRemove: (tempId: string) => void;
  t: (key: string) => string;
}

function SortableItem({ item, onUpdate, onRemove, t }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.tempId });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-start">
      {/* Drag handle */}
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
          {/* Label + Type row */}
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

          {/* Options field — only for SELECT type */}
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

          {/* Required checkbox */}
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

      {/* Remove button */}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditChecklistTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation();
  const router = useRouter();
  const { currentOrganization } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [items, setItems] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load template on mount
  useEffect(() => {
    const loadTemplate = async () => {
      if (!currentOrganization?.id) return;

      try {
        setPageLoading(true);
        const template = await checklistAPI.getTemplate(
          currentOrganization.id,
          id
        );

        setName(template.data.name);
        setDescription(template.data.description || "");
        setActive(template.data.active);

        // Pre-populate items from template
        const initialItems: FormItem[] = template.data.items.map((item) => ({
          tempId: item.id,
          label: item.label,
          type: item.type,
          required: item.required,
          options: item.options || [],
        }));
        setItems(initialItems);
      } catch (err) {
        console.error("Failed to load checklist template:", err);
        toast.error(t("checklist.toastError"));
        router.push("/dashboard/checklist");
      } finally {
        setPageLoading(false);
      }
    };

    loadTemplate();
  }, [currentOrganization?.id, id, router, t]);

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
      prev.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item))
    );
  }

  function removeItem(tempId: string) {
    setItems((prev) => prev.filter((item) => item.tempId !== tempId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrganization?.id) return;

    const payload: CreateChecklistTemplatePayload = {
      name,
      description: description || undefined,
      active,
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
      await checklistAPI.updateTemplate(currentOrganization.id, id, payload);
      toast.success(t("checklist.toastUpdated"));
      router.push("/dashboard/checklist");
    } catch (err) {
      console.error("Failed to update checklist template:", err);
      toast.error(t("checklist.toastError"));
    } finally {
      setLoading(false);
    }
  }

  if (!currentOrganization?.id) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("checklist.editTemplate")}
        </h1>
        <div className="text-center text-muted-foreground">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("checklist.editTemplate")}
        </h1>
        <div className="text-center text-muted-foreground">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common.cancel")}
        </Button>
      </div>

      <h1 className="text-3xl font-bold tracking-tight">
        {t("checklist.editTemplate")}
      </h1>

      <div className="max-w-2xl space-y-6">
        {/* Template metadata card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("checklist.editTemplate")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
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
                required
              />
            </div>

            {/* Description */}
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
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id="template-active"
                checked={active}
                onCheckedChange={setActive}
              />
              <Label htmlFor="template-active" className="cursor-pointer">
                {t("checklist.templateActive")}
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Items section */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("checklist.templateItems")}</h2>

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
          >
            <Plus className="h-4 w-4" />
            {t("checklist.addItem")}
          </Button>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
