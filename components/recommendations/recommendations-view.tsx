"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  DatabaseRestoreIcon,
  InformationCircleIcon,
  MoneySavingJarIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { DataLabel, EmptyState, METRIC_GRID, MetricCard, PageHeader } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { savings, sparkSeries } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

import {
  REC_FILTERS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  matchesStatus,
  sortRecs,
  type RecFilter,
  type RecSort,
  type StatusFilter,
} from "./filters"
import { RecommendationRow } from "./recommendation-row"
import { SavingsLedger } from "./savings-ledger"

export function RecommendationsView() {
  const { perMonth, perYear } = useMoney()
  const { state, setCopilotOpen, resetDemo } = useSpend()
  const [filter, setFilter] = React.useState<RecFilter>("all")
  const [status, setStatus] = React.useState<StatusFilter>("All")
  const [sort, setSort] = React.useState<RecSort>("savings")

  const s = savings(state)
  const byStatus = state.recommendations.filter((r) => matchesStatus(r, status))
  const active = REC_FILTERS.find((f) => f.key === filter) ?? REC_FILTERS[0]
  const rows = sortRecs(byStatus.filter(active.test), sort)
  const filtered = filter !== "all" || status !== "All"

  const reset = () => {
    setFilter("all")
    setStatus("All")
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recommendations"
        description="One action queue for cloud, vendor, procurement, contract and invoice savings."
        actions={
          <Button variant="outline" size="sm" onClick={() => setCopilotOpen(true)}>
            <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} />
            Ask SpendIQ AI
          </Button>
        }
      />

      <div className={METRIC_GRID}>
        <MetricCard
          icon={MoneySavingJarIcon}
          label="Total potential monthly savings"
          series={sparkSeries(s.potentialMonthly)}
          value={perMonth(s.potentialMonthly)}
          hint={<span className="font-mono tabular-nums">{perYear(s.potentialAnnual)} if all pending are approved</span>}
        />
        <MetricCard
          icon={CheckmarkCircle02Icon}
          label="Approved projected savings"
          series={sparkSeries(s.approvedMonthly)}
          value={perMonth(s.approvedMonthly)}
          tone="positive"
          hint={
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono tabular-nums">{perYear(s.approvedAnnual)}</span>
              <DataLabel kind="projected" />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="What does projected mean?"
                      className="inline-flex text-muted-foreground hover:text-foreground"
                    />
                  }
                >
                  <HugeiconsIcon icon={InformationCircleIcon} size={13} strokeWidth={2} />
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Projected savings are committed by an approval but not yet realized. They become realized once the
                  change ships and shows up on the next invoice or cloud bill.
                </TooltipContent>
              </Tooltip>
            </span>
          }
        />
        <MetricCard
          icon={Clock01Icon}
          label="Pending recommendations"
          series={sparkSeries(s.pendingCount)}
          value={String(s.pendingCount)}
          tone={s.pendingCount > 0 ? "warning" : "default"}
          hint="Awaiting a decision"
        />
        <MetricCard
          icon={CheckmarkCircle02Icon}
          label="Completed / approved actions"
          series={sparkSeries(s.approvedCount)}
          value={String(s.approvedCount)}
          hint={<span className="font-mono tabular-nums">{s.dismissedCount} dismissed</span>}
        />
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Filter recommendations" className="flex flex-wrap gap-1.5">
            {REC_FILTERS.map((f) => {
              const count = byStatus.filter(f.test).length
              const selected = f.key === filter
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-input/30",
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 font-mono text-[10px] tabular-nums",
                      selected ? "bg-primary-foreground/20" : "bg-muted",
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select items={STATUS_OPTIONS} value={status} onValueChange={(v) => v && setStatus(v as StatusFilter)}>
              <SelectTrigger size="sm" className="min-w-36" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select items={SORT_OPTIONS} value={sort} onValueChange={(v) => v && setSort(v as RecSort)}>
              <SelectTrigger size="sm" className="min-w-44" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">
            {rows.length} of {state.recommendations.length} recommendations
          </span>
          {filtered ? (
            <button type="button" onClick={reset} className="font-medium text-foreground hover:underline">
              Clear filters
            </button>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div className="divide-y border-t">
            {rows.map((rec) => (
              <RecommendationRow key={rec.id} rec={rec} />
            ))}
          </div>
        ) : state.recommendations.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No recommendations yet"
              description="Recommendations appear automatically as you add underutilized resources, unused seats or purchase requests."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    resetDemo()
                    toast.success("NCBA demo data loaded")
                  }}
                >
                  <HugeiconsIcon icon={DatabaseRestoreIcon} strokeWidth={1.8} />
                  Load demo data
                </Button>
              }
            />
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              title="No recommendations match these filters"
              description="Try another category or status. Decided items stay here so you can undo them."
              action={
                <Button size="sm" variant="outline" onClick={reset}>
                  Clear filters
                </Button>
              }
            />
          </div>
        )}
      </Card>

      <SavingsLedger />
    </div>
  )
}
