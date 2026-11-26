"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, ArrowTurnBackwardIcon, Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { BrandLogo } from "@/components/shared/brand-logo"
import { PillarBadge, RecStatusBadge, RiskBadge } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import type { Recommendation } from "@/lib/data/types"
import { money, perMonth, perYear } from "@/lib/format"
import { recSavings } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { useRecActions } from "@/lib/store/use-rec-actions"
import { cn } from "@/lib/utils"

export function RecommendationRow({ rec }: { rec: Recommendation }) {
  const { openDrawer, resetRecommendation } = useSpend()
  const { approve, dismiss } = useRecActions()
  const saving = recSavings(rec)
  const open = () => openDrawer({ kind: "recommendation", id: rec.id })
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          open()
        }
      }}
      className={cn(
        "group grid cursor-pointer grid-cols-1 gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-6",
        rec.status === "Dismissed" && "opacity-70",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <BrandLogo brand={rec.brand} size="md" className="mt-0.5" />
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium">{rec.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <PillarBadge pillar={rec.pillar} />
            <span>{rec.category}</span>
            <span aria-hidden>·</span>
            <span>{rec.department}</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            Current {money(rec.currentMonthly)} <span aria-hidden>→</span> Recommended {money(rec.recommendedMonthly)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:flex-col md:items-end md:gap-1">
        <span
          className={cn(
            "font-heading text-lg font-semibold tracking-[-0.01em] tabular-nums",
            rec.status === "Dismissed" ? "text-muted-foreground line-through" : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {perMonth(saving)}
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{perYear(saving * 12)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:w-[300px] md:justify-end" onClick={stop} onKeyDown={stop}>
        <RiskBadge risk={rec.risk} />
        <RecStatusBadge status={rec.status} />
        {rec.status === "Pending" ? (
          <>
            <Button size="sm" variant="outline" onClick={() => dismiss(rec.id)} aria-label={`Dismiss ${rec.title}`}>
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              Dismiss
            </Button>
            <Button size="sm" onClick={() => approve(rec.id)} aria-label={`Approve ${rec.title}`}>
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
              Approve
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => resetRecommendation(rec.id)} aria-label={`Undo decision on ${rec.title}`}>
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} />
            Undo
          </Button>
        )}
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={16}
          className="hidden text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block"
        />
      </div>
    </div>
  )
}
