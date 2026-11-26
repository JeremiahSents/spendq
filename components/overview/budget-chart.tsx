"use client"

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"

import { SectionCard } from "@/components/shared/dashboard-ui"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { signedPct } from "@/lib/format"
import { budgetVsActual } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { CHART_CLASS } from "./chart-utils"

const config = {
  budget: { label: "Budget", theme: { light: "#d6d3d1", dark: "#57534e" } },
  actual: { label: "Actual", theme: { light: "#39B3E5", dark: "#39B3E5" } },
  over: { label: "Over budget", color: "var(--destructive)" },
} satisfies ChartConfig

const SHORT: Record<string, string> = {
  "Core Banking": "Core Banking",
  "Digital Channels": "Digital",
  "Cloud Platform": "Platform",
  "Data & Risk": "Data & Risk",
  Security: "Security",
}

export function BudgetChart() {
  const { money, axisMoney } = useMoney()
  const { state } = useSpend()
  const data = budgetVsActual(state)
  const overCount = data.filter((d) => d.over).length

  return (
    <SectionCard
      title="Budget vs actual"
      description={
        overCount > 0
          ? `${overCount} of ${data.length} over budget`
          : "All within budget"
      }
      action={
        <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
          <Swatch className="bg-[#d6d3d1] dark:bg-[#57534e]" label="Budget" />
          <Swatch className="bg-[#39B3E5]" label="Actual" />
          <Swatch className="bg-destructive" label="Over" />
        </div>
      }
    >
      <ChartContainer config={config} className={CHART_CLASS}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }} barGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="department"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
            tickFormatter={(d: string) => SHORT[d] ?? d}
          />
          <YAxis tickLine={false} axisLine={false} width={76} tickFormatter={axisMoney} />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(_v, _n, item, index) => {
                  if (index !== 0) return null
                  const d = item.payload as (typeof data)[number]
                  const delta = ((d.actual - d.budget) / d.budget) * 100
                  return (
                    <div className="grid w-full gap-1">
                      <span className="font-medium">{d.department}</span>
                      <Line label="Budget" value={money(d.budget)} />
                      <Line label="Actual" value={money(d.actual)} />
                      <span
                        className={
                          d.over
                            ? "font-mono text-destructive tabular-nums"
                            : "font-mono text-emerald-600 tabular-nums dark:text-emerald-400"
                        }
                      >
                        {signedPct(delta)} {d.over ? "over budget" : "under budget"}
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
          <Bar dataKey="budget" fill="var(--color-budget)" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar dataKey="actual" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.department} fill={d.over ? "var(--color-over)" : "var(--color-actual)"} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </SectionCard>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}/mo</span>
    </div>
  )
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-2 rounded-[2px] ${className}`} />
      {label}
    </span>
  )
}
