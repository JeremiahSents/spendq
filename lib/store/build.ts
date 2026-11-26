import { analyzeRequest } from "@/lib/procurement/engine"
import { seedBudgets, seedResources, seedVendors } from "@/lib/data/seed"
import type {
  CloudResource,
  Pillar,
  ProcurementRequest,
  RecCategory,
  Recommendation,
  SavingsBucket,
  Vendor,
} from "@/lib/data/types"

export const PILLAR_BY_CATEGORY: Record<RecCategory, Pillar> = {
  "Idle infrastructure": "Eliminate",
  Overprovisioned: "Eliminate",
  "Unused storage": "Eliminate",
  "Dev scheduling": "Automate",
  "Alternative provider": "Innovate",
  "License reclaim": "Reuse",
  "Seat reduction": "Eliminate",
  "Tier downgrade": "Eliminate",
  Renegotiation: "Innovate",
  Consolidation: "Eliminate",
  "Vendor switch": "Innovate",
  "Infrastructure reuse": "Reuse",
}

export const BUCKET_BY_CATEGORY: Record<RecCategory, SavingsBucket> = {
  "Idle infrastructure": "Idle infrastructure",
  "Unused storage": "Idle infrastructure",
  "Dev scheduling": "Idle infrastructure",
  Overprovisioned: "Overprovisioned",
  "License reclaim": "License reclaim",
  "Seat reduction": "License reclaim",
  "Tier downgrade": "License reclaim",
  "Alternative provider": "Vendor switch",
  Renegotiation: "Vendor switch",
  Consolidation: "Vendor switch",
  "Vendor switch": "Vendor switch",
  "Infrastructure reuse": "Infrastructure reuse",
}

