"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { SectionCard } from "@/components/shared/dashboard-ui"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { CloudProvider } from "@/lib/data/types"
import { recSavings, recommendationFor, sum, workspaceTotal } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"

const PROVIDERS: CloudProvider[] = ["AWS", "Azure", "DigitalOcean", "Vercel", "Neon"]

const config = {
  retained: { label: "Spend after savings", theme: { light: "#38302E", dark: "#B5ABA7" } },
  savings: { label: "Potential savings", theme: { light: "#059669", dark: "#34D399" } },
} satisfies ChartConfig

/** Monthly cloud cost per provider, split into what stays and what pending recommendations remove. */
export function CostByProviderChart({ className }: { className?: string }) {
  const { money } = useMoney()
  const { state } = useSpend()

  const data = React.useMemo(
    () =>
      PROVIDERS.map((provider) => {
        const resources = state.resources.filter((r) => r.provider === provider)
        const total = sum(resources, (r) => r.monthlyCost)
        const savings = sum(resources, (r) => {
          const rec = recommendationFor(state, r.id)
          return rec?.status === "Pending" ? recSavings(rec) : 0
        })
        return {
          provider,
          total: workspaceTotal(state.workspace, total),
          retained: workspaceTotal(state.workspace, total - savings),
          savings: workspaceTotal(state.workspace, savings),
        }
      }).filter((d) => d.total > 0),
    [state],
  )

  return (
    <SectionCard
      title="Cost by provider"
      description="Retained spend vs pending savings"
      className={className}
    >
      {data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-xs text-muted-foreground">
          Add a cloud resource to see monthly spend by provider.
        </div>
      ) : (
      <ChartContainer config={config} className="aspect-auto h-52 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 0 }} barSize={16}>
          <CartesianGrid horizontal={false} />
          <YAxis dataKey="provider" type="category" tickLine={false} axisLine={false} width={84} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => money(v, { compact: true })}
            className="font-mono"
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">{config[name as keyof typeof config]?.label ?? name}</span>
                    <span className="font-mono tabular-nums">{money(Number(value))}/mo</span>
                  </div>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="retained" stackId="cost" fill="var(--color-retained)" radius={[3, 0, 0, 3]} />
          <Bar dataKey="savings" stackId="cost" fill="var(--color-savings)" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ChartContainer>
      )}
    </SectionCard>
  )
}
