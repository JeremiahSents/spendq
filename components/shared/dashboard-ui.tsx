/**
 * Shared dashboard building blocks, adapted from the Coinz admin patterns
 * (PageHeader, MetricCard, ChangePill, StatusBadge) and restyled for SpendIQ.
 */
import type { ReactNode } from "react"
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

/** Summary tile: label, tabular figure, delta pill and a comparison line. */
export function MetricCard({
  icon,
  label,
  value,
  change,
  invertChange,
  hint,
  tone = "default",
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
  children?: ReactNode
}) {
  return (
    <Card className="min-w-0 gap-0 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon ? <HugeiconsIcon icon={icon} size={14} strokeWidth={1.8} /> : null}
        <span className="truncate text-xs font-medium">{label}</span>
      </div>
      <div className="mt-1.5 flex min-w-0 items-baseline gap-2">
        <span
          className={cn(
            "truncate font-heading text-2xl font-semibold tracking-[-0.02em] tabular-nums",
            tone === "positive" && "text-emerald-600 dark:text-emerald-400",
            tone === "warning" && "text-amber-600 dark:text-amber-400",
            tone === "negative" && "text-destructive",
          )}
        >
          {value}
        </span>
        {change !== undefined && change !== null ? <ChangePill change={change} invert={invertChange} /> : null}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      {children}
    </Card>
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
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
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
      <div className="min-w-0 px-4">{children}</div>
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
        tone === "info" && "border-accent/40 bg-accent/15 text-foreground",
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
    <span className="rounded border border-dashed px-1 py-px font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
      {kind === "simulated" ? "Simulated baseline" : "Projected"}
    </span>
  )
}
