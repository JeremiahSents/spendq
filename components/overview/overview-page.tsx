"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { CloudIcon, ContractsIcon, DatabaseRestoreIcon, ShoppingCart01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { AddDataMenu } from "@/components/forms/add-data-menu"
import { AddResourceDialog } from "@/components/forms/add-resource-dialog"
import { AddVendorDialog } from "@/components/forms/add-vendor-dialog"
import { DataLabel, EmptyState, PageHeader } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
  const { state, resetDemo } = useSpend()
  const [dialog, setDialog] = React.useState<"resource" | "vendor" | null>(null)
  const isEmpty = state.resources.length === 0 && state.vendors.length === 0 && state.requests.length === 0

  return (
    <>
      <PageHeader
        title="Spend Overview"
        actions={
          <>
            {!state.blankMode ? <DataLabel kind="simulated" /> : null}
            <AddDataMenu />
          </>
        }
      />
      <KpiCards />
      {isEmpty ? (
        <Card className="p-4">
          <EmptyState
            title="Start from scratch or load the NCBA demo estate"
            description="Add a cloud resource, vendor contract or purchase request to watch SpendIQ score spend and savings live, or load the full simulated dataset in one click."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setDialog("resource")}>
                  <HugeiconsIcon icon={CloudIcon} strokeWidth={1.8} />
                  Add cloud resource
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDialog("vendor")}>
                  <HugeiconsIcon icon={ContractsIcon} strokeWidth={1.8} />
                  Add vendor
                </Button>
                <Button size="sm" variant="outline" render={<Link href="/procurement?new=1" />}>
                  <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={1.8} />
                  New purchase request
                </Button>
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
              </div>
            }
          />
          <AddResourceDialog open={dialog === "resource"} onOpenChange={(o) => setDialog(o ? "resource" : null)} />
          <AddVendorDialog open={dialog === "vendor"} onOpenChange={(o) => setDialog(o ? "vendor" : null)} />
        </Card>
      ) : (
        <>
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
      )}
    </>
  )
}
