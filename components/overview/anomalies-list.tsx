"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon } from "@hugeicons/core-free-icons"

import { SEVERITY_TONE } from "@/components/layout/notifications-popover"
import { BrandLogo } from "@/components/shared/brand-logo"
import { EmptyState, SectionCard, ToneBadge } from "@/components/shared/dashboard-ui"
import type { Anomaly } from "@/lib/data/types"
import { shortDate } from "@/lib/format"
import { useSpend, type SpendState } from "@/lib/store/spend-store"
import { ListDivider, ListRow } from "./list-row"

function targetBrand(state: SpendState, a: Anomaly) {
  if (a.target.kind === "resource") return state.resources.find((r) => r.id === a.target.id)?.provider
  return state.vendors.find((v) => v.id === a.target.id)?.brand
}

export function AnomaliesList() {
  const { state, openDrawer } = useSpend()
  const critical = state.anomalies.filter((a) => a.severity === "Critical").length

  return (
    <SectionCard
      title="Spending anomalies"
      description={`${state.anomalies.length} detected this week · ${critical} critical`}
    >
      {state.anomalies.length === 0 ? (
        <EmptyState title="No anomalies detected" description="Spend is tracking within expected bands." />
      ) : (
        <ListDivider>
          {state.anomalies.map((a) => {
            const brand = targetBrand(state, a)
            return (
              <ListRow key={a.id} label={`Open ${a.title}`} onOpen={() => openDrawer({ kind: a.target.kind, id: a.target.id })}>
                {brand ? (
                  <BrandLogo brand={brand} size="md" />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={1.8} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{a.detail}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ToneBadge tone={SEVERITY_TONE[a.severity]}>{a.severity}</ToneBadge>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{shortDate(a.detectedAt)}</span>
                </div>
              </ListRow>
            )
          })}
        </ListDivider>
      )}
    </SectionCard>
  )
}
