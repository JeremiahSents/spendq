/**
 * Adapter from the SpendQ backend (FastAPI, KES) to the SpendIQ store (USD).
 *
 * The backend's contracts become vendors and its findings + proposed actions
 * become recommendations, so every screen, selector and Copilot answer keeps
 * working unchanged. Money is converted at the backend's own demo rate
 * (`summary.usd_to_kes`). Works on the mock fixtures in ./mock and on live
 * API responses alike.
 */
import type { BrandKey, Department, Pillar, RecCategory, RecStatus, Recommendation, Risk, Vendor } from "@/lib/data/types"
import { MONTHS, VENDOR_TREND } from "@/lib/data/seed"
import type { Action, Contract, Finding, FindingType } from "./types"

export interface BackendSnapshot {
  usdToKes: number
  contracts: Contract[]
  findings: Finding[]
  actions: Action[]
}

/** Backend departments folded into the five SpendIQ departments. */
const DEPARTMENT_MAP: Record<string, Department> = {
  IT: "Cloud Platform",
  "IT (Uganda)": "Cloud Platform",
  "IT (Tanzania)": "Cloud Platform",
  "Digital Banking": "Digital Channels",
  Marketing: "Digital Channels",
  "Corporate Banking": "Core Banking",
  "Retail Banking": "Core Banking",
  Finance: "Data & Risk",
  "Legal & Compliance": "Security",
  "Admin & Facilities": "Security",
}

export const toDepartment = (name?: string | null): Department => DEPARTMENT_MAP[name ?? ""] ?? "Cloud Platform"

function brandFor(vendorName: string, contractTitle = ""): BrandKey | "SpendIQ" {
  const n = `${vendorName} ${contractTitle}`.toLowerCase()
  if (n.includes("zoom")) return "Zoom"
  if (n.includes("microsoft 365") || n.includes("m365")) return "Microsoft 365"
  if (n.includes("azure")) return "Azure"
  if (n.includes("microsoft")) return "Microsoft 365"
  if (n.includes("atlassian") || n.includes("jira")) return "Jira"
  if (n.includes("salesforce")) return "Salesforce"
  if (n.includes("liquid")) return "Liquid"
  if (n.includes("amazon") || n.includes("aws")) return "AWS"
  if (n.includes("datadog")) return "Datadog"
  return "SpendIQ"
}

const FINDING_CATEGORY: Record<FindingType, RecCategory> = {
  unused_licence: "License reclaim",
  vendor_overlap: "Consolidation",
  duplicate_subscription: "Duplicate subscription",
  overbilling: "Overbilling",
  duplicate_invoice: "Duplicate invoice",
  anomaly: "Spend anomaly",
  renewal_due: "Renewal notice",
}

const FINDING_PILLAR: Record<FindingType, Pillar> = {
  unused_licence: "Reuse",
  vendor_overlap: "Eliminate",
  duplicate_subscription: "Eliminate",
  overbilling: "Automate",
  duplicate_invoice: "Automate",
  anomaly: "Automate",
  renewal_due: "Innovate",
}

const ACTION_STATUS: Record<Action["status"], RecStatus> = {
  proposed: "Pending",
  approved: "Approved",
  done: "Approved",
  rejected: "Dismissed",
}

export const vendorIdForContract = (contractId: string) => `be-${contractId}`

const round2 = (n: number) => Math.round(n * 100) / 100

