"use client"

import { Calendar03Icon, Invoice01Icon, MoneySavingJarIcon, Store01Icon } from "@hugeicons/core-free-icons"

import { DataLabel, METRIC_GRID, MetricCard, PageHeader } from "@/components/shared/dashboard-ui"
import { money, perMonth, perYear } from "@/lib/format"
import { upcomingRenewals, vendorSummary, sparkSeries } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"

import { RenewalTimeline } from "./renewal-timeline"
import { VendorDirectory } from "./vendor-directory"

export function VendorsView() {
  const { state } = useSpend()
  const summary = vendorSummary(state)
  const renewals = upcomingRenewals(state, 90)
  const renewalValue = renewals.reduce((s, r) => s + r.annual, 0)
  const flagged = state.recommendations.filter((r) => r.source === "vendor" && r.status === "Pending").length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendors"
        description="SaaS, AI and enterprise software contracts, license utilization and renewals."
        actions={<DataLabel kind="simulated" />}
      />

      <div className={METRIC_GRID}>
        <MetricCard
          icon={Invoice01Icon}
          label="Total vendor expenditure"
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
          label="Upcoming renewals (90 days)"
          series={sparkSeries(summary.renewals90, "vendor")}
          value={String(summary.renewals90)}
          tone={summary.renewals90 > 0 ? "warning" : "default"}
          hint={
            renewals.length > 0 ? (
              <span className="font-mono tabular-nums">
                {money(renewalValue)}/yr · next in {renewals[0].days}d
              </span>
            ) : (
              "None in 90 days"
            )
          }
        />
        <MetricCard
          icon={MoneySavingJarIcon}
          label="Potential vendor savings"
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
      <VendorDirectory />
    </div>
  )
}