export const PILLAR_COPY: Record<Pillar, string> = {
  Reuse: "Reallocate existing spare cloud capacity and licenses before buying new.",
  Innovate: "Benchmark alternative providers and plans with data-driven comparisons.",
  Automate: "Run instant inventory checks, savings math and approval workflows.",
  Eliminate: "Stop unnecessary cloud and license spend before it hits the bill.",
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`

export function resourceRecommendation(r: CloudResource): Recommendation | null {
  if (!r.category || r.recommendedCost >= r.monthlyCost) return null
  return {
    id: `rec-${r.id}`,
    source: "cloud",
    refId: r.id,
    brand: r.provider,
    title: `${r.category === "Idle infrastructure" ? "Retire" : r.category === "Dev scheduling" ? "Schedule" : r.category === "Unused storage" ? "Clean up" : r.category === "Alternative provider" ? "Re-platform" : "Right-size"} ${r.name}`,
    pillar: PILLAR_BY_CATEGORY[r.category],
    category: r.category,
    department: r.department,
    currentMonthly: r.monthlyCost,
    recommendedMonthly: r.recommendedCost,
    risk: r.risk,
    status: "Pending",
    problem: r.analysis ?? "",
    evidence: [
      ...(r.cpu !== null ? [{ label: "Avg CPU (30d)", value: `${r.cpu}%` }] : []),
      ...(r.memory !== null ? [{ label: "Avg memory (30d)", value: `${r.memory}%` }] : []),
      { label: "Current config", value: r.size },
      { label: "Recommended", value: r.recommendedConfig ?? "—" },
      { label: "Environment", value: r.environment },
    ],
    steps: [
      `Notify the ${r.department} owner and confirm the change window`,
      r.recommendedConfig ? `Apply: ${r.recommendedConfig}` : "Apply the recommended configuration",
      "Watch utilization for 7 days and roll back if p95 latency regresses",
    ],
    dependencies: r.environment === "Production" ? ["Change Advisory Board approval for production"] : ["None for non-production"],
  }
}

export function vendorRecommendation(v: Vendor): Recommendation | null {
  if (!v.recommendation) return null
  const current = v.unitPrice * v.purchased
  return {
    id: `rec-${v.id}`,
    source: "vendor",
    refId: v.id,
    brand: v.brand,
    title: v.recommendation.title,
    pillar: PILLAR_BY_CATEGORY[v.recommendation.category],
    category: v.recommendation.category,
    department: v.department,
    currentMonthly: current,
    recommendedMonthly: v.recommendation.recommendedMonthly,
    risk: v.recommendation.risk,
    status: "Pending",
    problem: v.recommendation.detail,
    evidence: [
      { label: `Purchased ${v.unit}`, value: String(v.purchased) },
      { label: `Active ${v.unit}`, value: `${v.active} (${Math.round((v.active / v.purchased) * 100)}%)` },
      { label: "Unit price", value: `$${v.unitPrice}/${v.unit === "seats" ? "seat" : "host"}/mo` },
      { label: "Renewal", value: `${v.renewalDate}${v.autoRenew ? " · auto-renews" : ""}` },
    ],
    steps: [
      v.recommendation.action,
      `Confirm with ${v.owner}`,
      "Update the contract record and notify finance",
    ],
    dependencies: [`${v.noticeDays}-day notice window before ${v.renewalDate}`],
  }
}

export function procurementRecommendation(p: ProcurementRequest): Recommendation | null {
  const a = p.analysis
  if (a.avoided <= 0) return null
  const best = a.options.find((o) => o.key === a.recommendedKey)!
  const status =
    p.status === "Approved (Optimized)" ? "Approved" : p.status === "Rejected" || p.status === "Approved (As requested)" ? "Dismissed" : "Pending"
  return {
    id: `rec-${p.id}`,
    source: "procurement",
    refId: p.id,
    brand: a.reuse?.brand ?? a.alternative?.brand ?? "SpendIQ",
    title: `Optimize ${p.id}: ${p.title}`,
    pillar: a.reuse ? "Reuse" : "Innovate",
    category: a.reuse ? "Infrastructure reuse" : "Vendor switch",
    department: p.department,
    currentMonthly: p.requestedMonthly,
    recommendedMonthly: best.monthly,
    risk: best.risk,
    status,
    problem: `${p.department} requested ${a.capacity} ${a.unit} from ${p.preferredVendor} for ${fmt(p.requestedMonthly)}/month. ${a.reuse ? `${a.reuse.quantity} ${a.unit} already exist as spare capacity.` : ""} ${a.alternative ? `${a.alternative.name} meets the rest for less.` : ""}`.trim(),
    evidence: [
      { label: "Requested", value: `${a.capacity} ${a.unit} · ${fmt(p.requestedMonthly)}/mo` },
      ...(a.reuse ? [{ label: "Spare capacity", value: `${a.reuse.quantity} ${a.unit} on ${a.reuse.source}` }] : []),
      ...(a.alternative ? [{ label: "Benchmark", value: `${a.alternative.name} at $${a.alternative.unitPrice}/${a.unit}` }] : []),
      { label: "Cost reduction", value: `${a.reductionPct}%` },
    ],
    steps: best.lines.map((l) => (l.monthly === 0 ? l.label : `${l.label} — ${fmt(l.monthly)}/mo`)),
    dependencies: ["Platform team schedules workload placement", "Procurement raises PO for the reduced amount"],
  }
}

export interface SeedRequestInput extends Omit<ProcurementRequest, "analysis"> {}

const seedRequestInputs: SeedRequestInput[] = [
  {
    id: "PR-1036",
    title: "Audit log retention storage",
    department: "Security",
    category: "Storage",
    justification: "CBK requires 7-year retention of privileged-access logs.",
    capacity: 28,
    preferredVendor: "AWS S3",
    requestedMonthly: 644,
    submittedAt: "2026-11-04",
    requester: "Faith Wanjiru",
    status: "Approved (Optimized)",
  },
  {
    id: "PR-1041",
    title: "Fraud model feature store expansion",
    department: "Data & Risk",
    category: "Database",
    justification: "Real-time card fraud features for the new scoring model.",
    capacity: 20,
    preferredVendor: "AWS RDS",
    requestedMonthly: 1240,
    submittedAt: "2026-11-11",
    requester: "Brian Otieno",
    status: "Approved (Optimized)",
  },
  {
    id: "PR-1044",
    title: "Card switch DR load balancer",
    department: "Core Banking",
    category: "Cloud Compute",
    justification: "Second-site failover for the card switch, mandated by the DR policy.",
    capacity: 8,
    preferredVendor: "Azure",
    requestedMonthly: 368,
    submittedAt: "2026-11-15",
    requester: "Kevin Mwangi",
    status: "Approved (As requested)",
  },
  {
    id: "PR-1047",
    title: "APM for mobile banking gateway",
    department: "Digital Channels",
    category: "Observability",
    justification: "Trace latency on the M-Pesa and card top-up flows ahead of the December peak.",
    capacity: 30,
    preferredVendor: "New Relic",
    requestedMonthly: 1050,
    submittedAt: "2026-11-21",
    requester: "Achieng Odhiambo",
    status: "Pending review",
  },
  {
    id: "PR-1049",
    title: "Credit risk data lake expansion",
    department: "Data & Risk",
    category: "Storage",
    justification: "IFRS 9 model history for five more years of loan book data.",
    capacity: 40,
    preferredVendor: "AWS S3",
    requestedMonthly: 920,
    submittedAt: "2026-11-24",
    requester: "Brian Otieno",
    status: "In review",
  },
]

export const seedRequests: ProcurementRequest[] = seedRequestInputs.map((r) => ({
  ...r,
  analysis: analyzeRequest(r, seedResources, seedVendors, seedBudgets),
}))

export function buildRecommendations(resources: CloudResource[], vendors: Vendor[], requests: ProcurementRequest[]) {
  return [
    ...resources.map(resourceRecommendation),
    ...vendors.map(vendorRecommendation),
    ...requests.map(procurementRecommendation),
  ].filter((r): r is Recommendation => r !== null)
}
