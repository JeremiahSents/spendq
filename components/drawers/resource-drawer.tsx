"use client"

import type { ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Recycle03Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { resourceStatus } from "@/components/cloud/resource-status"
import { BrandLogo } from "@/components/shared/brand-logo"
import { DataLabel, EmptyState, PillarBadge, RiskBadge, ToneBadge } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { CloudResource, RecCategory } from "@/lib/data/types"
import { recSavings } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { useRecActions } from "@/lib/store/use-rec-actions"
import { cn } from "@/lib/utils"

const chartConfig = {
  cpu: { label: "CPU", color: "#39B3E5" },
  memory: { label: "Memory", theme: { light: "#38302E", dark: "#B5ABA7" } },
} satisfies ChartConfig

/** The deterministic rule that flags each category. Shown so reviewers see why, not just what. */
const RULES: Partial<Record<RecCategory, string>> = {
  "Idle infrastructure": "CPU below 5% and no inbound connections or queries for 30 consecutive days",
  Overprovisioned: "CPU p95 below 20% (or provisioned throughput under 25% used) for 30 days",
  "Unused storage": "Objects unread for 180 days, or volumes detached for more than 30 days",
  "Dev scheduling": "Non-production workload idle outside 08:00–18:00 on weekdays",
  "Alternative provider": "Equivalent shape at least 30% cheaper on an approved provider, with no provider-specific dependencies",
  "Infrastructure reuse": "Sustained headroom of at least 4 vCPU after the reserved buffer, verified over 30 days",
}

export function ResourceDrawer({ id }: { id: string }) {
  const { perMonth, perYear } = useMoney()
  const { state, openDrawer, resetRecommendation } = useSpend()
  const { approve, dismiss } = useRecActions()
  const resource = state.resources.find((r) => r.id === id)

  if (!resource) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Resource not found</SheetTitle>
          <SheetDescription>This resource is no longer in the inventory.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 px-4">
          <EmptyState title="Nothing to show" description="It may have been removed by a filter or a data refresh." />
        </div>
      </>
    )
  }

  const status = resourceStatus(state, resource)
  const rec = status.rec
  const monthly = rec ? recSavings(rec) : 0
  const recommendedCost = rec ? rec.recommendedMonthly : resource.recommendedCost
  const rule = resource.category ? RULES[resource.category] : undefined

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <div className="flex items-start gap-3">
          <BrandLogo brand={resource.provider} size="lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <SheetTitle className="truncate font-mono text-[15px] font-semibold">{resource.name}</SheetTitle>
            <SheetDescription className="text-xs">
              {resource.provider} · {resource.type} · {resource.environment}
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <RiskBadge risk={resource.risk} />
              <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
              {rec ? <PillarBadge pillar={rec.pillar} /> : null}
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        <Section title="Specs & metadata">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
            <Spec label="Region" value={resource.region} />
            <Spec label="Size" value={resource.size} />
            <Spec label="vCPU" value={resource.vcpu > 0 ? String(resource.vcpu) : "—"} />
            <Spec label="Memory" value={resource.memoryGb > 0 ? `${resource.memoryGb} GB` : "—"} />
            <Spec label="Owner" value={resource.department} mono={false} />
            <Spec label="Environment" value={resource.environment} mono={false} />
          </dl>
        </Section>

        <Section title="Utilization · last 30 days" aside={<DataLabel kind="simulated" />}>
          {resource.cpu === null && resource.memory === null ? (
            <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              No compute metrics — storage/platform service. Assessed on access patterns and provisioned capacity.
            </div>
          ) : (
            <UtilizationChart resource={resource} />
          )}
        </Section>

        <Section title="Cost comparison" aside={<DataLabel kind="projected" />}>
          <CostComparison
            current={resource.monthlyCost}
            recommended={recommendedCost}
            currentLabel={resource.size}
            recommendedLabel={resource.recommendedConfig ?? "No change recommended"}
          />
        </Section>

        <Section title="Optimization analysis">
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-[13px] leading-relaxed">
            <p>
              {resource.analysis ??
                "Utilization sits inside the healthy band and no right-sizing, idle, storage or scheduling rule triggered. No action is needed."}
            </p>
            <p className="text-xs text-muted-foreground">
              Deterministic rule, not a model guess:{" "}
              <span className="font-mono text-foreground">
                {rule ?? "CPU and memory p95 between 45% and 85% for 30 days"}
              </span>
              . The same inputs always produce the same recommendation.
            </p>
          </div>
        </Section>

        {rec ? (
          <Section title="Estimated savings" aside={<DataLabel kind="projected" />}>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
              <SavingsTile label="Monthly" value={perMonth(monthly)} muted={rec.status === "Dismissed"} />
              <SavingsTile label="Annual" value={perYear(monthly * 12)} muted={rec.status === "Dismissed"} />
            </div>
          </Section>
        ) : null}

        {resource.spare ? (
          <div className="space-y-2 rounded-lg border border-sky-500/25 bg-sky-500/5 p-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Recycle03Icon} size={16} className="text-sky-600 dark:text-sky-300" />
              <span className="text-sm font-medium">Verified spare capacity</span>
              <PillarBadge pillar="Reuse" />
            </div>
            <p className="font-mono text-sm tabular-nums">
              {resource.spare.vcpu} vCPU remaining / {resource.spare.memoryGb} GB memory headroom
            </p>
            <p className="text-xs text-muted-foreground">
              {resource.spare.note} Procurement checks this capacity before approving net-new compute, so new workloads
              land here first.
            </p>
          </div>
        ) : null}
      </div>

      <SheetFooter className="border-t">
        {!rec ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">No action needed</span>
            <span className="text-xs text-muted-foreground">This resource is running within healthy thresholds.</span>
          </div>
        ) : (
          <>
            {rec.status === "Pending" ? (
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => approve(rec.id)}>
                  Approve recommendation · <span className="font-mono tabular-nums">{perMonth(monthly)}</span>
                </Button>
                <Button variant="outline" onClick={() => dismiss(rec.id)}>
                  Dismiss
                </Button>
              </div>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  rec.status === "Approved"
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {rec.status === "Approved" ? (
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                ) : null}
                <span className="flex-1 font-medium">
                  {rec.status === "Approved"
                    ? `Approved · ${perMonth(monthly)} projected savings`
                    : "Recommendation dismissed"}
                </span>
                <Button variant="ghost" size="sm" onClick={() => resetRecommendation(rec.id)}>
                  <HugeiconsIcon icon={Undo02Icon} data-icon="inline-start" />
                  {rec.status === "Approved" ? "Undo" : "Restore"}
                </Button>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => openDrawer({ kind: "recommendation", id: rec.id })}>
              View in Recommendations
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Button>
          </>
        )}
      </SheetFooter>
    </>
  )
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 pt-4 first:pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Spec({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 bg-card px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-[13px]", mono && "font-mono tabular-nums")} title={value}>
        {value}
      </dd>
    </div>
  )
}

