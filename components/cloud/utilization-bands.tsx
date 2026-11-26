"use client"

import { SectionCard } from "@/components/shared/dashboard-ui"
import { money } from "@/lib/format"
import { sum } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

const BANDS = [
  { key: "low", label: "Under 20% CPU", hint: "Idle or oversized", bar: "bg-destructive", test: (c: number) => c < 20 },
  { key: "mid", label: "20–45% CPU", hint: "Right-size candidates", bar: "bg-amber-500", test: (c: number) => c >= 20 && c < 45 },
  { key: "high", label: "45% CPU and above", hint: "Healthy", bar: "bg-emerald-500", test: (c: number) => c >= 45 },
] as const

/** How many resources (and how much spend) sit in each 30-day average CPU band. */
export function UtilizationBands() {
  const { state } = useSpend()
  const compute = state.resources.filter((r) => r.cpu !== null)
  const noMetrics = state.resources.length - compute.length
  const max = Math.max(1, compute.length)

  return (
    <SectionCard title="Utilization distribution" description="Resources by 30-day average CPU">
      <div className="space-y-3">
        {BANDS.map((band) => {
          const items = compute.filter((r) => band.test(r.cpu as number))
          return (
            <div key={band.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium">
                  {band.label} <span className="font-normal text-muted-foreground">· {band.hint}</span>
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {items.length} · {money(sum(items, (r) => r.monthlyCost))}/mo
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", band.bar)} style={{ width: `${(items.length / max) * 100}%` }} />
              </div>
            </div>
          )
        })}
        <p className="border-t pt-2 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{noMetrics}</span> storage and platform services report no compute
          metrics and are assessed on access patterns instead.
        </p>
      </div>
    </SectionCard>
  )
}
