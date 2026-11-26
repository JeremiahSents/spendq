"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Alert02Icon,
  CloudIcon,
  MoneySavingJarIcon,
  ServerStack01Icon,
} from "@hugeicons/core-free-icons"

import { CostByProviderChart } from "@/components/cloud/cost-by-provider-chart"
import { ResourceInventory } from "@/components/cloud/resource-inventory"
import { UtilizationBands } from "@/components/cloud/utilization-bands"
import { AddResourceDialog } from "@/components/forms/add-resource-dialog"
import { DataLabel, METRIC_GRID, MetricCard, PageHeader } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { cloudSummary, sparkSeries } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"

export default function CloudPage() {
  const { money, perMonth, perYear } = useMoney()
  const { state } = useSpend()
  const summary = cloudSummary(state)
  const [addOpen, setAddOpen] = React.useState(false)

  return (
    <>
      <PageHeader
        title="Cloud Optimization"
        description="Infrastructure cost, utilization and right-sizing across AWS, Azure, DigitalOcean, Vercel and Neon."
        actions={
          <>
            <DataLabel kind="simulated" />
            <Button onClick={() => setAddOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              Add resource
            </Button>
          </>
        }
      />
      <AddResourceDialog open={addOpen} onOpenChange={setAddOpen} />

      <div className={METRIC_GRID}>
        <MetricCard
          icon={CloudIcon}
          label="Total cloud expenditure"
          series={sparkSeries(summary.total, "cloud")}
          value={perMonth(summary.total)}
          hint={<span className="font-mono tabular-nums">{perYear(summary.total * 12)} run rate</span>}
        />
        <MetricCard
          icon={ServerStack01Icon}
          label="Active resources"
          series={sparkSeries(summary.active, "cloud")}
          value={String(summary.active)}
          hint="Across 5 providers and 3 environments"
        />
        <MetricCard
          icon={Alert02Icon}
          label="Underutilized resources"
          series={sparkSeries(summary.underutilized, "cloud")}
          value={String(summary.underutilized)}
          tone="warning"
          hint={`${Math.round((summary.underutilized / Math.max(1, summary.active)) * 100)}% of inventory flagged`}
        />
        <MetricCard
          icon={MoneySavingJarIcon}
          label="Potential cloud savings"
          series={sparkSeries(summary.potential, "cloud")}
          value={`${money(summary.potential)}/mo`}
          tone="positive"
          hint={
            <span className="flex items-center gap-1.5">
              <span className="font-mono tabular-nums">{perYear(summary.potential * 12)}</span>
              <DataLabel kind="projected" />
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <CostByProviderChart className="lg:col-span-2" />
        <UtilizationBands />
      </div>

      <ResourceInventory onAddResource={() => setAddOpen(true)} />
    </>
  )
}
