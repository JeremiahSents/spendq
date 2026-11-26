"use client"

import { DataLabel, PageHeader } from "@/components/shared/dashboard-ui"
import { RANGE_LABEL } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { AnomaliesList } from "./anomalies-list"
import { BudgetChart } from "./budget-chart"
import { KpiCards } from "./kpi-cards"
import { ProviderBreakdownChart } from "./provider-breakdown-chart"
import { RecentRequests } from "./recent-requests"
import { SavingsBucketChart } from "./savings-bucket-chart"
import { SpendTrendChart } from "./spend-trend-chart"
import { TopOpportunities } from "./top-opportunities"
import { UpcomingRenewals } from "./upcoming-renewals"

export function OverviewPage() {
  const { state } = useSpend()
  return (
    <>
      <PageHeader
        title="Spend Overview"
        description="Monitor, optimize, and govern cloud and vendor technology spend."
        actions={
          <>
            <span className="text-xs text-muted-foreground">
              {state.workspace} · {RANGE_LABEL[state.range]}
            </span>
            <DataLabel kind="simulated" />
          </>
        }
      />
      <KpiCards />
      <div className="grid gap-4 lg:grid-cols-2">
        <SpendTrendChart />
        <ProviderBreakdownChart />
        <BudgetChart />
        <SavingsBucketChart />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TopOpportunities />
        <UpcomingRenewals />
        <RecentRequests />
        <AnomaliesList />
      </div>
    </>
  )
}
