/**
 * Every derived number in the app. Pages call these instead of doing their own
 * math, so Overview, Cloud, Vendors, Procurement, Recommendations and the
 * Copilot always show the same figures.
 */
import { CLOUD_TREND, DEPARTMENTS, MONTHS, TODAY, VENDOR_TREND } from "@/lib/data/seed"
import type { CloudResource, Recommendation, SavingsBucket, Vendor, DateRange, Department } from "@/lib/data/types"
import { BUCKET_BY_CATEGORY } from "./build"
import type { SpendState, Workspace } from "./spend-store"

export const SUBSIDIARY_MULTIPLIER = 3

export function workspaceIncludesDepartment(workspace: Workspace, department: Department) {
  return workspace !== "Group Digital Banking" || department === "Digital Channels" || department === "Cloud Platform"
}

const workspaceViews = new WeakMap<SpendState, SpendState>()

export function scopeWorkspace(state: SpendState): SpendState {
  if (state.workspace !== "Group Digital Banking") return state

  const cached = workspaceViews.get(state)
  if (cached) return cached

  const includes = (item: { department: Department }) => workspaceIncludesDepartment(state.workspace, item.department)
  const resources = state.resources.filter(includes)
  const vendors = state.vendors.filter(includes)
  const resourceIds = new Set(resources.map((resource) => resource.id))
  const vendorIds = new Set(vendors.map((vendor) => vendor.id))
  const scoped = {
    ...state,
    resources,
    vendors,
    requests: state.requests.filter(includes),
    recommendations: state.recommendations.filter(includes),
    budgets: state.budgets.filter(includes),
    anomalies: state.anomalies.filter(({ target }) => (target.kind === "resource" ? resourceIds : vendorIds).has(target.id)),
  }
  workspaceViews.set(state, scoped)
  workspaceViews.set(scoped, scoped)
  return scoped
}

/** The group model assumes three regions with the same financial profile. */
export function workspaceTotal(workspace: Workspace, amount: number) {
  return workspace === "All Subsidiaries" ? amount * SUBSIDIARY_MULTIPLIER : amount
}

export const sum = <T,>(items: T[], pick: (item: T) => number) => items.reduce((s, i) => s + pick(i), 0)

export const vendorMonthly = (v: Vendor) => v.unitPrice * v.purchased
export const recSavings = (r: Recommendation) => Math.max(0, r.currentMonthly - r.recommendedMonthly)
export const unusedUnits = (v: Vendor) => v.purchased - v.active
export const licenseUtilization = (v: Vendor) => Math.round((v.active / v.purchased) * 100)

export function daysUntil(date: string) {
  return Math.round((new Date(`${date}T00:00:00Z`).getTime() - TODAY.getTime()) / 86_400_000)
}

export function cloudTotal(s: SpendState) {
  return workspaceTotal(s.workspace, sum(scopeWorkspace(s).resources, (r) => r.monthlyCost))
}
export function vendorTotal(s: SpendState) {
  return workspaceTotal(s.workspace, sum(scopeWorkspace(s).vendors, vendorMonthly))
}

/** Savings figures. "Projected" — approvals are commitments, not realized yet. */
export function savings(s: SpendState) {
  const { recommendations } = scopeWorkspace(s)
  const pending = recommendations.filter((r) => r.status === "Pending")
  const approved = recommendations.filter((r) => r.status === "Approved")
  const potentialMonthly = workspaceTotal(s.workspace, sum(pending, recSavings))
  const approvedMonthly = workspaceTotal(s.workspace, sum(approved, recSavings))
  const avoidedMonthly = workspaceTotal(s.workspace, sum(approved.filter((r) => r.source === "procurement"), recSavings))
  return {
    potentialMonthly,
    potentialAnnual: potentialMonthly * 12,
    approvedMonthly,
    approvedAnnual: approvedMonthly * 12,
    avoidedMonthly,
    avoidedAnnual: avoidedMonthly * 12,
    pendingCount: pending.length,
    approvedCount: approved.length,
    dismissedCount: recommendations.filter((r) => r.status === "Dismissed").length,
  }
}

export function potentialBySource(s: SpendState, source: Recommendation["source"]) {
  const rows = scopeWorkspace(s).recommendations.filter((r) => r.source === source && r.status === "Pending")
  return workspaceTotal(s.workspace, sum(rows, recSavings))
}

/** The record's headline recommendation: pending before decided, then the biggest saving. */
export function recommendationFor(s: SpendState, refId: string) {
  return scopeWorkspace(s).recommendations
    .filter((r) => r.refId === refId)
    .sort((a, b) => Number(b.status === "Pending") - Number(a.status === "Pending") || recSavings(b) - recSavings(a))[0]
}

/** How a recommendation's saving should be worded in toasts. */
export function savingWording(r: Recommendation) {
  const saving = recSavings(r)
  if (saving <= 0) return { kind: "none" as const, text: "no direct saving" }
  const oneTime = r.evidence.some((e) => e.label === "Estimated saving" && e.value.includes("one-time"))
  if (oneTime) return { kind: "one-time" as const, text: `$${Math.round(saving * 12).toLocaleString("en-US")} one-time recovery` }
  return { kind: "monthly" as const, text: `$${Math.round(saving).toLocaleString("en-US")}/mo projected savings` }
}

/** Months shown for the selected date range. */
export function rangeMonths(range: DateRange) {
  return range === "30d" ? 6 : range === "qtd" ? 3 : MONTHS.length
}

export const RANGE_LABEL: Record<DateRange, string> = {
  "30d": "Last 30 days",
  qtd: "Quarter to date",
  ytd: "Year to date",
}

