/**
 * Every derived number in the app. Pages call these instead of doing their own
 * math, so Overview, Cloud, Vendors, Procurement, Recommendations and the
 * Copilot always show the same figures.
 */
import { CLOUD_TREND, DEPARTMENTS, MONTHS, TODAY, VENDOR_TREND } from "@/lib/data/seed"
import type { CloudResource, Recommendation, SavingsBucket, Vendor, DateRange } from "@/lib/data/types"
import { BUCKET_BY_CATEGORY } from "./build"
import type { SpendState } from "./spend-store"

export const sum = <T,>(items: T[], pick: (item: T) => number) => items.reduce((s, i) => s + pick(i), 0)

export const vendorMonthly = (v: Vendor) => v.unitPrice * v.purchased
export const recSavings = (r: Recommendation) => Math.max(0, r.currentMonthly - r.recommendedMonthly)
export const unusedUnits = (v: Vendor) => v.purchased - v.active
export const licenseUtilization = (v: Vendor) => Math.round((v.active / v.purchased) * 100)

export function daysUntil(date: string) {
  return Math.round((new Date(`${date}T00:00:00Z`).getTime() - TODAY.getTime()) / 86_400_000)
}

export function cloudTotal(s: SpendState) {
  return sum(s.resources, (r) => r.monthlyCost)
}
export function vendorTotal(s: SpendState) {
  return sum(s.vendors, vendorMonthly)
}

/** Savings figures. "Projected" — approvals are commitments, not realized yet. */
export function savings(s: SpendState) {
  const pending = s.recommendations.filter((r) => r.status === "Pending")
  const approved = s.recommendations.filter((r) => r.status === "Approved")
  const potentialMonthly = sum(pending, recSavings)
  const approvedMonthly = sum(approved, recSavings)
  const avoidedMonthly = sum(
    approved.filter((r) => r.source === "procurement"),
    recSavings,
  )
  return {
    potentialMonthly,
    potentialAnnual: potentialMonthly * 12,
    approvedMonthly,
    approvedAnnual: approvedMonthly * 12,
    avoidedMonthly,
    avoidedAnnual: avoidedMonthly * 12,
    pendingCount: pending.length,
    approvedCount: approved.length,
    dismissedCount: s.recommendations.filter((r) => r.status === "Dismissed").length,
  }
}

export function potentialBySource(s: SpendState, source: Recommendation["source"]) {
  return sum(
    s.recommendations.filter((r) => r.source === source && r.status === "Pending"),
    recSavings,
  )
}

export function recommendationFor(s: SpendState, refId: string) {
  return s.recommendations.find((r) => r.refId === refId)
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
  const cloud = cloudTotal(s)
  const vendor = vendorTotal(s)
  const all = MONTHS.map((month, i) => ({
    month,
    cloud: Math.round(cloud * CLOUD_TREND[i]),
    vendor: Math.round(vendor * VENDOR_TREND[i]),
  }))
  return all.slice(-rangeMonths(s.range))
}

/** Percent change of the current month against the previous one. */
export function monthOverMonth(s: SpendState) {
  const cloud = cloudTotal(s)
  const vendor = vendorTotal(s)
  const prevCloud = cloud * CLOUD_TREND[CLOUD_TREND.length - 2]
  const prevVendor = vendor * VENDOR_TREND[VENDOR_TREND.length - 2]
  const pct = (now: number, prev: number) => ((now - prev) / prev) * 100
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
  const map = new Map<string, number>()
  for (const r of s.resources) map.set(r.provider, (map.get(r.provider) ?? 0) + r.monthlyCost)
  for (const v of s.vendors) map.set(v.brand, (map.get(v.brand) ?? 0) + vendorMonthly(v))
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function budgetVsActual(s: SpendState) {
  return DEPARTMENTS.map((department) => {
    const actual =
      sum(s.resources.filter((r) => r.department === department), (r) => r.monthlyCost) +
      sum(s.vendors.filter((v) => v.department === department), vendorMonthly)
    const budget = s.budgets.find((b) => b.department === department)?.monthlyBudget ?? 0
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
  return SAVINGS_BUCKETS.map((bucket) => {
    const recs = s.recommendations.filter((r) => BUCKET_BY_CATEGORY[r.category] === bucket)
    return {
      bucket,
      pending: sum(recs.filter((r) => r.status === "Pending"), recSavings),
      approved: sum(recs.filter((r) => r.status === "Approved"), recSavings),
    }
  })
}

export function topOpportunities(s: SpendState, limit = 5) {
  return s.recommendations
    .filter((r) => r.status === "Pending")
    .sort((a, b) => recSavings(b) - recSavings(a))
    .slice(0, limit)
}

export function upcomingRenewals(s: SpendState, withinDays = 90) {
  return s.vendors
    .map((v) => ({ vendor: v, days: daysUntil(v.renewalDate), annual: vendorMonthly(v) * 12 }))
    .filter((r) => r.days >= 0 && r.days <= withinDays)
    .sort((a, b) => a.days - b.days)
}

export function cloudSummary(s: SpendState) {
  const flagged = s.resources.filter(isUnderutilized)
  return {
    total: cloudTotal(s),
    active: s.resources.length,
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
    active: s.vendors.length,
    renewals90: upcomingRenewals(s, 90).length,
    potential: potentialBySource(s, "vendor"),
  }
}

export function procurementSummary(s: SpendState) {
  const pending = s.requests.filter((p) => p.status === "Pending review" || p.status === "In review")
  const approved = s.requests.filter((p) => p.status.startsWith("Approved"))
  return {
    pending: pending.length,
    approved: approved.length,
    requested: sum(s.requests, (p) => p.requestedMonthly),
    avoided: savings(s).avoidedMonthly,
  }
}
