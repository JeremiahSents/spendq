"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { DataLabel, SectionCard } from "@/components/shared/dashboard-ui"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { savings, savingsByBucket } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { AMBER_COLOR, CHART_CLASS, SAVINGS_COLOR, moneyRow } from "./chart-utils"

const config = {
  pending: { label: "Pending opportunity", theme: AMBER_COLOR },
  approved: { label: "Approved (Projected)", theme: SAVINGS_COLOR },
} satisfies ChartConfig

/** Rows come from SAVINGS_BUCKETS (via savingsByBucket); give each about 34px plus axis and legend. */
const ROW_HEIGHT = 34
const CHROME_HEIGHT = 56

export function SavingsBucketChart() {
  const { money, axisMoney } = useMoney()
  const { state } = useSpend()
  const data = savingsByBucket(state)
  const s = savings(state)

  return (
    <SectionCard
      title="Savings by category"
      description={`${money(s.potentialMonthly)}/mo pending · ${money(s.approvedMonthly)}/mo approved`}
      action={<DataLabel kind="projected" />}
    >
      <ChartContainer
        config={config}
        className={CHART_CLASS}
        style={{ height: Math.max(230, data.length * ROW_HEIGHT + CHROME_HEIGHT) }}
      >
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12, top: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={axisMoney} />
          <YAxis type="category" dataKey="bucket" tickLine={false} axisLine={false} width={124} interval={0} />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={<ChartTooltipContent formatter={moneyRow(money, config, "/mo")} />}
          />
          <Bar dataKey="approved" stackId="s" fill="var(--color-approved)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="pending" stackId="s" fill="var(--color-pending)" radius={[0, 4, 4, 0]} />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    </SectionCard>
  )
}
