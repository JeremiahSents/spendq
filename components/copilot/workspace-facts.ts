import {
  budgetVsActual,
  cloudTotal,
  procurementSummary,
  savings,
  savingsByBucket,
  spendByProvider,
  SUBSIDIARY_MULTIPLIER,
  vendorTotal,
} from "@/lib/store/selectors"
import type { SpendState } from "@/lib/store/spend-store"

export function workspaceFacts(state: SpendState) {
  return {
    workspace: state.workspace,
    modeledRegionalOperations: state.workspace === "All Subsidiaries" ? SUBSIDIARY_MULTIPLIER : 1,
    currency: "USD",
    monthlyCloudSpend: cloudTotal(state),
    monthlyVendorSpend: vendorTotal(state),
    savings: savings(state),
    savingsByCategory: savingsByBucket(state),
    topProvidersAndBrandsByMonthlySpend: spendByProvider(state).slice(0, 12),
    departmentBudgets: budgetVsActual(state),
    procurement: procurementSummary(state),
    recentRequests: state.requests.slice(0, 8).map(({ id, category, analysis, department, status, requestedMonthly }) => ({
      id,
      category,
      department,
      status,
      requestedMonthly,
      optimizedMonthly: analysis.options.find((option) => option.recommended)?.monthly,
      projectedAvoidedMonthly: analysis.avoided,
      reuse: analysis.reuse ? { quantity: analysis.reuse.quantity, unit: analysis.unit } : null,
    })),
  }
}
