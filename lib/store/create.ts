/**
 * Builders for data created live in the demo ("Add cloud resource", "Add
 * vendor contract"). Each new item is run through the same deterministic rules
 * the seed data was flagged with, so a recommendation appears the moment it is
 * saved and every KPI, chart and Copilot answer picks it up.
 */
import { utilisation, vendorHistory } from "@/lib/data/seed"
import type { CloudProvider, CloudResource, Department, Environment, RecCategory, Risk, Vendor } from "@/lib/data/types"

export interface NewResourceInput {
  name: string
  provider: CloudProvider
  type: string
  environment: Environment
  region: string
  size: string
  department: Department
  vcpu: number
  memoryGb: number
  /** Average utilization over 30 days, 0–100. Null for storage/platform services. */
  cpu: number | null
  memory: number | null
  monthlyCost: number
}

export interface NewVendorInput {
  name: string
  brand: Vendor["brand"]
  category: string
  plan: string
  department: Department
  unit: "seats" | "hosts"
  unitPrice: number
  purchased: number
  active: number
  termMonths: number
  startDate: string
  renewalDate: string
  autoRenew: boolean
  noticeDays: number
  owner: string
}

/** The right-sizing rules, in priority order. Thresholds are on 30-day averages. */
export const RESOURCE_RULES = [
  { test: "CPU < 5% and memory < 10%", category: "Idle infrastructure", keep: 0, config: "Snapshot and terminate" },
  { test: "Non-production with CPU < 30%", category: "Dev scheduling", keep: 0.35, config: "Run 08:00–18:00 on weekdays only" },
  { test: "CPU < 25% and memory < 40%", category: "Overprovisioned", keep: 0.5, config: "Halve the instance size" },
] as const

function classifyResource(input: NewResourceInput): {
  category?: RecCategory
  recommendedCost: number
  recommendedConfig?: string
  analysis?: string
  risk: Risk
} {
  const { cpu, memory, environment, monthlyCost } = input
  if (cpu === null || memory === null) return { recommendedCost: monthlyCost, risk: "Low" }
  const nonProd = environment !== "Production"
  const pick =
    cpu < 5 && memory < 10
      ? RESOURCE_RULES[0]
      : nonProd && cpu < 30
        ? RESOURCE_RULES[1]
        : cpu < 25 && memory < 40
          ? RESOURCE_RULES[2]
          : null
  if (!pick) return { recommendedCost: monthlyCost, risk: "Low" }
  return {
    category: pick.category,
    recommendedCost: Math.round(monthlyCost * pick.keep * 100) / 100,
    recommendedConfig: pick.config,
    analysis: `Flagged by the rule "${pick.test}": average CPU ${cpu}% and memory ${memory}% over 30 days.`,
    risk: environment === "Production" ? "Medium" : "Low",
  }
}

export function buildResource(input: NewResourceInput, seq: number): CloudResource {
  const flags = classifyResource(input)
  return {
    ...input,
    id: `res-demo-${seq}`,
    ...flags,
    history: utilisation(seq + 40, input.cpu, input.memory),
    createdInDemo: true,
  }
}

/** License rule: below 80% of seats active → reclaim the unused ones. */
export function buildVendor(input: NewVendorInput, seq: number): Vendor {
  const unused = Math.max(0, input.purchased - input.active)
  const utilization = input.purchased > 0 ? input.active / input.purchased : 1
  const monthly = input.unitPrice * input.purchased
  return {
    ...input,
    id: `ven-demo-${seq}`,
    description: `${input.name} added in the demo for ${input.department}.`,
    history: vendorHistory(monthly, seq + 20),
    alternatives: [],
    createdInDemo: true,
    recommendation:
      utilization < 0.8 && unused > 0
        ? {
            category: "License reclaim",
            title: `Reclaim ${unused} unused ${input.name} ${input.unit}`,
            action: "Reassign unused licenses",
            recommendedMonthly: Math.round(input.active * input.unitPrice * 100) / 100,
            risk: "Low",
            detail: `${input.active} of ${input.purchased} ${input.unit} are active (${Math.round(utilization * 100)}%), below the 80% utilization rule.`,
          }
        : undefined,
  }
}
