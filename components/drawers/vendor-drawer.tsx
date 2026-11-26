"use client"

import type { ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  LinkSquare02Icon,
  Tick02Icon,
  UndoIcon,
} from "@hugeicons/core-free-icons"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { EngineTag } from "@/components/recommendations/engine-tag"
import { approveLabel, oneTimeAmount, savingKind, zeroSavingLabel } from "@/components/recommendations/filters"
import { BrandLogo } from "@/components/shared/brand-logo"
import { DataLabel, PillarBadge, RiskBadge, ToneBadge } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DataTable, type SpendColumn } from "@/components/shared/data-table"
import { DaysBadge, LicenseBar, VendorStatusBadge, isUsageBased, vendorRecs } from "@/components/vendors/vendor-status"
import type { Recommendation, Vendor, VendorAlternative } from "@/lib/data/types"
import { shortDate } from "@/lib/format"
import { PILLAR_BY_CATEGORY } from "@/lib/store/build"
import { daysUntil, licenseUtilization, recSavings, sum, unusedUnits, vendorMonthly } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { useRecActions } from "@/lib/store/use-rec-actions"
import { cn } from "@/lib/utils"

const spendConfig = {
  spend: { label: "Spend", theme: { light: "#38302E", dark: "#B5ABA7" } },
} satisfies ChartConfig

