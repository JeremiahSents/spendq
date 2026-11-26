"use client"

import { useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Notification03Icon, ShoppingCart01Icon } from "@hugeicons/core-free-icons"

import { ToneBadge } from "@/components/shared/dashboard-ui"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Anomaly } from "@/lib/data/types"
import { shortDate } from "@/lib/format"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

export const SEVERITY_TONE: Record<Anomaly["severity"], "negative" | "warning" | "info"> = {
  Critical: "negative",
  Warning: "warning",
  Info: "info",
}

export function NotificationsPopover() {
  const { perMonth, moneyText } = useMoney()
  const { state, openDrawer } = useSpend()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState<Set<string>>(() => new Set())

  const approvals = useMemo(
    () => state.requests.filter((r) => r.status === "Pending review" || r.status === "In review"),
    [state.requests],
  )
  const keys = [...state.anomalies.map((a) => a.id), ...approvals.map((r) => r.id)]
  const unread = keys.filter((k) => !seen.has(k)).length

  function onOpenChange(next: boolean) {
    setOpen(next)
    // Opening the panel marks everything in it as read.
    if (next) setSeen(new Set(keys))
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-popup-open:bg-muted data-popup-open:text-foreground"
          />
        }
      >
        <HugeiconsIcon icon={Notification03Icon} size={17} strokeWidth={1.8} />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[22rem] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-medium">Notifications</span>
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{keys.length} items</span>
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          <SectionLabel>Spending anomalies</SectionLabel>
          {state.anomalies.length === 0 ? (
            <p className="px-3 pb-2 text-xs text-muted-foreground">No anomalies detected.</p>
          ) : (
            state.anomalies.map((a) => (
              <Row
                key={a.id}
                onClick={() => {
                  setOpen(false)
                  openDrawer({ kind: a.target.kind, id: a.target.id })
                }}
              >
                <div className="flex items-center gap-2">
                  <ToneBadge tone={SEVERITY_TONE[a.severity]}>{a.severity}</ToneBadge>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
                    {shortDate(a.detectedAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium">{a.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{moneyText(a.detail)}</p>
              </Row>
            ))
          )}
          <SectionLabel>Pending procurement approvals</SectionLabel>
          {approvals.length === 0 ? (
            <p className="px-3 pb-3 text-xs text-muted-foreground">No requests waiting on approval.</p>
          ) : (
            approvals.map((r) => (
              <Row
                key={r.id}
                onClick={() => {
                  setOpen(false)
                  openDrawer({ kind: "request", id: r.id })
                }}
              >
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={ShoppingCart01Icon} size={14} strokeWidth={1.8} className="text-muted-foreground" />
                  <span className="font-mono text-[11px] text-muted-foreground">{r.id}</span>
                  <ToneBadge tone="warning">{r.status}</ToneBadge>
                  <span className="ml-auto font-mono text-[11px] tabular-nums">{perMonth(r.requestedMonthly)}</span>
                </div>
                <p className="mt-1 truncate text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {r.department} · {r.requester}
                </p>
              </Row>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-2.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  )
}

function Row({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block w-full border-b border-border/60 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </button>
  )
}
