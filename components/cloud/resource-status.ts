import type { CloudResource, RecCategory, Recommendation } from "@/lib/data/types"
import { recSavings, recommendationFor } from "@/lib/store/selectors"
import type { SpendState } from "@/lib/store/spend-store"

export type StatusFilter = "all" | "optimized" | "flagged" | "spare" | "approved"
export type StatusTone = "positive" | "warning" | "negative" | "neutral" | "info"

export interface ResourceStatus {
  filter: StatusFilter | "dismissed"
  label: string
  tone: StatusTone
  rec: Recommendation | undefined
  /** Savings tied to this resource: pending or approved recommendation, else 0. */
  savings: number
}

export const CATEGORY_SHORT: Partial<Record<RecCategory, string>> = {
  "Idle infrastructure": "Idle",
  Overprovisioned: "Overprovisioned",
  "Unused storage": "Unused storage",
  "Dev scheduling": "Dev scheduling",
  "Alternative provider": "Alt provider",
}

/** Optimization status, derived from the linked recommendation so it updates live. */
export function resourceStatus(state: SpendState, r: CloudResource): ResourceStatus {
  const rec = recommendationFor(state, r.id)
  if (rec?.status === "Approved") {
    return { filter: "approved", label: "Action approved", tone: "positive", rec, savings: recSavings(rec) }
  }
  if (rec?.status === "Dismissed") {
    return { filter: "dismissed", label: "Dismissed", tone: "neutral", rec, savings: 0 }
  }
  if (rec?.status === "Pending") {
    const negative = rec.category === "Idle infrastructure" || rec.category === "Unused storage"
    return {
      filter: "flagged",
      label: CATEGORY_SHORT[rec.category] ?? rec.category,
      tone: negative ? "negative" : "warning",
      rec,
      savings: recSavings(rec),
    }
  }
  if (r.spare) {
    return { filter: "spare", label: `Spare capacity · ${r.spare.vcpu} vCPU remaining`, tone: "info", rec, savings: 0 }
  }
  return { filter: "optimized", label: "Optimized", tone: "positive", rec, savings: 0 }
}
