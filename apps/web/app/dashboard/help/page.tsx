"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface Command {
  name: string;
  description: string;
  example: string;
}

interface Category {
  title: string;
  commands: Command[];
}

type TrackerType = "xt40";

interface TrackerCommands {
  xt40: Category[];
}

const TRACKER_COMMANDS: TrackerCommands = {
  xt40: [
    {
      title: "Configuração de Servidor",
      commands: [
        {
          name: "SERVER",
          description: "Define IP/DNS e porta do servidor",
          example: "SERVER,8520,52.67.5.205,9020#",
        },
        {
          name: "APN",
          description: "Configura o APN da operadora",
          example: "APN,x3tech.br,x3tech,x3tech#",
        },
      ],
    },
    {
      title: "Fuso Horário",
      commands: [
        {
          name: "GMT",
          description: "Define o fuso horário da plataforma",
          example: "GMT,W,3#",
        },
      ],
    },
    {
      title: "Verificação de Status",
      commands: [
        {
          name: "VERSION#",
          description: "Retorna versão do firmware",
          example: "VERSION#",
        },
        {
          name: "PARAM#",
          description: "Retorna parâmetros do rastreador",
          example: "PARAM#",
        },
        {
          name: "STATUS#",
          description: "Retorna status dos sensores",
          example: "STATUS#",
        },
        {
          name: "NETWORK#",
          description: "Verifica conexão de rede LTE-4G ou GSM-2G",
          example: "NETWORK#",
        },
      ],
    },
    {
      title: "Temporização de Comunicação",
      commands: [
        {
          name: "TIMER",
          description: "Intervalo de transmissão com ignição ligada (10s–720s)",
          example: "TIMER,60#",
        },
        {
          name: "SLPON#",
          description: "Ativa modo economia de energia",
          example: "SLPON#",
        },
        {
          name: "SLPOFF#",
          description: "Desativa modo economia de energia",
          example: "SLPOFF#",
        },
        {
          name: "STATIC",
          description: "Tempo parado em minutos (modo SLPOFF)",
          example: "STATIC,60#",
        },
        {
          name: "SLEEP",
          description: "Tempo de sleep em minutos (modo SLPON, 2–10)",
          example: "SLEEP,3#",
        },
        {
          name: "WAKE",
          description: "Ciclo de wake em horas (modo SLPON, 1–168)",
          example: "WAKE,24#",
        },
      ],
    },
    {
      title: "Heartbeat",
      commands: [
        {
          name: "HBT",
          description: "Define intervalo de heartbeat (armado e desarmado)",
          example: "HBT,1,5#",
        },
      ],
    },
    {
      title: "Protocolo de Comunicação",
      commands: [
        {
          name: "SETLOCX12#",
          description: "Protocolo GT06 (frame básico 0x12)",
          example: "SETLOCX12#",
        },
        {
          name: "SETLOCX22#",
          description: "Protocolo NT20 (frame completo 0x22)",
          example: "SETLOCX22#",
        },
      ],
    },
    {
      title: "Localização",
      commands: [
        {
          name: "WHERE#",
          description: "Envia localização atual do rastreador",
          example: "WHERE#",
        },
        {
          name: "123",
          description: "Força comunicação GPRS da posição",
          example: "123",
        },
        {
          name: "URL#",
          description: "Envia link do Google Maps com localização",
          example: "URL#",
        },
      ],
    },
    {
      title: "Hodômetro",
      commands: [
        {
          name: "MILEAGE",
          description: "Ativa/desativa hodômetro (0=desativa, 1=ativa)",
          example: "MILEAGE,1#",
        },
        {
          name: "MILSET",
          description: "Define valor inicial do hodômetro em km",
          example: "MILSET,100#",
        },
        {
          name: "CMIL#",
          description: "Zera o hodômetro",
          example: "CMIL#",
        },
        {
          name: "SMIL#",
          description: "Lê o valor atual do hodômetro",
          example: "SMIL#",
        },
      ],
    },
    {
      title: "Alarme de Velocidade",
      commands: [
        {
          name: "STIME",
          description: "Intervalo do alerta de velocidade em minutos",
          example: "STIME,10#",
        },
        {
          name: "SPEEDING",
          description:
            "Define limite de velocidade em km/h (60–200) e duração",
          example: "SPEEDING,120,3#",
        },
      ],
    },
    {
      title: "Vibração",
      commands: [
        {
          name: "VIBRATION",
          description:
            "Sensibilidade do sensor de choque (1=mais sensível, 5=menos sensível)",
          example: "VIBRATION,3#",
        },
      ],
    },
    {
      title: "Reset / Fábrica",
      commands: [
        {
          name: "RESET#",
          description: "Reinicia o rastreador",
          example: "RESET#",
        },
        {
          name: "FACTORY#",
          description:
            "Restaura parâmetros de fábrica (exceto APN e IP/porta)",
          example: "FACTORY#",
        },
        {
          name: "CLRG#",
          description: "Reinicia o módulo GPS",
          example: "CLRG#",
        },
        {
          name: "CLRSMS#",
          description: "Limpa memória de SMS",
          example: "CLRSMS#",
        },
      ],
    },
    {
      title: "Modo Emergência",
      commands: [
        {
          name: "EMERG",
          description:
            "Define temporização do modo emergência (X=seg em movimento, Y=min parado)",
          example: "EMERG,60,60#",
        },
      ],
    },
    {
      title: "Número Central",
      commands: [
        {
          name: "CENTER",
          description: "Define número central para receber alarmes",
          example: "CENTER,A,+5511999999999#",
        },
      ],
    },
    {
      title: "Números SOS",
      commands: [
        {
          name: "SOS",
          description:
            "Adiciona/remove números SOS para receber SMS de alerta (até 3)",
          example: "SOS,A,+5511999999999,+5511888888888,+5511777777777#",
        },
      ],
    },
  ],
};

export default function HelpPage() {
  const { t } = useTranslation();
  const [trackerType, setTrackerType] = useState<TrackerType>("xt40");
  const categories = TRACKER_COMMANDS[trackerType] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ajuda</h1>
          <p className="text-muted-foreground">
            Referência de comandos SMS por tipo de rastreador.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Select value={trackerType} onValueChange={(value) => setTrackerType(value as TrackerType)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o rastreador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xt40">XT40-CAT1 (X3Tech)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {categories.map((category) => (
          <AccordionItem
            key={category.title}
            value={category.title}
            className="border rounded-lg px-4"
          >
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              {category.title}
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pb-2">
                {category.commands.map((cmd) => (
                  <div
                    key={cmd.name}
                    className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {cmd.name}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {cmd.description}
                    </p>
                    <code className="text-xs bg-muted rounded px-2 py-1 font-mono w-fit">
                      {cmd.example}
                    </code>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
