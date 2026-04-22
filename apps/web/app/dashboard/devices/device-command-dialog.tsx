"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trackerDevicesAPI } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { AlertTriangle, Terminal } from "lucide-react";

interface Device {
  id: string;
  name?: string | null;
  imei: string;
  connectedAt?: string | null;
}

interface CommandParam {
  name: string;
  label: string;
  type: "text" | "number" | "select";
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface CommandDef {
  id: string;
  label: string;
  category: string;
  params: CommandParam[];
  build: (params: Record<string, string>) => string;
}

const COMMANDS: CommandDef[] = [
  // ── Controle ──────────────────────────────────────────────────────────────
  {
    id: "relay_block",
    label: "RELAY – Bloqueio",
    category: "control",
    params: [],
    build: () => "RELAY,1#",
  },
  {
    id: "relay_unblock",
    label: "RELAY – Desbloqueio",
    category: "control",
    params: [],
    build: () => "RELAY,0#",
  },
  {
    id: "reset",
    label: "RESET – Reiniciar",
    category: "control",
    params: [],
    build: () => "RESET#",
  },
  {
    id: "factory",
    label: "FACTORY – Restaurar fábrica",
    category: "control",
    params: [],
    build: () => "FACTORY#",
  },
  // ── Posicionamento ────────────────────────────────────────────────────────
  {
    id: "where",
    label: "WHERE – Solicitar localização",
    category: "position",
    params: [],
    build: () => "WHERE#",
  },
  {
    id: "url",
    label: "URL – Link Google Maps",
    category: "position",
    params: [],
    build: () => "URL#",
  },
  {
    id: "timer",
    label: "TIMER – Intervalo em movimento (seg)",
    category: "position",
    params: [
      { name: "seconds", label: "Segundos", type: "number", required: true, placeholder: "30" },
    ],
    build: (p) => `TIMER,${p.seconds}#`,
  },
  {
    id: "static",
    label: "STATIC – Intervalo parado (min)",
    category: "position",
    params: [
      { name: "minutes", label: "Minutos", type: "number", required: true, placeholder: "5" },
    ],
    build: (p) => `STATIC,${p.minutes}#`,
  },
  {
    id: "bend_disable",
    label: "BEND – Desabilitar pontos em curva",
    category: "position",
    params: [],
    build: () => "BEND,0#",
  },
  {
    id: "bend_enable",
    label: "BEND – Habilitar pontos em curva (ângulo)",
    category: "position",
    params: [
      { name: "angle", label: "Ângulo (graus)", type: "number", required: true, placeholder: "15" },
    ],
    build: (p) => `BEND,1,${p.angle}#`,
  },
  {
    id: "gmt",
    label: "GMT – Fuso horário",
    category: "position",
    params: [
      {
        name: "direction",
        label: "Direção",
        type: "select",
        required: true,
        options: [
          { value: "W", label: "Oeste (W) – América do Sul" },
          { value: "E", label: "Leste (E)" },
        ],
      },
      { name: "hours", label: "Horas de diferença", type: "number", required: true, placeholder: "3" },
    ],
    build: (p) => `GMT,${p.direction},${p.hours}#`,
  },
  // ── Odômetro ──────────────────────────────────────────────────────────────
  {
    id: "mileage_enable",
    label: "MILEAGE – Habilitar odômetro",
    category: "odometer",
    params: [],
    build: () => "MILEAGE,1#",
  },
  {
    id: "mileage_disable",
    label: "MILEAGE – Desabilitar odômetro",
    category: "odometer",
    params: [],
    build: () => "MILEAGE,0#",
  },
  {
    id: "milset",
    label: "MILSET – Definir valor inicial (km)",
    category: "odometer",
    params: [
      { name: "km", label: "Quilometragem (km)", type: "number", required: true, placeholder: "100" },
    ],
    build: (p) => `MILSET,${p.km}#`,
  },
  {
    id: "cmil",
    label: "CMIL – Zerar odômetro",
    category: "odometer",
    params: [],
    build: () => "CMIL#",
  },
  {
    id: "smil",
    label: "SMIL – Ler odômetro",
    category: "odometer",
    params: [],
    build: () => "SMIL#",
  },
  // ── Conexão ───────────────────────────────────────────────────────────────
  {
    id: "server",
    label: "SERVER – Definir servidor",
    category: "connection",
    params: [
      { name: "port1", label: "Porta local", type: "number", required: true, placeholder: "8520" },
      { name: "ip", label: "IP do servidor", type: "text", required: true, placeholder: "54.233.239.155" },
      { name: "port2", label: "Porta do servidor", type: "number", required: true, placeholder: "9014" },
      {
        name: "mode",
        label: "Modo",
        type: "select",
        required: true,
        options: [
          { value: "0", label: "0 – TCP" },
          { value: "1", label: "1 – UDP" },
        ],
      },
    ],
    build: (p) => `SERVER,${p.port1},${p.ip},${p.port2},${p.mode}#`,
  },
  {
    id: "apn",
    label: "APN – Configurar APN",
    category: "connection",
    params: [
      { name: "apn", label: "APN", type: "text", required: true, placeholder: "virtueyes.com.br" },
      { name: "user", label: "Usuário", type: "text", required: false, placeholder: "vivo" },
      { name: "pass", label: "Senha", type: "text", required: false, placeholder: "vivo" },
    ],
    build: (p) => `APN,${p.apn},${p.user ?? ""},${p.pass ?? ""}#`,
  },
  {
    id: "hbt",
    label: "HBT – Intervalo heartbeat (min)",
    category: "connection",
    params: [
      { name: "minutes", label: "Minutos", type: "number", required: true, placeholder: "3" },
    ],
    build: (p) => `HBT,${p.minutes}#`,
  },
  // ── Energia ───────────────────────────────────────────────────────────────
  {
    id: "slp_on",
    label: "SLP – Ativar economia de energia",
    category: "power",
    params: [],
    build: () => "SLPON#",
  },
  {
    id: "slp_off",
    label: "SLP – Desativar economia de energia",
    category: "power",
    params: [],
    build: () => "SLPOFF#",
  },
  {
    id: "wake",
    label: "WAKE – Ciclo de acordar (horas)",
    category: "power",
    params: [
      { name: "hours", label: "Horas", type: "number", required: true, placeholder: "168" },
    ],
    build: (p) => `WAKE,${p.hours}#`,
  },
  {
    id: "sleep",
    label: "SLEEP – Tempo dormindo (min)",
    category: "power",
    params: [
      { name: "minutes", label: "Minutos", type: "number", required: true, placeholder: "5" },
    ],
    build: (p) => `SLEEP,${p.minutes}#`,
  },
  // ── Alertas ───────────────────────────────────────────────────────────────
  {
    id: "speeding",
    label: "SPEEDING – Limite de velocidade",
    category: "alerts",
    params: [
      { name: "speed", label: "Velocidade máxima (km/h)", type: "number", required: true, placeholder: "120" },
      { name: "count", label: "Repetições do alerta", type: "number", required: true, placeholder: "3" },
    ],
    build: (p) => `SPEEDING,${p.speed},${p.count}#`,
  },
  {
    id: "stimer",
    label: "STIMER – Intervalo alerta de velocidade (min)",
    category: "alerts",
    params: [
      { name: "minutes", label: "Minutos", type: "number", required: true, placeholder: "10" },
    ],
    build: (p) => `STIME,${p.minutes}#`,
  },
  {
    id: "center",
    label: "CENTER – Número de telefone central",
    category: "alerts",
    params: [
      { name: "number", label: "Número (DDI+DDD+número)", type: "text", required: true, placeholder: "5511999999999" },
    ],
    build: (p) => `CENTER,A,${p.number}#`,
  },
  {
    id: "vibration",
    label: "VIBRATION – Sensibilidade acelerômetro",
    category: "alerts",
    params: [
      { name: "level", label: "Nível (1–9)", type: "number", required: true, placeholder: "3" },
    ],
    build: (p) => `VIBRATION,${p.level}#`,
  },
  // ── Status / Info ─────────────────────────────────────────────────────────
  {
    id: "status",
    label: "STATUS – Sensores",
    category: "status",
    params: [],
    build: () => "STATUS#",
  },
  {
    id: "gps",
    label: "GPS – Status do GPS",
    category: "status",
    params: [],
    build: () => "GPS#",
  },
  {
    id: "param",
    label: "PARAM – Parâmetros",
    category: "status",
    params: [],
    build: () => "PARAM#",
  },
  {
    id: "version",
    label: "VERSION – Versão do firmware",
    category: "status",
    params: [],
    build: () => "VERSION#",
  },
  {
    id: "noup",
    label: "NOUP – Parar transmissão",
    category: "status",
    params: [],
    build: () => "NOUP#",
  },
  {
    id: "force_position",
    label: "123 – Forçar posição GPRS",
    category: "status",
    params: [],
    build: () => "123",
  },
  {
    id: "lbs_info",
    label: "83202 – Informações LBS",
    category: "status",
    params: [],
    build: () => "83202",
  },
  {
    id: "sensor_info",
    label: "YSJ010 – Informações de sensores",
    category: "status",
    params: [],
    build: () => "YSJ010",
  },
];

const CATEGORIES: { key: string; labelKey: string }[] = [
  { key: "control", labelKey: "devices.commands.categories.control" },
  { key: "position", labelKey: "devices.commands.categories.position" },
  { key: "odometer", labelKey: "devices.commands.categories.odometer" },
  { key: "connection", labelKey: "devices.commands.categories.connection" },
  { key: "power", labelKey: "devices.commands.categories.power" },
  { key: "alerts", labelKey: "devices.commands.categories.alerts" },
  { key: "status", labelKey: "devices.commands.categories.status" },
];

interface Props {
  device: Device | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeviceCommandDialog({ device, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const [selectedId, setSelectedId] = useState<string>("");
  const [params, setParams] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCommand = COMMANDS.find((c) => c.id === selectedId) ?? null;
  const commandStr = selectedCommand ? selectedCommand.build(params) : "";

  const handleSelectCommand = (id: string) => {
    setSelectedId(id);
    setParams({});
  };

  const handleParamChange = (name: string, value: string) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  const isParamsValid = () => {
    if (!selectedCommand) return false;
    return selectedCommand.params.every(
      (p) => !p.required || (params[p.name] ?? "").trim() !== "",
    );
  };

  const handleSubmit = async () => {
    if (!device || !currentOrganization?.id || !selectedCommand || !isParamsValid()) return;
    setIsSubmitting(true);
    try {
      await trackerDevicesAPI.sendCommand(currentOrganization.id, device.id, commandStr);
      toast.success(t("devices.commands.toastSent"));
      onOpenChange(false);
      setSelectedId("");
      setParams({});
    } catch (err) {
      toast.error(getApiErrorMessage(err, t, "devices.commands.toastError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedId("");
      setParams({});
    }
    onOpenChange(v);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            {t("devices.commands.title")}
          </SheetTitle>
          <SheetDescription>
            {device?.name ?? device?.imei ?? ""}
          </SheetDescription>
        </SheetHeader>

        {device && !device.connectedAt && (
          <Alert className="mb-4 border-yellow-500 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t("devices.commands.offlineWarning")}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("devices.commands.selectCommand")}</Label>
            <Select value={selectedId} onValueChange={handleSelectCommand}>
              <SelectTrigger>
                <SelectValue placeholder={t("devices.commands.selectCommand")} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => {
                  const cmds = COMMANDS.filter((c) => c.category === cat.key);
                  if (cmds.length === 0) return null;
                  return (
                    <SelectGroup key={cat.key}>
                      <SelectLabel>{t(cat.labelKey)}</SelectLabel>
                      {cmds.map((cmd) => (
                        <SelectItem key={cmd.id} value={cmd.id}>
                          {cmd.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedCommand && selectedCommand.params.length > 0 && (
            <div className="space-y-3 rounded-md border p-3">
              {selectedCommand.params.map((param) => (
                <div key={param.name} className="space-y-1.5">
                  <Label htmlFor={param.name}>
                    {param.label}
                    {param.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {param.type === "select" ? (
                    <Select
                      value={params[param.name] ?? ""}
                      onValueChange={(v) => handleParamChange(param.name, v)}
                    >
                      <SelectTrigger id={param.name}>
                        <SelectValue placeholder={param.label} />
                      </SelectTrigger>
                      <SelectContent>
                        {param.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={param.name}
                      type={param.type === "number" ? "number" : "text"}
                      placeholder={param.placeholder}
                      value={params[param.name] ?? ""}
                      onChange={(e) => handleParamChange(param.name, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {commandStr && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t("devices.commands.previewLabel")}</Label>
              <div className="rounded-md bg-muted px-3 py-2 font-mono text-sm">
                {commandStr}
              </div>
            </div>
          )}

          <Button
            className="w-full"
            disabled={!isParamsValid() || isSubmitting}
            onClick={handleSubmit}
          >
            {t("devices.commands.sendButton")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
