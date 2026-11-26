"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { ChangePill, DataLabel, SectionCard } from "@/components/shared/dashboard-ui"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { RANGE_LABEL, monthOverMonth, spendTrend } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { CHART_CLASS, CLOUD_COLOR, VENDOR_COLOR, moneyRow } from "./chart-utils"

const config = {
  cloud: { label: "Cloud infrastructure", theme: CLOUD_COLOR },
  vendor: { label: "Vendor & software", theme: VENDOR_COLOR },
} satisfies ChartConfig

export function SpendTrendChart() {
  const { money, axisMoney } = useMoney()
  const { state } = useSpend()
  const data = spendTrend(state)
  const latest = data[data.length - 1]
  const first = data[0]
  const total = data.reduce((s, d) => s + d.cloud + d.vendor, 0)
  const mom = monthOverMonth(state)
  const firstTotal = first.cloud + first.vendor
  const growth = firstTotal > 0 ? ((latest.cloud + latest.vendor) / firstTotal - 1) * 100 : 0
  const stats = [
    { label: "Cloud · Nov", value: money(latest.cloud), change: mom.cloud },
    { label: "Vendor · Nov", value: money(latest.vendor), change: mom.vendor },
    { label: "Monthly average", value: money(total / data.length), change: null },
    { label: `Growth since ${first.month}`, value: `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`, change: null },
  ]

  return (
    <SectionCard
      title={`Expenditure over time · ${RANGE_LABEL[state.range]}`}
      description={`${data.length} months shown · ${money(total)} cumulative · Nov ${money(latest.cloud + latest.vendor)}`}
      action={<DataLabel kind="simulated" />}
    >
      <ChartContainer config={config} className={`${CHART_CLASS} min-h-[230px] flex-1`}>
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={76} tickFormatter={axisMoney} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" formatter={moneyRow(money, config)} />}
          />
          <Area
            dataKey="vendor"
            type="monotone"
            stackId="spend"
            stroke="var(--color-vendor)"
            fill="var(--color-vendor)"
            fillOpacity={0.25}
            strokeWidth={1.5}
          />
          <Area
            dataKey="cloud"
            type="monotone"
            stackId="spend"
            stroke="var(--color-cloud)"
            fill="var(--color-cloud)"
            fillOpacity={0.3}
            strokeWidth={1.5}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </AreaChart>
      </ChartContainer>
      <div className="@container mt-3">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border @[42rem]:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0 bg-card px-3 py-2.5">
              <dt className="truncate text-[11px] text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="font-mono text-sm font-medium tabular-nums">{s.value}</span>
                {s.change !== null ? <ChangePill change={s.change} invert /> : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </SectionCard>
  )
}
