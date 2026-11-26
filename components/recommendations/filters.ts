import type { RecStatus, Recommendation, Risk } from "@/lib/data/types"
import { recSavings } from "@/lib/store/selectors"

export const HIGH_IMPACT_MONTHLY = 1000

export type RecFilter = "all" | "cloud" | "vendor" | "procurement" | "reuse" | "high-impact" | "pending"
export type StatusFilter = RecStatus | "All"
export type RecSort = "savings" | "risk"

export const REC_FILTERS: { key: RecFilter; label: string; test: (r: Recommendation) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "cloud", label: "Cloud", test: (r) => r.source === "cloud" },
  { key: "vendor", label: "Vendors", test: (r) => r.source === "vendor" },
  { key: "procurement", label: "Procurement", test: (r) => r.source === "procurement" },
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
