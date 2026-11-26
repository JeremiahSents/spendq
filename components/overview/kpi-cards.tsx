"use client"

import { useState } from "react"
import { CloudIcon, PiggyBankIcon, Store01Icon, Wallet01Icon } from "@hugeicons/core-free-icons"

import { METRIC_GRID, MetricCard } from "@/components/shared/dashboard-ui"
import { cloudSummary, monthOverMonth, savings, vendorSummary, sparkSeries } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

export function KpiCards() {
  const { money } = useMoney()
  const { state } = useSpend()
  const cloud = cloudSummary(state)
  const vendor = vendorSummary(state)
  const mom = monthOverMonth(state)
  const s = savings(state)

  return (
    <div className={METRIC_GRID}>
      <MetricCard
        icon={Wallet01Icon}
        label="Total monthly expenditure"
          series={sparkSeries(cloud.total + vendor.total, "total")}
        value={money(cloud.total + vendor.total)}
        change={mom.total}
        invertChange
        hint="vs Oct · cloud + vendor"
      />
      <MetricCard
        icon={CloudIcon}
        label="Cloud infrastructure spend"
          series={sparkSeries(cloud.total, "cloud")}
        value={money(cloud.total)}
        change={mom.cloud}
        invertChange
        hint={`vs Oct · ${cloud.underutilized} of ${cloud.active} flagged`}
      />
      <MetricCard
        icon={Store01Icon}
        label="Vendor & software spend"
          series={sparkSeries(vendor.total, "vendor")}
        value={money(vendor.total)}
        change={mom.vendor}
        invertChange
        hint={`vs Oct · ${vendor.renewals90} renewals in 90d`}
      />
      <MetricCard
        icon={PiggyBankIcon}
        label="Potential monthly savings"
          series={sparkSeries(s.potentialMonthly, "cloud")}
        value={money(s.potentialMonthly)}
        tone={s.potentialMonthly > 0 ? "warning" : "positive"}
        hint={<ApprovedCallout monthly={s.approvedMonthly} annual={s.approvedAnnual} />}
      />
    </div>
  )
}

/** Live one-line "Approved projected" figure. Flashes briefly whenever the approved amount changes. */
function ApprovedCallout({ monthly, annual }: { monthly: number; annual: number }) {
  const { perMonth, perYear } = useMoney()
  const [prev, setPrev] = useState(monthly)
  const [pulse, setPulse] = useState(0)
  if (monthly !== prev) {
    setPrev(monthly)
    setPulse((p) => p + 1)
  }

  return (
    <span className="relative -mx-1 inline-flex max-w-full items-center gap-1 rounded px-1" aria-live="polite">
      {pulse > 0 ? (
        <span
          key={pulse}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded bg-emerald-500/25 animate-out fade-out-0 fill-mode-forwards duration-1000 motion-reduce:hidden"
        />
      ) : null}
      <span className="relative truncate">Approved projected:</span>
      <span
        key={`v-${pulse}`}
        className={cn(
          "relative truncate font-mono text-emerald-700 tabular-nums dark:text-emerald-400",
          pulse > 0 && "animate-in fade-in-0 slide-in-from-bottom-1 duration-300",
        )}
      >
        {perMonth(monthly)} · {perYear(annual)}
      </span>
    </span>
  )
}
