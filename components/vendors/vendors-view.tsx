"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Calendar03Icon, Invoice01Icon, MoneySavingJarIcon, Store01Icon } from "@hugeicons/core-free-icons"

import { AddVendorDialog } from "@/components/forms/add-vendor-dialog"
import { DataLabel, METRIC_GRID, MetricCard, PageHeader } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { sparkSeries, sum, upcomingRenewals, vendorSummary, workspaceTotal } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"

import { RenewalTimeline } from "./renewal-timeline"
import { VendorDirectory } from "./vendor-directory"

export function VendorsView() {
  const { money, perMonth, perYear } = useMoney()
  const { state } = useSpend()
  const [addOpen, setAddOpen] = React.useState(false)
  const summary = vendorSummary(state)
  const renewals = upcomingRenewals(state, 90)
  const renewalValue = workspaceTotal(state.workspace, sum(renewals, (renewal) => renewal.annual))
  const flagged = state.recommendations.filter((r) => r.source === "vendor" && r.status === "Pending").length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendors"
        actions={
          <div className="flex items-center gap-2">
            {!state.blankMode ? <DataLabel kind="simulated" /> : null}
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
              Add vendor
            </Button>
          </div>
        }
      />
      <AddVendorDialog open={addOpen} onOpenChange={setAddOpen} />

      <div className={METRIC_GRID}>
        <MetricCard
          icon={Invoice01Icon}
          label="Vendor spend"
          series={sparkSeries(summary.total, "vendor")}
          value={perMonth(summary.total)}
          hint={<span className="font-mono tabular-nums">{perYear(summary.total * 12)}</span>}
        />
        <MetricCard
          icon={Store01Icon}
          label="Active vendors"
          series={sparkSeries(summary.active, "vendor")}
          value={String(summary.active)}
          hint={`${flagged} flagged`}
        />
        <MetricCard
          icon={Calendar03Icon}
          label="Renewals (90d)"
          series={sparkSeries(summary.renewals90, "vendor")}
          value={String(summary.renewals90)}
          tone={summary.renewals90 > 0 ? "warning" : "default"}
          hint={
            renewals.length > 0 ? (
              <span className="font-mono tabular-nums">
                {money(renewalValue, { compact: true })}/yr · next in {renewals[0].days}d
              </span>
            ) : (
              "None in 90d"
            )
          }
        />
        <MetricCard
          icon={MoneySavingJarIcon}
          label="Potential savings"
          series={sparkSeries(summary.potential, "vendor")}
          value={perMonth(summary.potential)}
          tone={summary.potential > 0 ? "positive" : "default"}
          hint={
            <span className="flex items-center gap-1.5">
              <span className="font-mono tabular-nums">{perYear(summary.potential * 12)}</span>
              <DataLabel kind="projected" />
            </span>
          }
        />
      </div>

      <RenewalTimeline />
      <VendorDirectory onAddVendor={() => setAddOpen(true)} />
    </div>
  )
}
