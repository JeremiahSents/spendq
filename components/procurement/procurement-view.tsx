"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, CheckmarkCircle02Icon, Clock01Icon, Invoice01Icon, PiggyBankIcon } from "@hugeicons/core-free-icons"

import { DataLabel, METRIC_GRID, MetricCard, PageHeader } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { procurementSummary, sparkSeries } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"

import { NewRequestDialog } from "./new-request-dialog"
import { PillarStrip } from "./pillar-strip"
import { RequestsTable } from "./requests-table"

export function ProcurementView() {
  const { perMonth, perYear } = useMoney()
  const { state } = useSpend()
  const summary = procurementSummary(state)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Procurement"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            New purchase request
          </Button>
        }
      />

      <div className={METRIC_GRID}>
        <MetricCard
          icon={Clock01Icon}
          label="Pending"
          series={sparkSeries(summary.pending)}
          value={String(summary.pending)}
          hint="Awaiting decision"
        />
        <MetricCard
          icon={CheckmarkCircle02Icon}
          label="Approved"
          series={sparkSeries(summary.approved)}
          value={String(summary.approved)}
          hint="Optimized or standard"
        />
        <MetricCard
          icon={Invoice01Icon}
          label="Total requested"
          series={sparkSeries(summary.requested)}
          value={perMonth(summary.requested)}
          hint={<span className="font-mono tabular-nums">{perYear(summary.requested * 12)}</span>}
        />
        <MetricCard
          icon={PiggyBankIcon}
          label="Avoided spend"
          series={sparkSeries(summary.avoided)}
          value={perMonth(summary.avoided)}
          tone="positive"
          hint={
            <span className="flex items-center gap-1.5">
              <span className="font-mono tabular-nums">{perYear(summary.avoided * 12)}</span>
              <DataLabel kind="projected" />
            </span>
          }
        />
      </div>

      <PillarStrip />

      <RequestsTable onNewRequest={() => setDialogOpen(true)} />

      <NewRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <React.Suspense fallback={null}>
        <OpenFromQuery onOpen={() => setDialogOpen(true)} />
      </React.Suspense>
    </div>
  )
}

/** `/procurement?new=1` (from the "Add data" menu) opens the request dialog, then drops the param. */
function OpenFromQuery({ onOpen }: { onOpen: () => void }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const wantsNew = params.get("new") === "1"

  React.useEffect(() => {
    if (!wantsNew) return
    onOpen()
    router.replace(pathname, { scroll: false })
  }, [wantsNew, onOpen, router, pathname])

  return null
}
