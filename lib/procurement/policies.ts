import type { CloudResource, ProcurementOption, ProcurementRequest } from "@/lib/data/types"
import type { SpendState } from "@/lib/store/spend-store"
import { departmentSpend } from "./engine"

export function recommendedPlan(request: ProcurementRequest) {
  return request.analysis.options.find((option) => option.key === request.analysis.recommendedKey)!
}

export function cloudDonor(resources: CloudResource[], request: ProcurementRequest) {
  const reuse = request.analysis.reuse
  if (request.category !== "Cloud Compute" || !reuse) return undefined
  return resources.find((resource) => resource.spare && (
    reuse.resourceId ? resource.id === reuse.resourceId : reuse.source === `${resource.name} (${resource.provider} ${resource.type})`
  ))
}

export function evaluateProcurementOption(state: SpendState, request: ProcurementRequest, option: ProcurementOption) {
  const { settings } = state
  const { analysis } = request
  const budget = state.budgets.find((item) => item.department === request.department)?.monthlyBudget ?? 0
  const actual = departmentSpend(request.department, state.resources, state.vendors)
  const headroom = Math.round((budget - actual) * 100) / 100
  const overBudget = option.monthly > headroom
  const tier = option.monthly > settings.requireCfoAbove ? "cfo" : option.monthly < settings.autoApproveBelow ? "auto" : "standard"
  const required = settings.requireReuseCheck && request.category === "Cloud Compute"
  const reuse = analysis.reuse
  const donor = cloudDonor(state.resources, request)
  const ownReservation = request.status === "Approved (Optimized)" ? reuse?.quantity ?? 0 : 0
  const stale = request.category === "Cloud Compute" && reuse !== null && option.key !== "as-requested" &&
    (!donor?.spare || donor.spare.vcpu + ownReservation < reuse.quantity)
  const checked = analysis.reuseChecked ?? analysis.steps.length > 0
  const reuseCheck = stale ? "stale" : required ? (checked ? "complete" : "required") : "optional"
  const reason = stale ? "The quoted spare capacity is no longer available. Refresh the analysis."
    : reuseCheck === "required" ? "Run the required spare-capacity check before approving."
    : overBudget && settings.blockOverBudget ? "This option exceeds the department budget."
    : tier === "cfo" ? "Requires CFO sign-off"
    : null
  return {
    tier, overBudget, reuseCheck, blocked: reason !== null, reason,
    budget: { department: request.department, budget, actual, headroom, fits: !overBudget },
  } as const
}