/** Contracts any finding points at, as SpendIQ vendors. */
export function backendVendors(snap: BackendSnapshot): Vendor[] {
  const referenced = new Set(snap.findings.flatMap((f) => f.contract_ids))
  const unused = new Map(
    snap.findings
      .filter((f) => f.type === "unused_licence")
      .map((f) => [f.contract_ids[0], f.evidence as { seats_paid?: number; seats_active_90d?: number }]),
  )

  return snap.contracts
    .filter((c) => referenced.has(c.id))
    .map((c): Vendor => {
      const monthly = c.annual_value_kes / snap.usdToKes / 12
      const evidence = unused.get(c.id)
      const purchased = evidence?.seats_paid ?? Math.max(1, c.quantity)
      const active = evidence?.seats_active_90d ?? purchased
      const primary = snap.findings.find((f) => f.contract_ids[0] === c.id && f.est_saving_kes > 0)
        ?? snap.findings.find((f) => f.contract_ids[0] === c.id)
      const action = primary ? snap.actions.find((a) => a.finding_id === primary.id) : undefined
      const saving = primary ? savingMonthly(primary, snap.usdToKes) : 0
      return {
        id: vendorIdForContract(c.id),
        name: c.title,
        brand: brandFor(c.vendor_name, c.title) as Vendor["brand"],
        category: c.service_category.replace(/_/g, " "),
        plan: `${c.vendor_name} · ${c.billing_cycle}`,
        department: toDepartment(c.department_name),
        unit: c.unit.startsWith("host") ? "hosts" : "seats",
        unitPrice: round2(monthly / purchased),
        purchased,
        active,
        termMonths: monthsBetween(c.start_date, c.end_date),
        startDate: c.start_date,
        renewalDate: c.end_date,
        autoRenew: c.auto_renew,
        noticeDays: c.notice_days,
        owner: `${c.department_name} budget owner`,
        description: `Backend contract ${c.id}: ${c.quantity} × ${c.currency} ${c.unit_price} per ${c.unit}. Notice deadline ${c.notice_deadline}.`,
        history: MONTHS.map((month, i) => ({ month, spend: Math.round(monthly * VENDOR_TREND[i]) })),
        alternatives: [],
        recommendation:
          primary && action
            ? {
                category: FINDING_CATEGORY[primary.type],
                title: primary.title,
                action: action.description,
                recommendedMonthly: round2(Math.max(0, monthly - saving)),
                risk: action.approval_tier === "cfo" ? "Medium" : "Low",
                detail: primary.explanation,
              }
            : undefined,
      }
    })
}

/** Findings with their proposed action, as SpendIQ recommendations. */
export function backendRecommendations(snap: BackendSnapshot): Recommendation[] {
  return snap.findings.flatMap((f): Recommendation[] => {
    const action = snap.actions.find((a) => a.finding_id === f.id)
    if (!action) return []
    const contract = snap.contracts.find((c) => c.id === f.contract_ids[0])
    const saving = savingMonthly(f, snap.usdToKes)
    const current = contract ? contract.annual_value_kes / snap.usdToKes / 12 : saving
    const risk: Risk = action.approval_tier === "cfo" ? "Medium" : "Low"
    const kes = (amount: number) => "KES " + amount.toLocaleString("en-US", { maximumFractionDigits: 2 })
    return [
      {
        id: `rec-${action.id}`,
        actionId: action.id,
        source: "vendor",
        refId: vendorIdForContract(f.contract_ids[0]),
        brand: brandFor(f.vendor_names[0] ?? "", contract?.title),
        title: f.title,
        pillar: FINDING_PILLAR[f.type],
        category: FINDING_CATEGORY[f.type],
        department: toDepartment(f.department_name),
        currentMonthly: round2(Math.max(current, saving)),
        recommendedMonthly: round2(Math.max(current, saving) - saving),
        risk,
        status: ACTION_STATUS[action.status],
        problem: f.explanation,
        evidence: [
          { label: "Finding", value: `${f.id} · ${f.type.replace(/_/g, " ")}` },
          { label: "Amount at issue", value: kes(f.amount_at_issue_kes) },
          {
            label: "Estimated saving",
            value:
              f.saving_basis === "one_time"
                ? `${kes(f.est_saving_kes)} one-time recovery`
                : f.saving_basis === "annual"
                  ? `${kes(f.est_saving_kes)}/yr`
                  : "To investigate",
          },
          { label: "Confidence", value: `${Math.round(f.confidence * 100)}%` },
          { label: "Approval", value: action.approval_tier === "cfo" ? "CFO (above KES threshold)" : "Manager" },
          ...Object.entries(f.evidence as Record<string, unknown>)
            .filter(([, v]) => typeof v === "number" || typeof v === "string")
            .slice(0, 4)
            .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: String(v) })),
        ],
        steps: [action.description, ...(action.draft ? ["Agent drafted a brief — review it before sending"] : [])],
        dependencies: [
          action.approval_tier === "cfo" ? "CFO sign-off (above the bank's KES threshold)" : "Department manager sign-off",
          "Source: SpendQ detection engine",
        ],
      },
    ]
  })
}

/**
 * Monthly USD figure for a finding's saving. Annual savings are spread over 12
 * months; one-time recoveries are shown as a single month's credit spread the
 * same way, and the evidence labels them "one-time".
 */
function savingMonthly(f: Finding, usdToKes: number) {
  if (f.saving_basis === "none") return 0
  return round2(f.est_saving_kes / usdToKes / 12)
}

function monthsBetween(start: string, end: string) {
  const a = new Date(start)
  const b = new Date(end)
  return Math.max(1, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth())
}