function SavingsTile({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="bg-card px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-heading text-xl font-semibold tabular-nums",
          muted ? "text-muted-foreground line-through" : "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </div>
    </div>
  )
}

function UtilizationChart({ resource }: { resource: CloudResource }) {
  const showCpu = resource.cpu !== null
  const showMemory = resource.memory !== null
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
      <AreaChart data={resource.history} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={28} className="font-mono" />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tickLine={false}
          axisLine={false}
          width={36}
          className="font-mono"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                  </span>
                  <span className="font-mono tabular-nums">{value}%</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {showCpu ? (
          <Area dataKey="cpu" type="monotone" stroke="var(--color-cpu)" strokeWidth={1.75} fill="var(--color-cpu)"
            fillOpacity={0.12}
          />
        ) : null}
        {showMemory ? (
          <Area
            dataKey="memory"
            type="monotone"
            stroke="var(--color-memory)"
            strokeWidth={1.75}
            strokeDasharray="4 3"
            fill="transparent"
          />
        ) : null}
      </AreaChart>
    </ChartContainer>
  )
}

function CostComparison({
  current,
  recommended,
  currentLabel,
  recommendedLabel,
}: {
  current: number
  recommended: number
  currentLabel: string
  recommendedLabel: string
}) {
  const { money, perMonth } = useMoney()
  const max = Math.max(1, current, recommended)
  const delta = current - recommended
  const rows = [
    { label: "Current", config: currentLabel, value: current, bar: "bg-foreground/70" },
    { label: "Recommended", config: recommendedLabel, value: recommended, bar: "bg-emerald-500" },
  ]
  return (
    <div className="space-y-2.5 rounded-lg border p-3">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate">
              <span className="font-medium">{row.label}</span>{" "}
              <span className="text-muted-foreground">· {row.config}</span>
            </span>
            <span className="shrink-0 font-mono text-[13px] tabular-nums">{perMonth(row.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", row.bar)}
              style={{ width: `${Math.max(row.value > 0 ? 2 : 0, (row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      <div className="flex justify-between border-t pt-2 text-xs">
        <span className="text-muted-foreground">Difference</span>
        <span
          className={cn(
            "font-mono tabular-nums",
            delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          {delta > 0 ? `−${money(delta)}/mo (${Math.round((delta / Math.max(1, current)) * 100)}%)` : "No change"}
        </span>
      </div>
    </div>
  )
}
