"use client"

import { useState } from "react"
import { CloudIcon, PiggyBankIcon, Store01Icon, Wallet01Icon } from "@hugeicons/core-free-icons"

import { MetricCard } from "@/components/shared/dashboard-ui"
import { money, perMonth, perYear } from "@/lib/format"
import { cloudSummary, monthOverMonth, savings, vendorSummary } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

export function KpiCards() {
  const { state } = useSpend()
  const cloud = cloudSummary(state)
  const vendor = vendorSummary(state)
  const mom = monthOverMonth(state)
  const s = savings(state)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={Wallet01Icon}
        label="Total monthly expenditure"
        value={money(cloud.total + vendor.total)}
        change={mom.total}
        invertChange
        hint="vs Oct · cloud + vendor run-rate"
      />
      <MetricCard
        icon={CloudIcon}
        label="Cloud infrastructure spend"
        value={money(cloud.total)}
        change={mom.cloud}
        invertChange
        hint={`vs Oct · ${cloud.active} resources, ${cloud.underutilized} flagged`}
      />
      <MetricCard
        icon={Store01Icon}
        label="Vendor & software spend"
        value={money(vendor.total)}
        change={mom.vendor}
        invertChange
        hint={`vs Oct · ${vendor.active} vendors, ${vendor.renewals90} renewing in 90d`}
      />
      <MetricCard
        icon={PiggyBankIcon}
        label="Potential monthly savings"
        value={money(s.potentialMonthly)}
        tone={s.potentialMonthly > 0 ? "warning" : "positive"}
        hint={`${s.pendingCount} pending recommendations · ${perYear(s.potentialAnnual)}`}
      >
        <ApprovedCallout monthly={s.approvedMonthly} annual={s.approvedAnnual} count={s.approvedCount} />
      </MetricCard>
    </div>
  )
}

/** Live "Approved projected" line. Flashes briefly whenever the approved figure changes. */
function ApprovedCallout({ monthly, annual, count }: { monthly: number; annual: number; count: number }) {
  const [prev, setPrev] = useState(monthly)
  const [pulse, setPulse] = useState(0)
  if (monthly !== prev) {
    setPrev(monthly)
    setPulse((p) => p + 1)
  }

  return (
    <div
      className="relative mt-2 overflow-hidden rounded-md border border-emerald-500/25 bg-emerald-500/5 px-2 py-1.5"
      aria-live="polite"
    >
      {pulse > 0 ? (
        <span
          key={pulse}
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-emerald-500/25 animate-out fade-out-0 fill-mode-forwards duration-1000 motion-reduce:hidden"
        />
      ) : null}
      <div className="relative flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          Approved projected{count > 0 ? ` · ${count}` : ""}
        </span>
        <span
          key={`v-${pulse}`}
          className={cn(
            "font-mono font-medium text-emerald-700 tabular-nums dark:text-emerald-400",
            pulse > 0 && "animate-in fade-in-0 slide-in-from-bottom-1 duration-300",
          )}
        >
          {perMonth(monthly)} · {perYear(annual)}
        </span>
      </div>
    </div>
  )
}
