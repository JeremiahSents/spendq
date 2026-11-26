"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { DataLabel, SectionCard } from "@/components/shared/dashboard-ui"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { money } from "@/lib/format"
import { RANGE_LABEL, spendTrend } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { CHART_CLASS, CLOUD_COLOR, VENDOR_COLOR, axisMoney, moneyRow } from "./chart-utils"

const config = {
  cloud: { label: "Cloud infrastructure", theme: CLOUD_COLOR },
  vendor: { label: "Vendor & software", theme: VENDOR_COLOR },
} satisfies ChartConfig

export function SpendTrendChart() {
  const { state } = useSpend()
  const data = spendTrend(state)
  const latest = data[data.length - 1]
  const total = data.reduce((s, d) => s + d.cloud + d.vendor, 0)

  return (
    <SectionCard
      title={`Expenditure over time · ${RANGE_LABEL[state.range]}`}
      description={`${data.length} months shown · ${money(total)} cumulative · Nov ${money(latest.cloud + latest.vendor)}`}
      action={<DataLabel kind="simulated" />}
    >
      <ChartContainer config={config} className={CHART_CLASS}>
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="fill-cloud" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-cloud)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-cloud)" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={axisMoney} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" formatter={moneyRow(config)} />}
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
    </SectionCard>
  )
}
