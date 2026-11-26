"use client"

import Link from "next/link"

import { EmptyState, SectionCard, ToneBadge } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import type { ProcurementRequest, RequestStatus } from "@/lib/data/types"
import { money, shortDate } from "@/lib/format"
import { useSpend } from "@/lib/store/spend-store"
import { ListDivider, ListRow } from "./list-row"

export const REQUEST_TONE: Record<RequestStatus, "positive" | "warning" | "negative" | "neutral" | "info"> = {
  "Pending review": "warning",
  "In review": "info",
  "Approved (Optimized)": "positive",
  "Approved (As requested)": "neutral",
  Rejected: "negative",
}

/** Spend avoided by approving the optimized option instead of the original ask. */
export function avoidedSpend(r: ProcurementRequest) {
  if (r.status !== "Approved (Optimized)") return 0
  const option = r.analysis.options.find((o) => o.key === r.analysis.recommendedKey)
  return option ? Math.max(0, r.requestedMonthly - option.monthly) : 0
}

export function RecentRequests() {
  const { state, openDrawer } = useSpend()
  const requests = state.requests.slice(0, 4)

  return (
    <SectionCard
      title="Recent procurement requests"
      description={`${state.requests.length} requests on file · avoided spend shown when approved optimized`}
      action={
        <Button variant="ghost" size="xs" nativeButton={false} render={<Link href="/procurement" />}>
          View all
        </Button>
      }
    >
      {requests.length === 0 ? (
        <EmptyState title="No procurement requests yet" />
      ) : (
        <ListDivider>
          {requests.map((r) => {
            const avoided = avoidedSpend(r)
            return (
              <ListRow key={r.id} label={`Open request ${r.id}`} onOpen={() => openDrawer({ kind: "request", id: r.id })}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{r.id}</span>
                    <ToneBadge tone={REQUEST_TONE[r.status]}>{r.status}</ToneBadge>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.department} · {r.requester} ·{" "}
                    <span className="font-mono tabular-nums">{shortDate(r.submittedAt)}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm tabular-nums">
                    {money(r.requestedMonthly)}
                    <span className="text-xs text-muted-foreground">/mo</span>
                  </p>
                  {avoided > 0 ? (
                    <p className="font-mono text-[11px] text-emerald-700 tabular-nums dark:text-emerald-400">
                      −{money(avoided)}/mo avoided
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">requested</p>
                  )}
                </div>
              </ListRow>
            )
          })}
        </ListDivider>
      )}
    </SectionCard>
  )
}
