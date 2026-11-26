"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, CheckmarkCircle02Icon, Clock01Icon, Invoice01Icon, PiggyBankIcon } from "@hugeicons/core-free-icons"

import { DataLabel, METRIC_GRID, MetricCard, PageHeader } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { money, perMonth, perYear } from "@/lib/format"
import { procurementSummary, sparkSeries } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"

import { NewRequestDialog } from "./new-request-dialog"
import { PillarStrip } from "./pillar-strip"
import { RequestsTable } from "./requests-table"

export function ProcurementView() {
  const { state } = useSpend()
  const summary = procurementSummary(state)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Procurement"
        description="Cost-check every purchase against existing inventory and cheaper alternatives before it's approved."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            New purchase request
          </Button>
        }
      />

      <div className={METRIC_GRID}>
        <MetricCard icon={Clock01Icon} label="Pending requests"
          series={sparkSeries(summary.pending)} value={String(summary.pending)} hint="Pending review or in review" />
        <MetricCard
          icon={CheckmarkCircle02Icon}
          label="Approved requests"
          series={sparkSeries(summary.approved)}
          value={String(summary.approved)}
          hint="Optimized or as requested"
        />
        <MetricCard
          icon={Invoice01Icon}
          label="Total requested expenditure"
          series={sparkSeries(summary.requested)}
          value={perMonth(summary.requested)}
          hint={<span className="font-mono tabular-nums">{perYear(summary.requested * 12)}</span>}
        />
        <MetricCard
          icon={PiggyBankIcon}
          label="Avoided expenditure"
          series={sparkSeries(summary.avoided)}
          value={perMonth(summary.avoided)}
          tone="positive"
          hint={
            <span className="flex items-center gap-1.5">
              <span className="font-mono tabular-nums">{money(summary.avoided * 12)}/yr</span>
              <DataLabel kind="projected" />
            </span>
          }
        />
      </div>

      <PillarStrip />

      <RequestsTable onNewRequest={() => setDialogOpen(true)} />

      <NewRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
