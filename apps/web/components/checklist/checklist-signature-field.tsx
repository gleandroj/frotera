"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CHECKLIST_SIGNATURE_VERSION,
  collectSignatureClientMeta,
  parseChecklistSignaturePayload,
  stringifySignaturePayload,
  type ChecklistSignaturePayload,
} from "@/lib/checklist-signature";

export type ChecklistSignatureFieldProps = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Upload PNG (canvas export); must return public file URL. */
  uploadPngBlob: (blob: Blob) => Promise<string>;
  labels?: {
    tabText?: string;
    tabDraw?: string;
    textPlaceholder?: string;
    clearDraw?: string;
    saveDraw?: string;
    savingDraw?: string;
    legacyNotice?: string;
    drawSaved?: string;
  };
};

function SignatureCanvas({
  onStrokeCommitted,
  disabled,
}: {
  onStrokeCommitted: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const src = "touches" in e ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || disabled) return;
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
    const canvas = canvasRef.current;
    if (canvas) onStrokeCommitted(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    onStrokeCommitted("");
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
      <Button type="button" variant="outline" size="sm" onClick={clear} disabled={disabled}>
        Limpar
      </Button>
    </div>
  );
}

export function ChecklistSignatureField({
  value,
  onChange,
  disabled,
  uploadPngBlob,
  labels = {},
}: ChecklistSignatureFieldProps) {
  const parsed = React.useMemo(() => parseChecklistSignaturePayload(value), [value]);
  const legacyDataUrl = value?.startsWith("data:image") ? value : null;

  const initialTab = parsed?.mode === "draw" || legacyDataUrl ? "draw" : "text";
  const [tab, setTab] = React.useState<"text" | "draw">(initialTab);
  const [text, setText] = React.useState(parsed?.mode === "text" ? (parsed.text ?? "") : "");
  const [drawUploading, setDrawUploading] = React.useState(false);
  const [drawError, setDrawError] = React.useState<string | null>(null);
  const [drawPreviewUrl, setDrawPreviewUrl] = React.useState<string | null>(
    parsed?.drawImageUrl ?? legacyDataUrl,
  );
  const [hasPendingDraw, setHasPendingDraw] = React.useState(false);
  const pendingDataUrl = React.useRef<string | null>(null);

  React.useEffect(() => {
    const p = parseChecklistSignaturePayload(value);
    if (p?.mode === "text") setText(p.text ?? "");
    if (p?.mode === "draw" && p.drawImageUrl) setDrawPreviewUrl(p.drawImageUrl);
    else if (value?.startsWith("data:image")) setDrawPreviewUrl(value);
    else if (!value) {
      setDrawPreviewUrl(null);
      setText("");
    }
  }, [value]);

  const emitTextPayload = (t: string) => {
    const trimmed = t.trim();
    if (!trimmed) {
      onChange("");
      return;
    }
    const payload: Omit<ChecklistSignaturePayload, "server"> = {
      version: CHECKLIST_SIGNATURE_VERSION,
      mode: "text",
      text: trimmed,
      client: collectSignatureClientMeta(),
      capturedAt: new Date().toISOString(),
    };
    onChange(stringifySignaturePayload(payload));
  };

  const commitDrawFromCanvas = (dataUrl: string) => {
    setDrawError(null);
    if (!dataUrl) {
      setDrawPreviewUrl(null);
      pendingDataUrl.current = null;
      setHasPendingDraw(false);
      onChange("");
      return;
    }
    pendingDataUrl.current = dataUrl;
    setHasPendingDraw(true);
  };

  const saveDrawClick = async () => {
    const dataUrl = pendingDataUrl.current;
    if (!dataUrl || disabled) return;
    setDrawUploading(true);
    setDrawError(null);
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const url = await uploadPngBlob(blob);
      setDrawPreviewUrl(url);
      const payload: Omit<ChecklistSignaturePayload, "server"> = {
        version: CHECKLIST_SIGNATURE_VERSION,
        mode: "draw",
        drawImageUrl: url,
        client: collectSignatureClientMeta(),
        capturedAt: new Date().toISOString(),
      };
      onChange(stringifySignaturePayload(payload));
      pendingDataUrl.current = null;
      setHasPendingDraw(false);
    } catch {
      setDrawError("Não foi possível enviar a assinatura. Tente novamente.");
    } finally {
      setDrawUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {legacyDataUrl && !parsed && (
        <p className="text-xs text-amber-700">{labels.legacyNotice ?? "Assinatura guardada em formato antigo."}</p>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = v as "text" | "draw";
          setTab(next);
          if (next === "text") {
            emitTextPayload(text);
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="text" disabled={disabled}>
            {labels.tabText ?? "Assinatura digitada"}
          </TabsTrigger>
          <TabsTrigger value="draw" disabled={disabled}>
            {labels.tabDraw ?? "Assinatura manuscrita"}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="text" className="space-y-2 pt-2">
          <Label className="text-muted-foreground text-xs">
            {labels.textPlaceholder ?? "Nome completo ou texto de aceite"}
          </Label>
          <Input
            placeholder={labels.textPlaceholder ?? "Nome completo ou texto de aceite"}
            value={text}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value;
              setText(v);
            }}
            onBlur={() => emitTextPayload(text)}
          />
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={() => emitTextPayload(text)}
          >
            Aplicar
          </Button>
        </TabsContent>
        <TabsContent value="draw" className="space-y-3 pt-2">
          <SignatureCanvas onStrokeCommitted={commitDrawFromCanvas} disabled={disabled} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={disabled || drawUploading || !hasPendingDraw}
              onClick={saveDrawClick}
            >
              {drawUploading ? (labels.savingDraw ?? "A enviar…") : (labels.saveDraw ?? "Guardar traço")}
            </Button>
            {drawPreviewUrl && !drawUploading && (
              <span className="text-xs text-green-600">{labels.drawSaved ?? "Assinatura guardada"}</span>
            )}
          </div>
          {drawError && <p className="text-xs text-destructive">{drawError}</p>}
          {drawPreviewUrl && (
            <img
              src={drawPreviewUrl}
              alt="Pré-visualização da assinatura"
              className="max-h-24 rounded border object-contain"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
