import { ToneBadge } from "@/components/shared/dashboard-ui"
import type { ProcurementOption, ProcurementRequest, RequestStatus } from "@/lib/data/types"

export const STATUS_TONE: Record<RequestStatus, "positive" | "warning" | "negative" | "neutral" | "info"> = {
  "Pending review": "warning",
  "In review": "info",
  "Approved (Optimized)": "positive",
  "Approved (As requested)": "neutral",
  Rejected: "negative",
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <ToneBadge tone={STATUS_TONE[status]}>{status}</ToneBadge>
}

/** True once a final decision (approve either way, or reject) has been taken. */
export function isDecided(status: RequestStatus) {
  return status === "Approved (Optimized)" || status === "Approved (As requested)" || status === "Rejected"
}

export function recommendedOption(request: ProcurementRequest): ProcurementOption {
  const a = request.analysis
  return a.options.find((o) => o.key === a.recommendedKey) ?? a.options[0]
}

export function asRequestedOption(request: ProcurementRequest): ProcurementOption {
  return request.analysis.options.find((o) => o.key === "as-requested") ?? request.analysis.options[0]
}

/** Short label of the engine's recommendation, e.g. "Reuse + DigitalOcean" or "Switch to Datadog". */
export function recommendedAction(request: ProcurementRequest) {
  const a = request.analysis
  const alt = a.alternative ? (a.alternative.brand ?? a.alternative.name) : null
  switch (a.recommendedKey) {
    case "as-requested":
      return "Buy as requested"
    case "reuse":
      return a.capacity - (a.reuse?.quantity ?? 0) > 0 ? `Reuse + ${request.preferredVendor}` : "Reuse existing"
    case "optimized":
      return a.reuse ? `Reuse + ${alt}` : `Switch to ${alt}`
  }
}
