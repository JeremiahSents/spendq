"use client"

import * as React from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowTurnBackwardIcon,
  Calendar03Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Download01Icon,
  Search01Icon,
  Tick02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

import { PILLAR_ICON } from "@/components/procurement/pillar-strip"
import {
  RequestStatusBadge,
  asRequestedOption,
  isDecided,
  recommendedOption,
} from "@/components/procurement/request-meta"
import { BrandLogo } from "@/components/shared/brand-logo"
import { DataLabel, PillarBadge, RiskBadge, ToneBadge } from "@/components/shared/dashboard-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { Pillar, ProcurementOption, ProcurementRequest, Settings } from "@/lib/data/types"
import { pct, shortDate, USD_TO_KES, type Currency } from "@/lib/format"
import { evaluateProcurementOption } from "@/lib/procurement/policies"
import { useMoney, useSpend, type RequestDecision } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

const EMERALD = "text-emerald-600 dark:text-emerald-400"
type OptionPolicy = ReturnType<typeof evaluateProcurementOption>
type MoneyFormatter = ReturnType<typeof useMoney>
type PillarSummary = { pillar: Pillar; text: string }

export function RequestDrawer({ id }: { id: string }) {
  const { state, decideRequest, refreshRequest, restoreRequest } = useSpend()
  const format = useMoney()
  const { perMonth, perYear, moneyText } = format
  const request = state.requests.find((r) => r.id === id)

  if (!request) {
    return (
      <SheetHeader className="border-b">
        <SheetTitle>Request not found</SheetTitle>
        <SheetDescription>{id} is no longer in the procurement queue.</SheetDescription>
      </SheetHeader>
    )
  }

  const a = request.analysis
  const best = recommendedOption(request)
  const baseline = asRequestedOption(request)
  const decided = isDecided(request.status)
  const policies = Object.fromEntries(a.options.map((option) => [
    option.key,
    evaluateProcurementOption(state, request, option),
  ])) as Record<ProcurementOption["key"], OptionPolicy>
  const bestPolicy = policies[best.key]
  const baselinePolicy = policies[baseline.key]
  const needsRefresh = [bestPolicy, baselinePolicy].some(({ reuseCheck }) => reuseCheck === "stale" || reuseCheck === "required")
  const pillars = pillarBreakdown(request, format)

  const decide = (decision: RequestDecision) => {
    const policy = decision === "optimized" ? bestPolicy : decision === "as-requested" ? baselinePolicy : null
    if (policy?.blocked) {
      toast.error(policy.reason ?? "Approval blocked by policy")
      return
    }
    const previous = request
    decideRequest(request.id, decision)
    const undo = {
      label: "Undo",
      onClick: () => {
        restoreRequest(previous)
        toast(`${previous.id} restored to ${previous.status}`)
      },
    }
    switch (decision) {
      case "optimized":
        toast.success(`Optimized plan approved · ${perMonth(a.avoided)} avoided`, {
          description: `${request.id} · ${perYear(a.avoided * 12)} projected avoided spend`,
          action: undo,
        })
        break
      case "as-requested":
        toast(`${request.id} approved as requested`, {
          description: a.avoided > 0 ? `${perMonth(a.avoided)} of avoidable spend left on the table` : `${perMonth(baseline.monthly)} committed`,
          action: undo,
        })
        break
      case "review":
        toast(`${request.id} moved to review`, {
          description: bestPolicy.tier === "cfo" || baselinePolicy.tier === "cfo"
            ? "CFO sign-off is required for options above the threshold."
            : "The request is now marked In review.",
          action: undo,
        })
        break
      case "reject":
        toast(`${request.id} rejected`, { action: undo })
        break
    }
  }

  const reopen = () => {
    const previous = request
    restoreRequest({ ...request, status: "Pending review" })
    toast(`${request.id} reopened for review`, {
      action: { label: "Undo", onClick: () => restoreRequest(previous) },
    })
  }

  return (
    <>
      <SheetHeader className="gap-2 border-b pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{request.id}</span>
          <RequestStatusBadge status={request.status} />
          <Badge variant="outline" className="text-muted-foreground">
            {request.category}
          </Badge>
        </div>
        <SheetTitle className="font-heading text-lg font-semibold tracking-[-0.01em]">{request.title}</SheetTitle>
        <SheetDescription render={<div />} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <HugeiconsIcon icon={UserGroupIcon} size={13} />
            {request.department}
          </span>
          <span>Requested by {request.requester}</span>
          <span className="inline-flex items-center gap-1">
            <HugeiconsIcon icon={Calendar03Icon} size={13} />
            {shortDate(request.submittedAt)}
          </span>
          <span className="font-mono tabular-nums">
            {a.capacity} {a.unit} · {request.preferredVendor}
          </span>
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {decided ? <DecisionBanner request={request} onReopen={reopen} /> : null}

        <SummaryBand request={request} best={best} />

        <PillarMap items={pillars} />

        {request.justification ? (
          <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Business justification. </span>
            {moneyText(request.justification)}
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <Panel title="Reuse finding" pillar="Reuse">
            {a.reuse ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  {a.reuse.brand ? <BrandLogo brand={a.reuse.brand} size="sm" /> : null}
                  <span className="min-w-0 text-sm font-medium">{a.reuse.source}</span>
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  <Stat label={request.status === "Approved (Optimized)" ? "Reserved" : "Matched"} value={`${a.reuse.quantity} ${a.unit}`} />
                  <Stat label="Avoided" value={perMonth(a.reuse.avoided)} className={EMERALD} />
                </dl>
                <p className="text-xs text-muted-foreground">Already paid for. Reallocating it costs nothing extra.</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No verified spare capacity or unused licenses match this request.</p>
            )}
          </Panel>

          <Panel title="Innovate finding" pillar="Innovate">
            {a.alternative ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  {a.alternative.brand ? <BrandLogo brand={a.alternative.brand} size="sm" /> : null}
                  <span className="min-w-0 text-sm font-medium">{a.alternative.name}</span>
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  <Stat
                    label="Unit price"
                    value={`${unitMoney(a.alternative.unitPrice, format)}/${a.unit}`}
                    sub={`vs ${unitMoney(a.unitPrice, format)}/${a.unit} requested`}
                  />
                  <Stat label="Feature match" value={pct(a.alternative.featureMatch)} sub="90% minimum to qualify" />
                </dl>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {request.preferredVendor} is already the lowest-cost offer that meets 90% of the requirements.
              </p>
            )}
          </Panel>
        </div>

        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-heading text-sm font-semibold">Options</h3>
            <span className="text-xs text-muted-foreground">
              Auto-approval below {perMonth(state.settings.autoApproveBelow)} · CFO sign-off above {perMonth(state.settings.requireCfoAbove)}
            </span>
          </div>
          {!decided && needsRefresh ? (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs text-foreground">Refresh the analysis to check current spare capacity before approval.</p>
              <Button size="sm" variant="outline" onClick={() => refreshRequest(request.id)}>Refresh analysis</Button>
            </div>
          ) : null}
          <div className={cn("grid gap-3", a.options.length >= 3 ? "lg:grid-cols-3" : a.options.length === 2 ? "md:grid-cols-2" : "")}>
            {a.options.map((o) => (
              <OptionCard
                key={o.key}
                option={o}
                baseline={baseline}
                policy={policies[o.key]}
                blockOverBudget={state.settings.blockOverBudget}
              />
            ))}
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          <Panel title="Analysis log" pillar="Automate">
            <ul className="space-y-1.5">
              {a.steps.map((s) => (
                <li key={s} className="flex items-start gap-2 text-xs leading-relaxed">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} className={cn("mt-0.5 shrink-0", EMERALD)} />
                  <span className="font-mono">{moneyText(s)}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <BudgetCheck policy={bestPolicy} best={best} />
        </div>
      </div>

      <SheetFooter className="border-t bg-muted/30">
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => exportApprovalBrief(request, policies, pillars, format, state.currency, state.settings)}
        >
          <HugeiconsIcon icon={Download01Icon} strokeWidth={1.8} />
          Export approval brief
        </Button>
        {decided ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Decision recorded: <span className="font-medium text-foreground">{request.status}</span>
            </span>
            <Button variant="outline" onClick={reopen}>
              <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={1.8} />
              Reopen request
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => decide("optimized")} disabled={a.avoided <= 0 || bestPolicy.blocked}>
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
              Approve optimized plan
              {a.avoided > 0 ? <span className="font-mono tabular-nums opacity-80">· {perMonth(best.monthly)}</span> : null}
            </Button>
            <Button variant="outline" onClick={() => decide("as-requested")} disabled={baselinePolicy.blocked}>
              Approve as requested
            </Button>
            <Button variant="outline" onClick={() => decide("review")} disabled={request.status === "In review"}>
              <HugeiconsIcon icon={Search01Icon} strokeWidth={1.8} />
              {request.status === "In review" ? "In review" : "Request review"}
            </Button>
            <Button variant="ghost" className="text-destructive hover:text-destructive sm:ml-auto" onClick={() => decide("reject")}>
              <HugeiconsIcon icon={CancelCircleIcon} strokeWidth={1.8} />
              Reject
            </Button>
          </div>
        )}
      </SheetFooter>
    </>
  )
}

