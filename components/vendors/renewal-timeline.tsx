"use client"

import { BrandLogo } from "@/components/shared/brand-logo"
import { SectionCard } from "@/components/shared/dashboard-ui"
import { money, shortDate } from "@/lib/format"
import { daysUntil, vendorMonthly } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

const SPAN = 120
const TICKS = [0, 30, 60, 90, 120]

/** Next-120-day renewal strip. Amber band = notice window, marker = renewal date. */
export function RenewalTimeline() {
  const { state, openDrawer } = useSpend()
  const items = state.vendors
    .map((v) => ({ v, days: daysUntil(v.renewalDate) }))
    .filter((r) => r.days >= 0 && r.days <= SPAN)
    .sort((a, b) => a.days - b.days)

  const pos = (d: number) => `${(Math.max(0, Math.min(SPAN, d)) / SPAN) * 100}%`

  return (
    <SectionCard
      title="Renewal timeline"
      description="Next 120 days. Shaded band is the notice window; act before it opens to keep negotiating leverage."
      action={
        <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-amber-500/30 ring-1 ring-amber-500/50" /> Notice window
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-destructive" /> Deadline passed
          </span>
        </div>
      }
    >
      {items.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No renewals in the next 120 days.</p>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[9rem_1fr] gap-3 sm:grid-cols-[12rem_1fr]">
            <div />
            <div className="relative h-4 font-mono text-[10px] text-muted-foreground tabular-nums">
              {TICKS.map((t) => (
                <span
                  key={t}
                  className={cn("absolute", t === 0 ? "" : t === SPAN ? "-translate-x-full" : "-translate-x-1/2")}
                  style={{ left: pos(t) }}
                >
                  {t === 0 ? "Today" : `${t}d`}
                </span>
              ))}
            </div>
          </div>
          {items.map(({ v, days }) => {
            const noticeStart = days - v.noticeDays
            const passed = noticeStart <= 0
            const urgent = !passed && noticeStart < 14
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => openDrawer({ kind: "vendor", id: v.id })}
                className="grid w-full grid-cols-[9rem_1fr] items-center gap-3 rounded-md py-1 text-left hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none sm:grid-cols-[12rem_1fr]"
              >
                <div className="flex min-w-0 items-center gap-2 pl-1">
                  <BrandLogo brand={v.brand} size="xs" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{v.name}</div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground tabular-nums">
                      {money(vendorMonthly(v) * 12)}/yr · {v.autoRenew ? "auto-renews" : "manual"}
                    </div>
                  </div>
                </div>
                <div className="relative h-6">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                  {TICKS.slice(1, -1).map((t) => (
                    <div key={t} className="absolute top-1 bottom-1 w-px bg-border/70" style={{ left: pos(t) }} />
                  ))}
                  <div
                    className={cn(
                      "absolute top-1 bottom-1 rounded-sm ring-1",
                      passed || urgent
                        ? "bg-destructive/15 ring-destructive/40"
                        : "bg-amber-500/20 ring-amber-500/40",
                    )}
                    style={{ left: pos(noticeStart), width: `calc(${pos(days)} - ${pos(noticeStart)})` }}
                  />
                  <div
                    className={cn(
                      "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
                      passed ? "bg-destructive" : "bg-foreground",
                    )}
                    style={{ left: pos(days) }}
                  />
                  <span
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 pl-2.5 font-mono text-[10px] whitespace-nowrap tabular-nums",
                      days > 90 && "-translate-x-full pr-2.5 pl-0",
                      passed ? "text-destructive" : "text-muted-foreground",
                    )}
                    style={{ left: pos(days) }}
                  >
                    {shortDate(v.renewalDate)} · {days}d{passed ? " · notice passed" : ""}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}
