"use client"

import type { ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowTurnBackwardIcon, Cancel01Icon, LinkSquare02Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { SOURCE_LABEL } from "@/components/recommendations/filters"
import { BrandLogo } from "@/components/shared/brand-logo"
import { DataLabel, EmptyState, PillarBadge, RecStatusBadge, RiskBadge } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { money, pct, perMonth, perYear } from "@/lib/format"
import { PILLAR_COPY } from "@/lib/store/build"
import { recSavings } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { useRecActions } from "@/lib/store/use-rec-actions"

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function RecommendationDrawer({ id }: { id: string }) {
  const { state, openDrawer, closeDrawer, resetRecommendation } = useSpend()
  const { approve, dismiss } = useRecActions()
  const rec = state.recommendations.find((r) => r.id === id)

  if (!rec) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Recommendation not found</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <EmptyState title="This recommendation no longer exists" description="It may have been replaced after the source record changed." />
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={closeDrawer}>
            Close
          </Button>
        </SheetFooter>
      </>
    )
  }

  const saving = recSavings(rec)
  const reduction = rec.currentMonthly > 0 ? (saving / rec.currentMonthly) * 100 : 0
  const sourceKind = rec.source === "cloud" ? "resource" : rec.source === "vendor" ? "vendor" : "request"

  return (
    <>
      <SheetHeader className="gap-3 border-b pr-12">
        <div className="flex items-start gap-3">
          <BrandLogo brand={rec.brand} size="lg" />
          <div className="min-w-0 space-y-1.5">
            <SheetTitle className="text-base leading-snug font-semibold">{rec.title}</SheetTitle>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <PillarBadge pillar={rec.pillar} />
              <span>{rec.category}</span>
              <span aria-hidden>·</span>
              <span>{SOURCE_LABEL[rec.source]}</span>
              <span aria-hidden>·</span>
              <span>{rec.department}</span>
            </div>
          </div>
        </div>
        <SheetDescription className="sr-only">Recommendation details, financial impact and approval actions.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        <Section title="Problem">
          <p className="text-sm leading-relaxed">{rec.problem || "No analysis recorded for this item."}</p>
        </Section>

        <Section
          title="Supporting data"
          aside={
            <Button size="xs" variant="outline" onClick={() => openDrawer({ kind: sourceKind, id: rec.refId })}>
              <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} />
              Open source record
            </Button>
          }
        >
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
            {rec.evidence.map((e, i) => (
              <div key={`${e.label}-${i}`} className="min-w-0 bg-popover px-3 py-2 last:odd:col-span-2">
                <dt className="text-[11px] text-muted-foreground">{e.label}</dt>
                <dd className="truncate font-mono text-xs font-medium tabular-nums" title={e.value}>
                  {e.value}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Recommended action">
          <ol className="space-y-2">
            {rec.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums">
                  {i + 1}
                </span>
                <span className="pt-px">{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Financial impact" aside={<DataLabel kind="projected" />}>
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3 font-mono text-sm tabular-nums">
              <span className="text-muted-foreground">
                {perMonth(rec.currentMonthly)} <span aria-hidden>→</span> {perMonth(rec.recommendedMonthly)}
              </span>
              <span className="text-xs text-emerald-700 dark:text-emerald-400">−{pct(reduction)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Monthly projected savings</p>
                <p className="font-heading text-xl font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                  {money(saving)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Annual projected savings</p>
                <p className="font-heading text-xl font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                  {perYear(saving * 12)}
                </p>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(2, reduction))}%` }} />
            </div>
          </div>
        </Section>

        <Section title="Risks & dependencies" aside={<RiskBadge risk={rec.risk} />}>
          {rec.dependencies.length > 0 ? (
            <ul className="space-y-1.5">
              {rec.dependencies.map((d, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                  {d}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No dependencies.</p>
          )}
        </Section>

        <Section title={`Pillar · ${rec.pillar}`}>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{PILLAR_COPY[rec.pillar]}</p>
        </Section>
      </div>

      <SheetFooter className="flex-row items-center justify-between border-t">
        {rec.status === "Pending" ? (
          <>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{perMonth(saving)} at stake</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => dismiss(rec.id)}>
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                Dismiss
              </Button>
              <Button onClick={() => approve(rec.id)}>
                <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
                Approve
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <RecStatusBadge status={rec.status} />
              <span className="text-muted-foreground">
                {rec.status === "Approved" ? `${perMonth(saving)} approved projected savings` : "Dismissed from the queue"}
              </span>
            </div>
            <Button variant="outline" onClick={() => resetRecommendation(rec.id)}>
              <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} />
              Undo
            </Button>
          </>
        )}
      </SheetFooter>
    </>
  )
}