function DecisionBanner({ request, onReopen }: { request: ProcurementRequest; onReopen: () => void }) {
  const { perMonth, perYear } = useMoney()
  const a = request.analysis
  const tone =
    request.status === "Approved (Optimized)"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : request.status === "Rejected"
        ? "border-destructive/30 bg-destructive/5"
        : "border-border bg-muted/40"
  const detail =
    request.status === "Approved (Optimized)"
      ? `${perMonth(a.avoided)} projected avoided spend, or ${perYear(a.avoided * 12)}.`
      : request.status === "Approved (As requested)"
        ? a.avoided > 0
          ? `Approved at ${perMonth(request.requestedMonthly)}. The optimized plan would have saved ${perMonth(a.avoided)}.`
          : `Approved at ${perMonth(request.requestedMonthly)}.`
        : "No spend will be committed for this request."
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5", tone)}>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{request.status}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onReopen}>
        <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={1.8} />
        Reopen
      </Button>
    </div>
  )
}

function SummaryBand({ request, best }: { request: ProcurementRequest; best: ProcurementOption }) {
  const { money, perMonth, perYear } = useMoney()
  const a = request.analysis
  const cells: { label: string; value: string; sub?: string; tone?: string; projected?: boolean }[] = [
    { label: "Original requested spend", value: perMonth(request.requestedMonthly), sub: perYear(request.requestedMonthly * 12) },
    { label: "Optimized spend", value: perMonth(best.monthly), sub: perYear(best.monthly * 12) },
    { label: "Monthly avoided spend", value: money(a.avoided), tone: a.avoided > 0 ? EMERALD : undefined, sub: "per month" },
    {
      label: "Annual projected savings",
      value: money(a.avoided * 12),
      tone: a.avoided > 0 ? EMERALD : undefined,
      projected: true,
    },
    { label: "Cost reduction", value: pct(a.reductionPct), tone: a.reductionPct > 0 ? EMERALD : undefined, sub: "vs as requested" },
  ]
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-3 lg:grid-cols-5">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={cn(
            "min-w-0 space-y-1 border-border px-3 py-3",
            i > 0 && "border-l",
            i === 2 && "max-sm:border-l-0",
            i >= 2 && "max-sm:border-t",
            i >= 3 && "sm:max-lg:border-t",
            i === 3 && "sm:max-lg:border-l-0",
          )}
        >
          <p className="truncate text-[11px] font-medium text-muted-foreground">{c.label}</p>
          <p className={cn("font-mono text-lg font-semibold tracking-[-0.02em] break-words tabular-nums", c.tone)}>
            {c.value}
          </p>
          {c.projected ? <DataLabel kind="projected" /> : <p className="font-mono text-[11px] text-muted-foreground tabular-nums">{c.sub}</p>}
        </div>
      ))}
    </div>
  )
}

