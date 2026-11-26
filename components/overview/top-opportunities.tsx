"use client"

import Link from "next/link"

import { BrandLogo } from "@/components/shared/brand-logo"
import { EmptyState, PillarBadge, SectionCard } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { recSavings, savings, topOpportunities } from "@/lib/store/selectors"
import { useRecActions } from "@/lib/store/use-rec-actions"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { ListDivider, ListRow } from "./list-row"

export function TopOpportunities() {
  const { money } = useMoney()
  const { state, openDrawer } = useSpend()
  const { approve } = useRecActions()
  const recs = topOpportunities(state, 5)
  const pending = savings(state).pendingCount

  return (
    <SectionCard
      title="Top optimization opportunities"
      description={`Largest of ${pending} pending recommendations · projected savings`}
      action={
        <Button variant="ghost" size="xs" nativeButton={false} render={<Link href="/recommendations" />}>
          View all
        </Button>
      }
    >
      {recs.length === 0 ? (
        <EmptyState
          title="No pending opportunities"
          description="Every recommendation has been approved or dismissed. New ones appear as usage data syncs."
        />
      ) : (
        <ListDivider>
          {recs.map((r) => (
            <ListRow key={r.id} label={`Open ${r.title}`} onOpen={() => openDrawer({ kind: "recommendation", id: r.id })}>
              <BrandLogo brand={r.brand} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <PillarBadge pillar={r.pillar} />
                  <span className="truncate">
                    {r.category} · {r.department}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
                  {money(recSavings(r))}
                  <span className="text-xs text-muted-foreground">/mo</span>
                </p>
                <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {money(recSavings(r) * 12)}/yr
                </p>
              </div>
              <Button
                size="xs"
                variant="outline"
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  approve(r.id)
                }}
              >
                Approve
              </Button>
            </ListRow>
          ))}
        </ListDivider>
      )}
    </SectionCard>
  )
}
