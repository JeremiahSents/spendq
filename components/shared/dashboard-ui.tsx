/**
 * Shared dashboard building blocks, adapted from the Coinz admin patterns
 * (PageHeader, MetricCard, ChangePill, StatusBadge) and restyled for SpendIQ.
 */
import { useId, type ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { Pillar, RecStatus, Risk } from "@/lib/data/types"
import { cn } from "@/lib/utils"

type IconData = Parameters<typeof HugeiconsIcon>[0]["icon"]

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** Grid for a row of MetricCards: four across from small screens up. */
export const METRIC_GRID = "grid grid-cols-2 gap-3 sm:grid-cols-4"

const TONE_STROKE: Record<"default" | "positive" | "warning" | "negative", string> = {
  default: "var(--brand)",
  positive: "#10b981",
  warning: "#f59e0b",
  negative: "var(--destructive)",
}

/**
 * Summary tile, mirrored from the Coinz MetricCard: label with a bare icon,
 * tabular figure with a delta pill, one hint line, and a compact sparkline on
 * the right when the card has room.
 */
export function MetricCard({
  icon,
  label,
  value,
  change,
  invertChange,
  hint,
  tone = "default",
  series,
  seriesLabel,
  children,
}: {
  icon?: IconData
  label: string
  value: string
  /** Percent change vs the previous period. */
  change?: number | null
  /** Treat an increase as bad (spend). */
  invertChange?: boolean
  hint?: ReactNode
  tone?: "default" | "positive" | "warning" | "negative"
  /** Oldest-to-newest values for the trend glyph. */
  series?: number[]
  /** Accessible description of the trend. */
  seriesLabel?: string
  children?: ReactNode
}) {
  return (
    <Card className="@container min-w-0 gap-0 px-3.5 pt-3 pb-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {icon ? <HugeiconsIcon icon={icon} size={13} strokeWidth={1.8} className="shrink-0" /> : null}
            <span className="truncate text-xs">{label}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
            <span
              className={cn(
                "truncate font-heading text-lg font-medium tracking-[-0.025em] tabular-nums @[15rem]:text-xl",
                tone === "positive" && "text-emerald-600 dark:text-emerald-400",
                tone === "warning" && "text-amber-600 dark:text-amber-400",
                tone === "negative" && "text-destructive",
              )}
            >
              {value}
            </span>
            {change !== undefined && change !== null ? <ChangePill change={change} invert={invertChange} /> : null}
          </div>
        </div>
        {series && series.length > 1 ? <Sparkline series={series} stroke={TONE_STROKE[tone]} label={seriesLabel ?? `${label} trend`} /> : null}
      </div>
      {hint ? <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div> : null}
      {children}
    </Card>
  )
}

function Sparkline({ series, stroke, label }: { series: number[]; stroke: string; label: string }) {
  const gradientId = `spark-${useId().replace(/:/g, "")}`
  const width = 64
  const height = 30
  const pad = 2
  const max = Math.max(...series)
  const min = Math.min(...series)
  const span = max - min || 1
  const points = series.map((v, i) => ({
    x: (i / (series.length - 1)) * width,
    y: pad + (1 - (v - min) / span) * (height - pad * 2),
  }))
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  return (
    <svg
      width="56"
      height="30"
      viewBox={`0 0 ${width} ${height}`}
      className="hidden shrink-0 overflow-visible @[12rem]:block"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChangePill({ change, invert }: { change: number; invert?: boolean }) {
  const rounded = Math.round(change * 10) / 10
  const up = rounded > 0
  const good = invert ? !up : up
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums",
        rounded === 0 && "bg-muted text-muted-foreground",
        rounded !== 0 && good && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        rounded !== 0 && !good && "bg-destructive/10 text-destructive",
      )}
    >
      {up ? "+" : ""}
      {rounded}%
    </span>
  )
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Classes for the body wrapper; it is a flex column that fills the card. */
  bodyClassName?: string
}) {
  return (
    <Card className={cn("min-w-0 gap-3 py-4", className)}>
      <div className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col px-4", bodyClassName)}>{children}</div>
    </Card>
  )
}

const RISK_CLASS: Record<Risk, string> = {
  Low: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Medium: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  High: "border-destructive/25 bg-destructive/10 text-destructive",
}

export function RiskBadge({ risk, prefix = "" }: { risk: Risk; prefix?: string }) {
  return (
    <Badge variant="outline" className={RISK_CLASS[risk]}>
      {prefix}
      {risk} risk
    </Badge>
  )
}

const PILLAR_CLASS: Record<Pillar, string> = {
  Reuse: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  Innovate: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  Automate: "border-primary/20 bg-secondary text-secondary-foreground",
  Eliminate: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
}

export function PillarBadge({ pillar }: { pillar: Pillar }) {
  return (
    <Badge variant="outline" className={PILLAR_CLASS[pillar]}>
      {pillar}
    </Badge>
  )
}

const STATUS_CLASS: Record<RecStatus, string> = {
  Pending: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Dismissed: "border-border bg-muted text-muted-foreground",
}

export function RecStatusBadge({ status }: { status: RecStatus }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
      {status}
    </Badge>
  )
}

/** Generic tone badge for statuses that are not recommendations. */
export function ToneBadge({ tone, children }: { tone: "positive" | "warning" | "negative" | "neutral" | "info"; children: ReactNode }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        tone === "positive" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        tone === "warning" && "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        tone === "negative" && "border-destructive/25 bg-destructive/10 text-destructive",
        tone === "neutral" && "border-border bg-muted text-muted-foreground",
        tone === "info" && "border-brand/30 bg-brand/10 text-foreground",
      )}
    >
      {children}
    </Badge>
  )
}

/** Utilization bar: red under 20%, amber under 45%, green above. */
export function UtilizationBar({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return <span className="font-mono text-xs text-muted-foreground">n/a</span>
  return (
    <div className={cn("flex min-w-24 items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            value < 20 ? "bg-destructive" : value < 45 ? "bg-amber-500" : "bg-emerald-500",
          )}
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
      <span className="w-9 text-right font-mono text-xs tabular-nums">{value}%</span>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/** Marks figures as simulated baseline / projected, per the transparency rule. */
export function DataLabel({ kind }: { kind: "simulated" | "projected" }) {
  return (
    <span className="shrink-0 whitespace-nowrap rounded border border-dashed px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
      {kind === "simulated" ? "Simulated baseline" : "Projected"}
    </span>
  )
}