function unitMoney(amount: number, { money }: MoneyFormatter) {
  return money(amount, { cents: !Number.isInteger(amount) })
}

function pillarBreakdown(request: ProcurementRequest, format: MoneyFormatter): PillarSummary[] {
  const a = request.analysis
  return [
    {
      pillar: "Reuse",
      text: a.reuse ? `${a.reuse.quantity} ${a.unit} matched on ${a.reuse.source}` : "No reusable capacity matched",
    },
    {
      pillar: "Innovate",
      text: a.alternative
        ? `${a.alternative.name} met ${pct(a.alternative.featureMatch)} of requirements at ${unitMoney(a.alternative.unitPrice, format)}/${a.unit}`
        : "Preferred vendor is the cheapest qualifying offer",
    },
    { pillar: "Automate", text: `${a.steps.length} checks completed on the request` },
    {
      pillar: "Eliminate",
      text: a.avoided > 0 ? `${format.perMonth(a.avoided)} in avoidable spend` : "No avoidable spend identified",
    },
  ]
}

function PillarMap({ items }: { items: PillarSummary[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.pillar} className="flex min-w-0 items-start gap-2 rounded-lg border px-2.5 py-2">
          <HugeiconsIcon icon={PILLAR_ICON[it.pillar]} size={14} strokeWidth={1.8} className="mt-1 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-1">
            <PillarBadge pillar={it.pillar} />
            <p className="text-xs leading-snug text-muted-foreground">{it.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function Panel({ title, pillar, children }: { title: string; pillar?: Pillar; children: React.ReactNode }) {
  return (
    <section className="min-w-0 space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        {pillar ? <PillarBadge pillar={pillar} /> : null}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("font-mono text-sm font-medium tabular-nums", className)}>{value}</dd>
      {sub ? <dd className="text-[11px] text-muted-foreground">{sub}</dd> : null}
    </div>
  )
}

function policyBadges(policy: OptionPolicy, blockOverBudget: boolean) {
  const badges: { label: string; tone: React.ComponentProps<typeof ToneBadge>["tone"] }[] = [
    policy.tier === "cfo"
      ? { label: "Requires CFO sign-off", tone: "warning" }
      : policy.tier === "auto"
        ? { label: policy.blocked ? "Below auto-approval threshold" : "Auto-approval eligible", tone: policy.blocked ? "neutral" : "positive" }
        : { label: "Standard approval", tone: "neutral" },
  ]
  if (policy.overBudget) {
    badges.push({ label: blockOverBudget ? "Over budget · blocked" : "Over budget", tone: blockOverBudget ? "negative" : "warning" })
  } else {
    badges.push({ label: "Fits budget", tone: "positive" })
  }
  if (policy.reuseCheck === "complete") badges.push({ label: "Reuse check complete", tone: "info" })
  if (policy.reuseCheck === "required") badges.push({ label: "Reuse check required", tone: "warning" })
  if (policy.reuseCheck === "stale") badges.push({ label: "Spare capacity changed", tone: "warning" })
  return badges
}

function OptionCard({
  option: o,
  baseline,
  policy,
  blockOverBudget,
}: {
  option: ProcurementOption
  baseline: ProcurementOption
  policy: OptionPolicy
  blockOverBudget: boolean
}) {
  const { money, perMonth, moneyText } = useMoney()
  const saving = Math.max(0, baseline.monthly - o.monthly)
  const isBaseline = o.key === "as-requested"
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-3",
        o.recommended && "border-transparent ring-2 ring-brand",
      )}
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm leading-snug font-semibold">{o.label}</h4>
          {o.recommended ? (
            <Badge className="shrink-0 bg-accent text-accent-foreground">Recommended</Badge>
          ) : null}
        </div>
        <p className="text-xs leading-snug text-muted-foreground">{moneyText(o.description)}</p>
        <div className="flex flex-wrap gap-1 pt-1" aria-label="Current policy evaluation">
          {policyBadges(policy, blockOverBudget).map(({ label, tone }) => <ToneBadge key={label} tone={tone}>{label}</ToneBadge>)}
        </div>
        {policy.reason && policy.reason !== "Requires CFO sign-off" ? (
          <p className="pt-1 text-xs text-muted-foreground">{moneyText(policy.reason)}</p>
        ) : null}
      </div>

      <ul className="space-y-1.5 border-y py-2">
        {o.lines.map((l) => (
          <li key={l.label} className="flex items-start gap-2 text-xs">
            {l.brand ? <BrandLogo brand={l.brand} size="xs" /> : <span className="size-5 shrink-0" />}
            <span className="min-w-0 flex-1 leading-snug">{moneyText(l.label)}</span>
            {l.monthly === 0 ? (
              <span className={cn("shrink-0 text-right text-[11px] font-medium", EMERALD)}>
                <span className="font-mono tabular-nums">{money(0)}</span> · already paid for
              </span>
            ) : (
              <span className="shrink-0 font-mono tabular-nums">{perMonth(l.monthly)}</span>
            )}
          </li>
        ))}
      </ul>

      <dl className="grid gap-1.5 text-xs">
        <Row label="Monthly cost">
          <span className="font-mono font-semibold tabular-nums">{money(o.monthly)}</span>
        </Row>
        <Row label="Annual cost">
          <span className="font-mono tabular-nums">{money(o.monthly * 12)}</span>
        </Row>
        <Row label="Requirements satisfied">
          <span className="text-right font-mono text-[11px] tabular-nums">{o.requirements}</span>
        </Row>
        <Row label="Implementation complexity">
          <span>{o.complexity}</span>
        </Row>
        <Row label="Operational risk">
          <RiskBadge risk={o.risk} />
        </Row>
        <Row label="Savings /mo vs requested">
          <span className={cn("font-mono tabular-nums", saving > 0 ? EMERALD : "text-muted-foreground")}>
            {isBaseline ? "Baseline" : money(saving)}
          </span>
        </Row>
        <Row label="Savings /yr vs requested">
          <span className={cn("font-mono tabular-nums", saving > 0 ? EMERALD : "text-muted-foreground")}>
            {isBaseline ? "Baseline" : money(saving * 12)}
          </span>
        </Row>
      </dl>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function BudgetCheck({ policy, best }: { policy: OptionPolicy; best: ProcurementOption }) {
  const { money, perMonth } = useMoney()
  const b = policy.budget
  const fits = !policy.overBudget
  const committed = b.actual + best.monthly
  const used = b.budget > 0 ? Math.min(100, (committed / b.budget) * 100) : 100
  return (
    <Panel title="Budget check">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{b.department} monthly budget</span>
          {fits ? (
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", EMERALD)}>
              <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} />
              Fits budget
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
              <HugeiconsIcon icon={CancelCircleIcon} size={14} strokeWidth={2} />
              Over budget
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", fits ? "bg-emerald-500" : "bg-destructive")}
            style={{ width: `${Math.max(2, used)}%` }}
          />
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="Budget" value={perMonth(b.budget)} />
          <Stat label="Actual spend" value={perMonth(b.actual)} />
          <Stat
            label="Headroom"
            value={b.headroom < 0 ? `${money(Math.abs(b.headroom))} over budget` : perMonth(b.headroom)}
            className={b.headroom < 0 || !fits ? "text-destructive" : undefined}
          />
          <Stat label="Recommended plan" value={perMonth(best.monthly)} />
        </dl>
      </div>
    </Panel>
  )
}

function exportApprovalBrief(
  request: ProcurementRequest,
  policies: Record<ProcurementOption["key"], OptionPolicy>,
  pillars: PillarSummary[],
  { perMonth, perYear, moneyText }: MoneyFormatter,
  currency: Currency,
  settings: Settings,
) {
  const { analysis, status } = request
  const best = recommendedOption(request)
  const budget = policies[best.key].budget
  const decision = status === "Approved (Optimized)"
    ? best
    : status === "Approved (As requested)"
      ? asRequestedOption(request)
      : null
  const options = analysis.options.flatMap((option) => {
    const policy = policies[option.key]
    return [
      `${option.label}${option.recommended ? " (recommended)" : ""}`,
      moneyText(option.description),
      `  Cost: ${perMonth(option.monthly)} · ${perYear(option.monthly * 12)}`,
      `  Requirements: ${option.requirements}`,
      `  Complexity: ${option.complexity} · Risk: ${option.risk}`,
      `  Policy: ${policyBadges(policy, settings.blockOverBudget).map(({ label }) => label).join(", ")}`,
      ...option.lines.map((line) => `  - ${moneyText(line.label)}: ${perMonth(line.monthly)}`),
      "",
    ]
  })
  const text = [
    "SpendIQ approval brief",
    `Request ID: ${request.id}`,
    `Request: ${request.title}`,
    `Department: ${request.department}`,
    `Requester: ${request.requester}`,
    `Submitted: ${shortDate(request.submittedAt)}`,
    `Currency: ${currency} (demo rate: 1 USD = ${USD_TO_KES} KES)`,
    "",
    "Business justification",
    request.justification || "No justification recorded.",
    "",
    "Analysis by pillar",
    ...pillars.map(({ pillar, text }) => `${pillar}: ${text}`),
    `Projected avoided spend: ${perMonth(analysis.avoided)} · ${perYear(analysis.avoided * 12)} · ${pct(analysis.reductionPct)} reduction`,
    "",
    "Checks completed",
    ...analysis.steps.map((step) => `- ${moneyText(step)}`),
    "",
    "Options compared",
    ...options,
    "Current budget and approval policy",
    `Department budget: ${perMonth(budget.budget)}`,
    `Current spend: ${perMonth(budget.actual)}`,
    `Budget headroom: ${perMonth(budget.headroom)}`,
    `Recommended plan: ${perMonth(best.monthly)} · ${policies[best.key].overBudget ? "Over budget" : "Fits budget"}`,
    `Auto-approval threshold: below ${perMonth(settings.autoApproveBelow)}`,
    `CFO sign-off threshold: above ${perMonth(settings.requireCfoAbove)}`,
    `Over-budget approvals: ${settings.blockOverBudget ? "Blocked" : "Warning only"}`,
    `Cloud reuse check: ${settings.requireReuseCheck ? "Required" : "Optional"}`,
    "",
    "Decision",
    `Recorded status: ${status}`,
    ...(decision
      ? [
          `Approved option: ${decision.label}`,
          `Approved cost: ${perMonth(decision.monthly)}`,
          `Recorded budget headroom: ${perMonth(analysis.budget.headroom)}`,
        ]
      : []),
    "",
  ].join("\n")
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `spendiq-${request.id}-approval-brief.txt`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
