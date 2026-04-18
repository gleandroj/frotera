---
name: visao_periodo_preco_mercado
overview: "Benchmark Preço vs Mercado: granularidade dia/semana/mês, filtro/série por tipo de combustível, cadastro de preço médio de mercado manual (diário ou mensal) por org/UF/combustível, e base conceitual para gasto real vs estimado (faseada)."
todos:
  - id: benchmark-dto
    content: Adicionar parâmetros groupBy (day/week/month) e fuelType opcional no DTO de benchmark
    status: pending
  - id: benchmark-service-grouping
    content: Agrupamento dinâmico no benchmark + opção filtrar/agregar por fuelType
    status: pending
  - id: benchmark-api-client
    content: Atualizar fuelReportsAPI.benchmark (groupBy, fuelType)
    status: pending
  - id: benchmark-page-toggle
    content: UI Dia/Semana/Mês + seletor de combustível (Todos ou um tipo)
    status: pending
  - id: benchmark-i18n-period-labels
    content: Traduções groupBy + labels de combustível no benchmark
    status: pending
  - id: period-format-week
    content: Estender formatReportPeriodKey para chave semanal ISO (YYYY-Www)
    status: pending
  - id: manual-market-schema
    content: "Modelar lançamentos manuais de mercado (org + UF + fuelType + período DAY|MONTH + avgPrice, unique, precedência sobre API)"
    status: pending
  - id: manual-market-api-ui
    content: "CRUD REST + tela simples (lista/tabela + criar/editar) para lançamentos manuais"
    status: pending
  - id: resolve-market-price
    content: "Serviço de resolução: manual vigente > snapshot API; usar ao gravar marketPriceRef no FuelLog e nos relatórios"
    status: pending
  - id: estimated-spend-phase2
    content: "Opcional fase 2: gasto estimado sem log (híbrido km real + fallback km/l); só após critérios de dados mínimos"
    status: pending
isProject: false
---

# Plano: Preço vs Mercado (período + combustível + mercado manual)

## Objetivos do produto

1. **Visão temporal** no benchmark: dia, semana (ISO, segunda a domingo), mês.
2. **Diferenciação por combustível**: filtrar ou exibir análise por `FuelType` (evita misturar gasolina com diesel no mesmo preço médio pago/mercado).
3. **Lançamento manual do preço médio de mercado** (diário ou mensal), por organização, com uso explícito nos cálculos.
4. **Clareza entre “dado congelado no log” vs “curva de referência de mercado”** e caminho para **gasto estimado** quando não há `FuelLog`.

## Estado atual (código / schema)

- [`FuelLog`](apps/api/prisma/schema.prisma): `fuelType`, `liters`, `pricePerLiter`, `totalCost`, **`marketPriceRef`** (snapshot no momento do registro).
- [`FuelPriceSnapshot`](apps/api/prisma/schema.prisma): `state`, `fuelType`, `avgPrice`, `refDate`, `source` (default API externa).
- [`getBenchmarkReport`](apps/api/src/fuel-reports/fuel-reports.service.ts): agrega **só** logs com `marketPriceRef` preenchido; série hoje é **mensal fixa** no código.

## Modelo mental dos dados (o que é o quê)

| Conceito | O que representa | Bom para | Limitações |
|----------|------------------|----------|------------|
| **`pricePerLiter` / `totalCost` no `FuelLog`** | Gasto **real** declarado no abastecimento | Custo real, comparar com mercado naquele dia, auditoria | Depende de lançamentos corretos e completos; sem log não há custo real |
| **`marketPriceRef` no `FuelLog`** | “Quanto era o mercado de referência **na hora** em que aquele log foi criado/atualizado” | Comparar preço pago vs referência **imutável** no histórico; não muda se o mercado for revisado depois | Se a referência estava errada na época, o log fica com valor “velho”; corrigir exige política (reprocessar ou manter) |
| **`FuelPriceSnapshot` (API)** | Média estadual por tipo e data (fonte externa) | Benchmark automático, tendência de mercado | Pode não refletir sua região/posto; pode falhar a API |
| **Lançamento manual de mercado (novo)** | Referência **explicitamente definida** pela operação (diária ou mensal) | Ajustar UF/tipo, meses sem API, “preço interno de teto”, relatórios alinhados à realidade local | Exige disciplina de cadastro; conflito com API exige regra de precedência |

