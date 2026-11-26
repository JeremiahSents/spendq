import { ToneBadge } from "@/components/shared/dashboard-ui"
import type { RecCategory, RecStatus, Recommendation, Vendor } from "@/lib/data/types"
import { recSavings } from "@/lib/store/selectors"
import type { SpendState } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

/** Short verb phrases for the directory's status column. */
export const ACTION_LABEL: Partial<Record<RecCategory, string>> = {
  "License reclaim": "Reclaim licenses",
  "Seat reduction": "Reduce seats",
  "Tier downgrade": "Downgrade tier",
  Renegotiation: "Renegotiate",
  Consolidation: "Consolidate",
  "Vendor switch": "Switch vendor",
  Overbilling: "Recover overcharge",
  "Duplicate invoice": "Block duplicate",
  "Duplicate subscription": "Merge contracts",
  "Spend anomaly": "Investigate",
  "Renewal notice": "Send notice",
}

const STATUS_RANK: Record<RecStatus, number> = { Pending: 0, Approved: 1, Dismissed: 2 }

/**
 * Every recommendation for a vendor, most relevant first: pending before
 * approved before dismissed, then by saving. A backend contract can carry
 * several (Zoom: unused seats, overlap, renewal notice).
 */
export function vendorRecs(state: Pick<SpendState, "recommendations">, vendorId: string) {
  return state.recommendations
    .filter((r) => r.refId === vendorId)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || recSavings(b) - recSavings(a))
}

/** The recommendation that speaks for the vendor: the most valuable pending one. */
export const primaryVendorRec = (state: Pick<SpendState, "recommendations">, vendorId: string) =>
  vendorRecs(state, vendorId)[0]

/**
 * Consumption contracts (AWS, connectivity) come from the backend as a single
 * "unit" worth thousands a month. A 1/1 licence bar means nothing for them.
 */
export const isUsageBased = (v: Vendor) => v.purchased <= 1 && v.active <= 1

export type VendorStatus = { label: string; tone: "positive" | "warning" | "neutral" }

export function vendorStatus(rec: Recommendation | undefined): VendorStatus {
  if (!rec) return { label: "Optimized", tone: "positive" }
  if (rec.status === "Approved") return { label: "Action approved", tone: "positive" }
  if (rec.status === "Dismissed") return { label: "Dismissed", tone: "neutral" }
  return { label: ACTION_LABEL[rec.category] ?? rec.category, tone: "warning" }
}

export function VendorStatusBadge({ rec, more = 0 }: { rec: Recommendation | undefined; more?: number }) {
  const s = vendorStatus(rec)
  return (
    <span className="inline-flex items-center gap-1.5">
      <ToneBadge tone={s.tone}>{s.label}</ToneBadge>
      {more > 0 ? <span className="font-mono text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">+{more} more</span> : null}
    </span>
  )
}

/** License utilization tone: red under 60%, amber under 85%, green otherwise. */
export function utilTone(pct: number) {
  return pct < 60 ? "negative" : pct < 85 ? "warning" : "positive"
}

export function LicenseBar({ value, className }: { value: number; className?: string }) {
  const tone = utilTone(value)
  return (
    <div className={cn("flex min-w-24 items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "negative" ? "bg-destructive" : tone === "warning" ? "bg-amber-500" : "bg-emerald-500",
          )}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
      <span
        className={cn(
          "w-9 text-right font-mono text-xs tabular-nums",
          tone === "negative" && "text-destructive",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value}%
      </span>
    </div>
  )
}

/** Days-remaining chip: red under 30, amber under 90. */
export function DaysBadge({ days }: { days: number }) {
  const tone = days < 0 ? "neutral" : days < 30 ? "negative" : days < 90 ? "warning" : "neutral"
  return (
    <ToneBadge tone={tone}>
      <span className="font-mono tabular-nums">{days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}</span>
    </ToneBadge>
  )
}