const licenseConfig = {
  active: { label: "Active", theme: { light: "#10b981", dark: "#10b981" } },
  unused: { label: "Unused", theme: { light: "var(--destructive)", dark: "var(--destructive)" } },
} satisfies ChartConfig

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function VendorDrawer({ id }: { id: string }) {
  const { money, perMonth, moneyText } = useMoney()
  const { state, openDrawer, resetRecommendation } = useSpend()
  const { approve, dismiss } = useRecActions()
  const vendor = state.vendors.find((v) => v.id === id)

  if (!vendor) {
    return (
      <SheetHeader>
        <SheetTitle>Vendor not found</SheetTitle>
        <SheetDescription>This vendor is no longer in the current workspace.</SheetDescription>
      </SheetHeader>
    )
  }

  const recs = vendorRecs(state, vendor.id)
  const primary = recs[0]
  const pending = recs.filter((r) => r.status === "Pending")
  const pendingMonthly = sum(pending, recSavings)
  const monthly = vendorMonthly(vendor)
  const unit = vendor.unit === "seats" ? "seat" : "host"
  // Contracts from the SpendQ backend lead with their renewal and notice terms.
  const backend = vendor.id.startsWith("be-")
  const usage = isUsageBased(vendor)

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <div className="flex items-start gap-3">
          <BrandLogo brand={vendor.brand} size="lg" />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-lg font-semibold">{vendor.name}</SheetTitle>
            <SheetDescription className="text-xs">
              {vendor.category} · {vendor.plan}
            </SheetDescription>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <ToneBadge tone="neutral">{vendor.department}</ToneBadge>
              <VendorStatusBadge rec={primary} more={recs.length - 1} />
              {backend ? <EngineTag /> : null}
              <DataLabel kind="simulated" />
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {backend ? <ContractDetails vendor={vendor} monthly={monthly} prominent /> : null}

        <Section title="Overview">
          <p className="text-sm leading-relaxed text-muted-foreground">{moneyText(vendor.description)}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <Field label="Contract owner">{vendor.owner}</Field>
            <Field label="Department">{vendor.department}</Field>
          </dl>
        </Section>

        {backend ? null : <ContractDetails vendor={vendor} monthly={monthly} />}

        <Section title="Historical monthly spend" aside={<span className="text-[11px] text-muted-foreground">Jan – Nov 2026</span>}>
          <ChartContainer config={spendConfig} className="aspect-auto h-40 w-full">
            <BarChart data={vendor.history} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={6} fontSize={11} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                fontSize={11}
                tickFormatter={(v: number) => money(v, { compact: true })}
              />
              <ChartTooltip
                cursor={{ fillOpacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">Spend</span>
                        <span className="font-mono tabular-nums">{money(Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="spend" fill="var(--color-spend)" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ChartContainer>
        </Section>

        {usage ? null : <LicenseBreakdown vendor={vendor} unit={unit} />}

        {vendor.alternatives.length > 0 ? <Alternatives vendor={vendor} monthly={monthly} /> : null}

        <Section
          title={recs.length > 1 ? `Recommendations · ${recs.length}` : "Recommendation"}
          aside={recs.length > 1 ? <DataLabel kind="projected" /> : null}
        >
          {recs.length > 0 ? (
            <div className="space-y-2">
              {recs.map((r) => (
                <VendorRecCard
                  key={r.id}
                  rec={r}
                  vendor={vendor}
                  onApprove={() => approve(r.id)}
                  onDismiss={() => dismiss(r.id)}
                  onUndo={() => resetRecommendation(r.id)}
                  onOpen={() => openDrawer({ kind: "recommendation", id: r.id })}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} />
              {usage ? "No action needed — billing within the normal range" : "No action needed — utilization healthy"}
            </div>
          )}
        </Section>
      </div>

      <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t">
        {recs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {usage
              ? "Usage-based contract. SpendIQ will flag this vendor if billing spikes or drifts from the contract."
              : `${licenseUtilization(vendor)}% of ${vendor.unit} active. SpendIQ will flag this vendor if utilization drops.`}
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {pending.length > 0 ? (
                <>
                  {pending.length} of {recs.length} pending
                  {pendingMonthly > 0 ? (
                    <>
                      {" · "}
                      <span className="font-mono text-emerald-700 tabular-nums dark:text-emerald-400">
                        {perMonth(pendingMonthly)}
                      </span>{" "}
                      at stake
                    </>
                  ) : null}
                </>
              ) : (
                `All ${recs.length === 1 ? "" : `${recs.length} `}decided`
              )}
            </p>
            <Button variant="ghost" className="ml-auto" onClick={() => openDrawer({ kind: "recommendation", id: primary.id })}>
              Open in Recommendations
              <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} data-icon="inline-end" />
            </Button>
          </>
        )}
      </SheetFooter>
    </>
  )
}

function VendorRecCard({
  rec,
  vendor,
  onApprove,
  onDismiss,
  onUndo,
  onOpen,
}: {
  rec: Recommendation
  vendor: Vendor
  onApprove: () => void
  onDismiss: () => void
  onUndo: () => void
  onOpen: () => void
}) {
  const { money, perMonth, perYear, moneyText } = useMoney()
  // Seed vendors carry richer copy for their own recommendation; backend ones use the finding.
  const copy = vendor.recommendation?.title === rec.title ? vendor.recommendation : undefined
  const action = copy?.action ?? rec.steps[0]
  const detail = copy?.detail ?? rec.problem
  const kind = savingKind(rec)
  const saving = recSavings(rec)

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        rec.status === "Pending" && "border-amber-500/30 bg-amber-500/5",
        rec.status === "Approved" && "border-emerald-500/30 bg-emerald-500/5",
        rec.status === "Dismissed" && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left hover:underline">
          <p className="text-sm font-medium">{rec.title}</p>
          {action ? <p className="mt-0.5 text-xs text-muted-foreground">{moneyText(action)}</p> : null}
        </button>
        <div className="flex flex-wrap gap-1">
          <RiskBadge risk={rec.risk} />
          <PillarBadge pillar={PILLAR_BY_CATEGORY[rec.category]} />
        </div>
      </div>
      {detail ? <p className="mt-2 text-xs leading-relaxed">{moneyText(detail)}</p> : null}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
        {kind === "none" ? (
          <Stat label="Next step">
            <span className={cn("font-sans", rec.category === "Renewal notice" ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>
              {zeroSavingLabel(rec)}
            </span>
          </Stat>
        ) : (
          <Stat label="Current → recommended">
            <span className="text-muted-foreground">{money(rec.currentMonthly)}</span>
            <span className="text-muted-foreground"> → </span>
            {perMonth(rec.recommendedMonthly)}
          </Stat>
        )}
        <Stat label={kind === "one-time" ? "Spread monthly" : "Monthly savings"} positive={kind !== "none"}>
          {kind === "none" ? <span className="text-muted-foreground">—</span> : perMonth(saving)}
        </Stat>
        <Stat label={kind === "one-time" ? "One-time recovery" : "Annual savings"} positive={kind !== "none"}>
          {kind === "none" ? (
            <span className="text-muted-foreground">—</span>
          ) : kind === "one-time" ? (
            money(oneTimeAmount(rec))
          ) : (
            perYear(saving * 12)
          )}
        </Stat>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {rec.status === "Pending" ? (
          <>
            <Button size="sm" onClick={onApprove} aria-label={`${approveLabel(rec)} ${rec.title}`}>
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} data-icon="inline-start" />
              {approveLabel(rec)}
              {kind !== "none" ? <span className="font-mono tabular-nums">· {perMonth(saving)}</span> : null}
            </Button>
            <Button size="sm" variant="outline" onClick={onDismiss} aria-label={`Dismiss ${rec.title}`}>
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} data-icon="inline-start" />
              Dismiss
            </Button>
          </>
        ) : (
          <>
            {rec.status === "Approved" ? (
              <ToneBadge tone="positive">{kind === "none" ? "Assigned" : "Action approved"}</ToneBadge>
            ) : (
              <ToneBadge tone="neutral">Dismissed</ToneBadge>
            )}
            <Button size="sm" variant="outline" onClick={onUndo} aria-label={`Undo decision on ${rec.title}`}>
              <HugeiconsIcon icon={UndoIcon} strokeWidth={2} data-icon="inline-start" />
              {rec.status === "Approved" ? "Undo" : "Restore"}
            </Button>
          </>
        )}
        <span className="ml-auto">
          <DataLabel kind="projected" />
        </span>
      </div>
    </div>
  )
}

/** Notice deadlines this close (or closer) are flagged red. */
const NOTICE_ALERT_DAYS = 14

function ContractDetails({ vendor, monthly, prominent }: { vendor: Vendor; monthly: number; prominent?: boolean }) {
  const { money, perMonth, perYear } = useMoney()
  const days = daysUntil(vendor.renewalDate)
  const deadline = addDays(vendor.renewalDate, -vendor.noticeDays)
  const toDeadline = daysUntil(deadline)
  const deadlineAlert = toDeadline <= NOTICE_ALERT_DAYS
  const usage = isUsageBased(vendor)
  const deadlineHint =
    toDeadline < 0 ? `Passed ${Math.abs(toDeadline)}d ago` : toDeadline === 0 ? "Today" : `In ${toDeadline}d`

  const alert =
    deadlineAlert && vendor.autoRenew ? (
      <p className="mt-2 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
        <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={2} className="mt-px shrink-0" />
        {toDeadline < 0
          ? "The notice deadline has passed. This contract will auto-renew unless the vendor agrees to an exception."
          : `Send notice by ${shortDate(deadline)} (${toDeadline} days) or this contract auto-renews on current terms.`}
      </p>
    ) : null

  const unitPrice = usage ? (
    "Usage-based"
  ) : (
    <span className="font-mono tabular-nums">
      {money(vendor.unitPrice, { cents: vendor.unitPrice % 1 !== 0 })}/{vendor.unit === "seats" ? "seat" : "host"}
    </span>
  )

  if (prominent) {
    return (
      <Section title="Contract">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
          <KeyFact label="Renewal date">
            <span className="font-mono tabular-nums">{shortDate(vendor.renewalDate)}</span>
            <span className="mt-1 block">
              <DaysBadge days={days} />
            </span>
          </KeyFact>
          <KeyFact label="Auto-renew" alert={vendor.autoRenew && deadlineAlert}>
            {vendor.autoRenew ? "Yes" : "No"}
            <span className="block text-[11px] font-normal text-muted-foreground">
              {vendor.autoRenew ? "Renews unless notice is given" : "Ends unless renewed"}
            </span>
          </KeyFact>
          <KeyFact label="Notice window">
            <span className="font-mono tabular-nums">{vendor.noticeDays} days</span>
            <span className="block text-[11px] font-normal text-muted-foreground">before renewal</span>
          </KeyFact>
          <KeyFact label="Notice deadline" alert={deadlineAlert}>
            <span className="font-mono tabular-nums">{shortDate(deadline)}</span>
            <span className={cn("block text-[11px]", deadlineAlert ? "text-destructive" : "font-normal text-muted-foreground")}>
              {deadlineHint}
            </span>
          </KeyFact>
        </dl>
        {alert}
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
          <Field label="Term">
            <span className="font-mono tabular-nums">{vendor.termMonths} months</span>
          </Field>
          <Field label="Start date">
            <span className="font-mono tabular-nums">{shortDate(vendor.startDate)}</span>
          </Field>
          <Field label="Annual value">
            <span className="font-mono tabular-nums">{perYear(monthly * 12)}</span>
          </Field>
          <Field label="Unit price">{unitPrice}</Field>
        </dl>
      </Section>
    )
  }

  return (
    <Section title="Contract details">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-3 text-xs sm:grid-cols-3">
        <Field label="Term">
          <span className="font-mono tabular-nums">{vendor.termMonths} months</span>
        </Field>
        <Field label="Start date">
          <span className="font-mono tabular-nums">{shortDate(vendor.startDate)}</span>
        </Field>
        <Field label="Renewal date">
          <span className="flex items-center gap-1.5">
            <span className="font-mono tabular-nums">{shortDate(vendor.renewalDate)}</span>
            <DaysBadge days={days} />
          </span>
        </Field>
        <Field label="Auto-renew">{vendor.autoRenew ? "Yes" : "No"}</Field>
        <Field label="Notice window">
          <span className="font-mono tabular-nums">{vendor.noticeDays} days</span>
        </Field>
        <Field label="Notice deadline">
          <span className={cn("font-mono tabular-nums", deadlineAlert && "font-medium text-destructive")}>
            {shortDate(deadline)}
          </span>
          <span className={cn("block text-[11px]", deadlineAlert ? "text-destructive" : "text-muted-foreground")}>
            {deadlineHint}
          </span>
        </Field>
        <Field label="Monthly value">
          <span className="font-mono tabular-nums">{perMonth(monthly)}</span>
        </Field>
        <Field label="Annual value">
          <span className="font-mono tabular-nums">{perYear(monthly * 12)}</span>
        </Field>
        <Field label="Unit price">{unitPrice}</Field>
      </dl>
      {alert}
    </Section>
  )
}

function KeyFact({ label, alert, children }: { label: string; alert?: boolean; children: ReactNode }) {
  return (
    <div className={cn("min-w-0 bg-popover px-3 py-2.5", alert && "bg-destructive/5")}>
      <dt className={cn("text-[11px]", alert ? "text-destructive" : "text-muted-foreground")}>{label}</dt>
      <dd className={cn("mt-0.5 text-sm font-semibold", alert && "text-destructive")}>{children}</dd>
    </div>
  )
}

function LicenseBreakdown({ vendor, unit }: { vendor: Vendor; unit: string }) {
  const { money, perMonth } = useMoney()
  const unused = unusedUnits(vendor)
  const util = licenseUtilization(vendor)
  const data = [{ label: "Licenses", active: vendor.active, unused }]
  return (
    <Section title="License utilization" aside={<LicenseBar value={util} className="w-36" />}>
      <ChartContainer config={licenseConfig} className="aspect-auto h-8 w-full">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
          <XAxis type="number" hide domain={[0, vendor.purchased]} />
          <YAxis type="category" dataKey="label" hide />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">{name === "active" ? "Active" : "Unused"}</span>
                    <span className="font-mono tabular-nums">
                      {Number(value).toLocaleString("en-US")} {vendor.unit}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="active" stackId="l" fill="var(--color-active)" radius={unused > 0 ? [4, 0, 0, 4] : 4} barSize={14} />
          <Bar dataKey="unused" stackId="l" fill="var(--color-unused)" radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ChartContainer>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <Stat label={`Purchased ${vendor.unit}`}>{vendor.purchased.toLocaleString("en-US")}</Stat>
        <Stat label="Active" dot="bg-emerald-500">
          {vendor.active.toLocaleString("en-US")}
        </Stat>
        <Stat label="Unused" dot="bg-destructive">
          {unused.toLocaleString("en-US")}
        </Stat>
        <Stat label="Cost of unused" negative={unused > 0}>
          {perMonth(unused * vendor.unitPrice)}
        </Stat>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        <span className="font-mono tabular-nums">
          {unused} × {money(vendor.unitPrice, { cents: vendor.unitPrice % 1 !== 0 })}/{unit}
        </span>{" "}
        paid each month for inactive {vendor.unit}.
      </p>
    </Section>
  )
}

type AltRow = {
  id: string
  name: string
  brand?: string
  note: string
  monthly: number
  featureMatch: number
  effort: VendorAlternative["migrationEffort"] | null
  saving: number | null
}

const altColumns = ({ money, moneyText }: Pick<ReturnType<typeof useMoney>, "money" | "moneyText">): Array<SpendColumn<AltRow>> => [
  {
    id: "option",
    header: "Option",
    enableSorting: false,
    meta: { cellClassName: "max-w-56 whitespace-normal" },
    cell: ({ row }) => {
      const r = row.original
      return (
        <div className="flex items-start gap-2">
          {r.brand ? (
            <BrandLogo brand={r.brand} size="xs" />
          ) : (
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border text-muted-foreground">
              <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
            </span>
          )}
          <div className="min-w-0">
            <div className="font-medium">{r.name}</div>
            <div className="text-[11px] leading-snug text-muted-foreground">{moneyText(r.note)}</div>
          </div>
        </div>
      )
    },
  },
  {
    id: "monthly",
    header: "Monthly",
    enableSorting: false,
    meta: { align: "right" },
    cell: ({ row }) => <span className="font-mono tabular-nums">{money(row.original.monthly)}</span>,
  },
  {
    id: "match",
    header: "Feature match",
    enableSorting: false,
    cell: ({ row }) => <MatchBar value={row.original.featureMatch} />,
  },
  {
    id: "effort",
    header: "Effort",
    enableSorting: false,
    cell: ({ row }) => {
      const e = row.original.effort
      if (!e) return <span className="text-muted-foreground">—</span>
      return <ToneBadge tone={e === "Low" ? "positive" : e === "Medium" ? "warning" : "negative"}>{e}</ToneBadge>
    },
  },
  {
    id: "saving",
    header: "Savings /mo",
    enableSorting: false,
    meta: { align: "right" },
    cell: ({ row }) => {
      const s = row.original.saving
      if (s === null) return <span className="text-muted-foreground">Current</span>
      return (
        <span
          className={cn(
            "font-mono tabular-nums",
            s > 0 ? "text-emerald-700 dark:text-emerald-400" : s < 0 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {s > 0 ? `−${money(s)}` : s < 0 ? `+${money(-s)}` : money(0)}
        </span>
      )
    },
  },
]

function Alternatives({ vendor, monthly }: { vendor: Vendor; monthly: number }) {
  const formats = useMoney()
  const rows: AltRow[] = [
    {
      id: "current",
      name: vendor.name,
      brand: vendor.brand,
      note: `Current contract · ${vendor.plan}`,
      monthly,
      featureMatch: 100,
      effort: null,
      saving: null,
    },
    ...vendor.alternatives.map((alt) => ({
      id: alt.name,
      name: alt.name,
      brand: alt.brand,
      note: alt.note,
      monthly: alt.monthly,
      featureMatch: alt.featureMatch,
      effort: alt.migrationEffort,
      saving: monthly - alt.monthly,
    })),
  ]
  return (
    <Section title="Alternative vendor comparison">
      {vendor.alternatives.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
          No benchmarked alternatives for this contract.
        </p>
      ) : (
        <DataTable
          caption={`Alternatives to ${vendor.name}`}
          columns={altColumns(formats)}
          rows={rows}
          getRowId={(r) => r.id}
          className="text-xs"
        />
      )}
    </Section>
  )
}

function MatchBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", value >= 90 ? "bg-emerald-500" : value >= 80 ? "bg-[#39B3E5]" : "bg-amber-500")}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="font-mono tabular-nums">{value}%</span>
    </div>
  )
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  )
}

function Stat({
  label,
  children,
  positive,
  negative,
  dot,
}: {
  label: string
  children: ReactNode
  positive?: boolean
  negative?: boolean
  dot?: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {dot ? <span className={cn("inline-block size-2 rounded-full", dot)} /> : null}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-sm font-medium tabular-nums",
          positive && "text-emerald-700 dark:text-emerald-400",
          negative && "text-destructive",
        )}
      >
        {children}
      </div>
    </div>
  )
}
