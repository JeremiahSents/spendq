"use client"

import type { ReactNode } from "react"

import type { ChartConfig } from "@/components/ui/chart"
import { money } from "@/lib/format"

export const CLOUD_COLOR = { light: "#39B3E5", dark: "#39B3E5" }
export const VENDOR_COLOR = { light: "#38302E", dark: "#B5ABA7" }
export const SAVINGS_COLOR = { light: "#10b981", dark: "#10b981" }
export const AMBER_COLOR = { light: "#f59e0b", dark: "#f59e0b" }

export const CHART_CLASS = "aspect-auto h-[230px] w-full"

/** Compact axis ticks: $12k, $1.2M. */
export function axisMoney(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${n}`
}

/**
 * Tooltip row formatter for ChartTooltipContent: swatch, configured label and
 * a full-precision USD value, optionally with a suffix such as "/mo".
 */
export function moneyRow(config: ChartConfig, suffix = "", note?: (key: string) => ReactNode) {
  return function MoneyRow(value: unknown, name: unknown, item: { color?: string; payload?: { fill?: string } }) {
    const key = String(name)
    const label = config[key]?.label ?? key
    const color = item.color ?? item.payload?.fill
    return (
      <div className="flex w-full items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
        <span className="text-muted-foreground">
          {label}
          {note?.(key)}
        </span>
        <span className="ml-auto pl-3 font-mono font-medium text-foreground tabular-nums">
          {money(Number(value))}
          {suffix}
        </span>
      </div>
    )
  }
}
