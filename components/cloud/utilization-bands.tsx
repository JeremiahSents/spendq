"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

import { SectionCard } from "@/components/shared/dashboard-ui"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { money } from "@/lib/format"
import { sum } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"

const config = {
  low: { label: "Under 20% · idle or oversized", theme: { light: "#DC2626", dark: "#F87171" } },
  mid: { label: "20–45% · right-size candidates", theme: { light: "#D97706", dark: "#FBBF24" } },
  high: { label: "45%+ · healthy", theme: { light: "#059669", dark: "#34D399" } },
} satisfies ChartConfig

const BANDS = [
  { key: "low", short: "< 20%", test: (c: number) => c < 20 },
  { key: "mid", short: "20–45%", test: (c: number) => c >= 20 && c < 45 },
  { key: "high", short: "45%+", test: (c: number) => c >= 45 },
] as const

/** How many resources (and how much spend) sit in each 30-day average CPU band. */
export function UtilizationBands() {
  const { state } = useSpend()
  const noMetrics = state.resources.filter((r) => r.cpu === null).length

  const data = React.useMemo(() => {
    const compute = state.resources.filter((r) => r.cpu !== null)
    return BANDS.map((band) => {
        const items = compute.filter((r) => band.test(r.cpu as number))
        return {
          band: band.key,
          short: band.short,
          count: items.length,
          spend: sum(items, (r) => r.monthlyCost),
          fill: `var(--color-${band.key})`,
        }
      })
  }, [state.resources])

  return (
    <SectionCard title="Utilization distribution" description="Resources by 30-day average CPU">
      <ChartContainer config={config} className="aspect-auto h-40 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 28, top: 0, bottom: 0 }} barSize={14}>
          <CartesianGrid horizontal={false} />
          <YAxis dataKey="short" type="category" tickLine={false} axisLine={false} width={52} className="font-mono" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} className="font-mono" />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                nameKey="band"
                formatter={(value, _name, item) => {
                  const row = item.payload as (typeof data)[number]
                  return (
                    <div className="flex w-full flex-col gap-0.5">
                      <span className="text-muted-foreground">{config[row.band].label}</span>
                      <span className="font-mono tabular-nums">
                        {value} resources · {money(row.spend)}/mo
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
          <Bar dataKey="count" radius={3}>
            <LabelList dataKey="count" position="right" className="fill-foreground font-mono" fontSize={11} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">{noMetrics}</span> storage and platform services report no compute
        metrics and are assessed on access patterns instead.
      </p>
    </SectionCard>
  )
}
