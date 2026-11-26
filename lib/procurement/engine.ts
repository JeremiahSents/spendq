/**
 * Deterministic procurement decision engine.
 *
 * Given a purchase request and the live inventory, it works out how much of the
 * requirement existing assets can absorb (Reuse), prices the rest against the
 * catalog (Innovate), and checks the department budget. No randomness: the same
 * inputs always give the same plan, so every screen agrees.
 */
import type {
  BrandKey,
  CloudResource,
  Department,
  DepartmentBudget,
  ProcurementAnalysis,
  ProcurementOption,
  RequestCategory,
  Vendor,
} from "@/lib/data/types"

export interface CatalogOffer {
  name: string
  brand?: BrandKey
  unitPrice: number
  featureMatch: number
}

export const CATEGORY_UNITS: Record<RequestCategory, string> = {
  "Cloud Compute": "vCPU",
  Database: "vCPU",
  Storage: "TB",
  "SaaS Licenses": "seats",
  "AI API": "seats",
  Observability: "hosts",
}

/** Benchmark price book. The minimum feature match for a substitute is 90%. */
export const CATALOG: Record<RequestCategory, CatalogOffer[]> = {
  "Cloud Compute": [
    { name: "AWS EC2 m6i", brand: "AWS", unitPrice: 50, featureMatch: 100 },
    { name: "Azure Dsv5", brand: "Azure", unitPrice: 46, featureMatch: 98 },
    { name: "DigitalOcean Premium Droplets", brand: "DigitalOcean", unitPrice: 30, featureMatch: 96 },
  ],
  Database: [
    { name: "AWS RDS PostgreSQL", brand: "AWS", unitPrice: 62, featureMatch: 100 },
    { name: "Azure Database for PostgreSQL", brand: "Azure", unitPrice: 58, featureMatch: 98 },
    { name: "Neon Scale", brand: "Neon", unitPrice: 34, featureMatch: 94 },
  ],
  Storage: [
    { name: "AWS S3 Standard", brand: "AWS", unitPrice: 23, featureMatch: 100 },
    { name: "Azure Blob Hot", brand: "Azure", unitPrice: 21, featureMatch: 97 },
    { name: "DigitalOcean Spaces", brand: "DigitalOcean", unitPrice: 20, featureMatch: 85 },
  ],
  "SaaS Licenses": [
    { name: "Figma Organization", brand: "Figma", unitPrice: 45, featureMatch: 100 },
    { name: "GitHub Enterprise", brand: "GitHub", unitPrice: 21, featureMatch: 100 },
    { name: "Notion Business", brand: "Notion", unitPrice: 15, featureMatch: 100 },
    { name: "Confluence Standard", brand: "Confluence", unitPrice: 6.4, featureMatch: 90 },
  ],
  "AI API": [
    { name: "ChatGPT Enterprise", brand: "OpenAI", unitPrice: 60, featureMatch: 100 },
    { name: "Claude Team", brand: "Anthropic", unitPrice: 30, featureMatch: 92 },
  ],
  Observability: [
    { name: "New Relic Pro", brand: "New Relic", unitPrice: 35, featureMatch: 100 },
    { name: "Datadog Pro (existing contract rate)", brand: "Datadog", unitPrice: 23, featureMatch: 100 },
    { name: "Grafana Cloud Pro", brand: "Grafana", unitPrice: 19, featureMatch: 88 },
  ],
}

const VENDOR_CATEGORY: Partial<Record<RequestCategory, string[]>> = {
  "SaaS Licenses": ["Design", "Developer tools", "Documentation", "Collaboration"],
  "AI API": ["AI assistants"],
  Observability: ["Observability"],
}

export interface RequestInput {
  department: Department
  category: RequestCategory
  capacity: number
  preferredVendor: string
  requestedMonthly: number
}

const round = (n: number) => Math.round(n * 100) / 100

function brandFor(category: RequestCategory, vendorName: string): BrandKey | undefined {
  const lower = vendorName.toLowerCase()
  return CATALOG[category].find((o) => o.name.toLowerCase().includes(lower) || (o.brand && lower.includes(o.brand.toLowerCase())))?.brand
}

