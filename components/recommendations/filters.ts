import type { RecStatus, Recommendation, Risk } from "@/lib/data/types"
import { recSavings } from "@/lib/store/selectors"

export const HIGH_IMPACT_MONTHLY = 1000

export type RecFilter =
  | "all"
  | "cloud"
  | "vendor"
  | "procurement"
  | "engine"
  | "reuse"
  | "high-impact"
  | "pending"
export type StatusFilter = RecStatus | "All"
export type RecSort = "savings" | "risk"

export const REC_FILTERS: { key: RecFilter; label: string; test: (r: Recommendation) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "cloud", label: "Cloud", test: (r) => r.source === "cloud" },
  { key: "vendor", label: "Vendors", test: (r) => r.source === "vendor" },
  { key: "procurement", label: "Procurement", test: (r) => r.source === "procurement" },
  { key: "engine", label: "Contracts & invoices", test: (r) => isEngineRec(r) },
  { key: "reuse", label: "Reuse", test: (r) => r.pillar === "Reuse" },
  { key: "high-impact", label: "High-impact", test: (r) => recSavings(r) >= HIGH_IMPACT_MONTHLY },
  { key: "pending", label: "Pending approval", test: (r) => r.status === "Pending" },
]

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "All", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Dismissed", label: "Dismissed" },
]

export const SORT_OPTIONS: { value: RecSort; label: string }[] = [
  { value: "savings", label: "Savings: high to low" },
  { value: "risk", label: "Risk: high to low" },
]

const RISK_RANK: Record<Risk, number> = { High: 3, Medium: 2, Low: 1 }

export function matchesStatus(r: Recommendation, status: StatusFilter) {
  return status === "All" || r.status === status
}

export function sortRecs(recs: Recommendation[], sort: RecSort) {
  return [...recs].sort((a, b) =>
    sort === "risk"
      ? RISK_RANK[b.risk] - RISK_RANK[a.risk] || recSavings(b) - recSavings(a)
      : recSavings(b) - recSavings(a),
  )
}

export const SOURCE_LABEL: Record<Recommendation["source"], string> = {
  cloud: "Cloud",
  vendor: "Vendor",
  procurement: "Procurement",
}

/** Recommendations that came from the SpendQ backend engine (findings → actions). */
export const isEngineRec = (r: Recommendation) => Boolean(r.actionId)

/**
 * How a recommendation's saving should be worded. Engine findings say so in
 * their "Estimated saving" evidence: annual, a one-time recovery (spread over
 * 12 months in the monthly figure), or nothing to save (investigate / act).
 */
export type SavingKind = "monthly" | "annual" | "one-time" | "none"

export function savingKind(r: Recommendation): SavingKind {
  if (!isEngineRec(r)) return recSavings(r) > 0 ? "monthly" : "none"
  const value = r.evidence.find((e) => e.label === "Estimated saving")?.value.toLowerCase() ?? ""
  if (value.includes("one-time")) return "one-time"
  if (recSavings(r) <= 0 || value.includes("investigate")) return "none"
  return "annual"
}

/** The one-time amount behind a spread recovery (the adapter divides it by 12). */
export const oneTimeAmount = (r: Recommendation) => recSavings(r) * 12

/** What to show instead of "$0/mo" for findings with no direct saving. */
export function zeroSavingLabel(r: Recommendation) {
  if (r.category === "Renewal notice") return "Act before notice deadline"
  if (r.category === "Spend anomaly") return "Investigate"
  return "Review"
}

/** Approve wording: findings with nothing to save are assigned to an owner. */
export const approveLabel = (r: Recommendation) => (savingKind(r) === "none" ? "Assign" : "Approve")

/** Engine confidence, read from the evidence ("90%"), or null. */
export function engineConfidence(r: Recommendation) {
  if (!isEngineRec(r)) return null
  return r.evidence.find((e) => e.label === "Confidence")?.value ?? null
}