**Recomendação de uso em análises**

- **Útil**: manter `marketPriceRef` como auditoria do valor usado naquele abastecimento; usar **tabela manual + API** como “fonte da verdade atual” para novos logs e para **séries agregadas** quando quiser recalcular com referência revisada.
- **Pouco útil / arriscado**: misturar todos os combustíveis num único ponto do gráfico; usar “gasto estimado” sem definir de onde vêm os **km rodados** (risco de número bonito e errado).

## Decisão sugerida: gasto estimado sem `FuelLog`

**Sugestão de produto (meta)**: modelo **híbrido** — km rodados reais quando existirem (ex.: delta de odômetro entre abastecimentos ou, no futuro, sinais de rastreador); se não houver base de km confiável, **fallback** para consumo médio histórico (km/l) do veículo, com rótulo claro “estimativa”.

**Primeira entrega (fase 1)**: implementar **período + combustível + mercado manual + resolução de preço**; deixar **gasto estimado sem log** como **fase 2** com mínimo de dados (ex.: N dias de odômetro ou M logs de consumo) para não exibir KPI enganoso.

## Desenho técnico proposto

### A) Benchmark: `groupBy` + `fuelType`

- Query: `groupBy=day|week|month`, `fuelType` opcional (omitido = agrega todos os tipos **ou** exige escolha “Todos” com série única ponderada por litros — preferível **filtrar um tipo** para leitura clara).
- Backend: mesma lógica de agregação ponderada por `liters` para `avgPricePaid` e `marketAvgPrice` (via `marketPriceRef`), agrupando pela chave de período.
- Frontend: alinhar UX ao relatório de custos (botões segmentados) + select de combustível.

### B) Lançamentos manuais de mercado

- Novo modelo (ex.: `OrganizationFuelMarketPrice`) ou extensão controlada de `FuelPriceSnapshot` com **`organizationId`** opcional e `source = manual`.
- Campos mínimos: `organizationId`, `state` (UF), `fuelType`, `granularity` (`DAY` | `MONTH`), `refDate` (normalizado: dia 00:00 ou primeiro dia do mês), `avgPrice`, `createdBy`, timestamps.
- **Unique**: `(organizationId, state, fuelType, granularity, refDate)` para evitar duplicata.
- **Precedência na resolução**: para aquela org+UF+tipo+data, **manual vigente** vence snapshot da API; se não houver manual, usa API.

### C) `marketPriceRef` no create/update de `FuelLog`

- Ao salvar log, preencher `marketPriceRef` chamando o **resolvedor** (manual > API) para `state` do log (ou UF da org) + `fuelType` + `date`.

### D) Fase 2 — Gasto estimado

- Entrada: km no período (fonte a definir: odômetro em logs, ou telemetria), litros estimados = km / consumo de referência, custo estimado = litros × preço mercado resolvido.
- Exibir sempre como **estimativa** e com critérios de qualidade de dados.

## Arquivos principais a tocar (fase 1)

- API: [`fuel-reports.dto.ts`](apps/api/src/fuel-reports/fuel-reports.dto.ts), [`fuel-reports.service.ts`](apps/api/src/fuel-reports/fuel-reports.service.ts), novo módulo/controller de lançamentos manuais, [`FuelService`](apps/api/src/fuel/) (create/update + resolver).
- Web: [`benchmark/page.tsx`](apps/web/app/dashboard/fuel/reports/benchmark/page.tsx), [`api-client.ts`](apps/web/lib/frontend/api-client.ts), [`format-report-period.ts`](apps/web/lib/format-report-period.ts), i18n, nova rota `/dashboard/fuel/market-prices` (nome a ajustar).

## Validação

- Benchmark com `groupBy` e `fuelType` retorna série ordenada e KPIs coerentes com logs filtrados.
- CRUD manual: criar mês e dia para mesma UF/tipo; garantir que o resolvedor escolhe o registro correto (mês vs dia).
- Criar `FuelLog` após manual: `marketPriceRef` reflete o manual quando aplicável.