export function spendTrend(s: SpendState) {
  const { resources, vendors } = scopeWorkspace(s)
  const cloud = sum(resources, (r) => r.monthlyCost)
  const vendor = sum(vendors, vendorMonthly)
  const all = MONTHS.map((month, i) => ({
    month,
    cloud: workspaceTotal(s.workspace, Math.round(cloud * CLOUD_TREND[i])),
    vendor: workspaceTotal(s.workspace, Math.round(vendor * VENDOR_TREND[i])),
  }))
  return all.slice(-rangeMonths(s.range))
}

/** Percent change of the current month against the previous one. */
export function monthOverMonth(s: SpendState) {
  const cloud = cloudTotal(s)
  const vendor = vendorTotal(s)
  const prevCloud = cloud * CLOUD_TREND[CLOUD_TREND.length - 2]
  const prevVendor = vendor * VENDOR_TREND[VENDOR_TREND.length - 2]
  const pct = (now: number, prev: number) => prev > 0 ? ((now - prev) / prev) * 100 : 0
  return {
    total: pct(cloud + vendor, prevCloud + prevVendor),
    cloud: pct(cloud, prevCloud),
    vendor: pct(vendor, prevVendor),
  }
}

/**
 * Last eight months of a figure for a MetricCard sparkline, ending on today's
 * value. Spend series follow the simulated baseline trend; other figures reuse
 * the closest spend shape, so they are labelled as simulated.
 */
export function sparkSeries(current: number, shape: "cloud" | "vendor" | "total" = "total", points = 8) {
  const factors =
    shape === "cloud"
      ? CLOUD_TREND
      : shape === "vendor"
        ? VENDOR_TREND
        : CLOUD_TREND.map((c, i) => (c + VENDOR_TREND[i]) / 2)
  return factors.slice(-points).map((f) => Math.round(current * f * 100) / 100)
}

export function spendByProvider(s: SpendState) {
  const { resources, vendors } = scopeWorkspace(s)
  const map = new Map<string, number>()
  for (const r of resources) map.set(r.provider, (map.get(r.provider) ?? 0) + r.monthlyCost)
  for (const v of vendors) map.set(v.brand, (map.get(v.brand) ?? 0) + vendorMonthly(v))
  return [...map.entries()].map(([name, value]) => ({ name, value: workspaceTotal(s.workspace, value) })).sort((a, b) => b.value - a.value)
}

export function budgetVsActual(s: SpendState) {
  const { resources, vendors, budgets } = scopeWorkspace(s)
  return DEPARTMENTS.filter((department) => workspaceIncludesDepartment(s.workspace, department)).map((department) => {
    const actual = workspaceTotal(s.workspace,
      sum(resources.filter((r) => r.department === department), (r) => r.monthlyCost) +
      sum(vendors.filter((v) => v.department === department), vendorMonthly),
    )
    const budget = workspaceTotal(s.workspace, budgets.find((b) => b.department === department)?.monthlyBudget ?? 0)
    return { department, budget, actual, over: actual > budget }
  })
}

export const SAVINGS_BUCKETS: SavingsBucket[] = [
  "Idle infrastructure",
  "Overprovisioned",
  "License reclaim",
  "Vendor switch",
  "Infrastructure reuse",
  "Billing errors",
]

export function savingsByBucket(s: SpendState) {
  const { recommendations } = scopeWorkspace(s)
  return SAVINGS_BUCKETS.map((bucket) => {
    const recs = recommendations.filter((r) => BUCKET_BY_CATEGORY[r.category] === bucket)
    return {
      bucket,
      pending: workspaceTotal(s.workspace, sum(recs.filter((r) => r.status === "Pending"), recSavings)),
      approved: workspaceTotal(s.workspace, sum(recs.filter((r) => r.status === "Approved"), recSavings)),
    }
  })
}

export function topOpportunities(s: SpendState, limit = 5) {
  return scopeWorkspace(s).recommendations
    .filter((r) => r.status === "Pending")
    .sort((a, b) => recSavings(b) - recSavings(a))
    .slice(0, limit)
}

export function upcomingRenewals(s: SpendState, withinDays = 90) {
  return scopeWorkspace(s).vendors
    .map((v) => ({ vendor: v, days: daysUntil(v.renewalDate), annual: vendorMonthly(v) * 12 }))
    .filter((r) => r.days >= 0 && r.days <= withinDays)
    .sort((a, b) => a.days - b.days)
}

export function cloudSummary(s: SpendState) {
  const { resources } = scopeWorkspace(s)
  const flagged = resources.filter(isUnderutilized)
  return {
    total: cloudTotal(s),
    active: resources.length,
    underutilized: flagged.length,
    potential: potentialBySource(s, "cloud"),
  }
}

export function isUnderutilized(r: CloudResource) {
  return r.recommendedCost < r.monthlyCost
}

export function vendorSummary(s: SpendState) {
  return {
    total: vendorTotal(s),
    active: scopeWorkspace(s).vendors.length,
    renewals90: upcomingRenewals(s, 90).length,
    potential: potentialBySource(s, "vendor"),
  }
}

export function procurementSummary(s: SpendState) {
  const { requests } = scopeWorkspace(s)
  const pending = requests.filter((p) => p.status === "Pending review" || p.status === "In review")
  const approved = requests.filter((p) => p.status.startsWith("Approved"))
  return {
    pending: pending.length,
    approved: approved.length,
    requested: workspaceTotal(s.workspace, sum(requests, (p) => p.requestedMonthly)),
    avoided: savings(s).avoidedMonthly,
  }
}
