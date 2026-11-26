"use client"

import { Calendar03Icon, Invoice01Icon, MoneySavingJarIcon, Store01Icon } from "@hugeicons/core-free-icons"

import { DataLabel, MetricCard, PageHeader } from "@/components/shared/dashboard-ui"
import { money, perMonth, perYear } from "@/lib/format"
import { upcomingRenewals, vendorSummary } from "@/lib/store/selectors"
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Invoice01Icon}
          label="Total vendor expenditure"
          value={perMonth(summary.total)}
          hint={<span className="font-mono tabular-nums">{perYear(summary.total * 12)} annualized</span>}
        />
        <MetricCard
          icon={Store01Icon}
          label="Active vendors"
          value={String(summary.active)}
          hint={`${flagged} flagged for optimization`}
        />
        <MetricCard
          icon={Calendar03Icon}
          label="Upcoming renewals (90 days)"
          value={String(summary.renewals90)}
          tone={summary.renewals90 > 0 ? "warning" : "default"}
          hint={
            renewals.length > 0 ? (
              <span>
                <span className="font-mono tabular-nums">{money(renewalValue)}/yr</span> up for renewal · next{" "}
                {renewals[0].vendor.name} in <span className="font-mono tabular-nums">{renewals[0].days}d</span>
              </span>
            ) : (
              "Nothing renews in the next 90 days"
            )
          }
        />
        <MetricCard
          icon={MoneySavingJarIcon}
          label="Potential vendor savings"
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