export function analyzeRequest(
  input: RequestInput,
  resources: CloudResource[],
  vendors: Vendor[],
  budgets: DepartmentBudget[],
): ProcurementAnalysis {
  const unit = CATEGORY_UNITS[input.category]
  const capacity = Math.max(1, input.capacity)
  const unitPrice = input.requestedMonthly / capacity
  const preferredBrand = brandFor(input.category, input.preferredVendor)

  // 1. Reuse: verified spare capacity in the live inventory.
  let reuse: ProcurementAnalysis["reuse"] = null
  if (input.category === "Cloud Compute") {
    const donor = resources
      .filter((r) => r.spare && r.spare.vcpu > 0)
      .sort((a, b) => (b.spare?.vcpu ?? 0) - (a.spare?.vcpu ?? 0))[0]
    if (donor?.spare) {
      const quantity = Math.min(donor.spare.vcpu, capacity)
      reuse = {
        resourceId: donor.id,
        source: `${donor.name} (${donor.provider} ${donor.type})`,
        brand: donor.provider,
        quantity,
        avoided: round(quantity * unitPrice),
      }
    }
  } else {
    const kinds = VENDOR_CATEGORY[input.category] ?? []
    const donor = vendors
      .filter((v) => kinds.includes(v.category) && v.purchased - v.active > 0)
      .filter((v) => !preferredBrand || v.brand === preferredBrand || input.category === "Observability")
      .sort((a, b) => b.purchased - b.active - (a.purchased - a.active))[0]
    if (donor) {
      const quantity = Math.min(donor.purchased - donor.active, capacity)
      reuse = {
        source: `${donor.name} — ${donor.purchased - donor.active} unused ${donor.unit}`,
        brand: donor.brand,
        quantity,
        avoided: round(quantity * unitPrice),
      }
    }
  }

  const remaining = capacity - (reuse?.quantity ?? 0)

  // 2. Innovate: cheapest catalog offer that still meets 90% of the features.
  const alternative =
    CATALOG[input.category]
      .filter((o) => o.featureMatch >= 90 && o.unitPrice < unitPrice && o.brand !== preferredBrand)
      .sort((a, b) => a.unitPrice - b.unitPrice)[0] ?? null

  const options: ProcurementOption[] = [
    {
      key: "as-requested",
      label: "Purchase as requested",
      description: `Buy ${capacity} ${unit} from ${input.preferredVendor}.`,
      monthly: round(input.requestedMonthly),
      requirements: `${capacity}/${capacity} ${unit} (100%)`,
      complexity: "Low",
      risk: "Low",
      recommended: false,
      lines: [{ label: `${capacity} ${unit} · ${input.preferredVendor}`, monthly: round(input.requestedMonthly), brand: preferredBrand }],
    },
  ]

  if (reuse && reuse.quantity > 0) {
    options.push({
      key: "reuse",
      label: remaining === 0 ? "Reuse existing resources" : "Reuse existing + buy the rest",
      description:
        remaining === 0
          ? `Existing assets cover all ${capacity} ${unit}.`
          : `Reallocate ${reuse.quantity} ${unit} already paid for, buy ${remaining} ${unit} from ${input.preferredVendor}.`,
      monthly: round(remaining * unitPrice),
      requirements: `${capacity}/${capacity} ${unit} (100%)`,
      complexity: "Low",
      risk: "Low",
      recommended: false,
      lines: [
        { label: `Reuse ${reuse.quantity} ${unit} · ${reuse.source}`, monthly: 0, brand: reuse.brand },
        ...(remaining > 0
          ? [{ label: `${remaining} ${unit} · ${input.preferredVendor}`, monthly: round(remaining * unitPrice), brand: preferredBrand }]
          : []),
      ],
    })
  }

  if (alternative && remaining > 0) {
    options.push({
      key: "optimized",
      label: reuse ? "Reuse existing + optimized alternative" : "Optimized alternative",
      description: reuse
        ? `Reallocate ${reuse.quantity} ${unit}, buy the remaining ${remaining} ${unit} on ${alternative.name}.`
        : `Buy ${remaining} ${unit} on ${alternative.name}.`,
      monthly: round(remaining * alternative.unitPrice),
      requirements: `${capacity}/${capacity} ${unit} (100%) · ${alternative.featureMatch}% feature match`,
      complexity: "Medium",
      risk: alternative.featureMatch >= 95 ? "Low" : "Medium",
      recommended: false,
      lines: [
        ...(reuse ? [{ label: `Reuse ${reuse.quantity} ${unit} · ${reuse.source}`, monthly: 0, brand: reuse.brand }] : []),
        { label: `${remaining} ${unit} · ${alternative.name}`, monthly: round(remaining * alternative.unitPrice), brand: alternative.brand },
      ],
    })
  }

  const best = [...options].sort((a, b) => a.monthly - b.monthly)[0]
  best.recommended = true
  const avoided = round(input.requestedMonthly - best.monthly)

  const budget = budgets.find((b) => b.department === input.department)
  const actual = departmentSpend(input.department, resources, vendors)
  const headroom = round((budget?.monthlyBudget ?? 0) - actual)

  return {
    unit,
    capacity,
    reuseChecked: true,
    unitPrice: round(unitPrice),
    reuse,
    alternative: alternative
      ? { name: alternative.name, brand: alternative.brand, unitPrice: alternative.unitPrice, featureMatch: alternative.featureMatch }
      : null,
    options,
    recommendedKey: best.key,
    avoided,
    reductionPct: input.requestedMonthly > 0 ? Math.round((avoided / input.requestedMonthly) * 100) : 0,
    budget: {
      department: input.department,
      budget: budget?.monthlyBudget ?? 0,
      actual,
      headroom,
      fits: headroom >= best.monthly,
    },
    steps: [
      `Parsed ${capacity} ${unit} at $${round(unitPrice)}/${unit} ($${input.requestedMonthly}/month)`,
      reuse
        ? `Matched ${reuse.quantity} ${unit} of spare capacity on ${reuse.source}`
        : "No reusable spare capacity found in inventory",
      alternative
        ? `Benchmarked ${CATALOG[input.category].length} offers; ${alternative.name} meets ${alternative.featureMatch}% of requirements at $${alternative.unitPrice}/${unit}`
        : "Preferred vendor is already the lowest-cost qualifying offer",
      `${input.department} budget headroom: $${Math.round(headroom).toLocaleString("en-US")}/month`,
    ],
  }
}

export function departmentSpend(department: Department, resources: CloudResource[], vendors: Vendor[]) {
  return (
    resources.filter((r) => r.department === department).reduce((s, r) => s + r.monthlyCost, 0) +
    vendors.filter((v) => v.department === department).reduce((s, v) => s + v.unitPrice * v.purchased, 0)
  )
}
