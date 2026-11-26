/**
 * Deterministic Copilot answers. Every figure is computed from the live store
 * state at the moment a question is asked, through the shared selectors, so the
 * Copilot always agrees with the dashboard.
 */
import { oneTimeAmount, savingKind } from "@/components/recommendations/filters"
import type { BrandKey, RecCategory, RecStatus } from "@/lib/data/types"
import { money, pct, perMonth, perYear } from "@/lib/format"
import {
  licenseUtilization,
  potentialBySource,
  procurementSummary,
  recSavings,
  recommendationFor,
  savings,
  sum,
  topOpportunities,
  unusedUnits,
  vendorMonthly,
} from "@/lib/store/selectors"
import type { DrawerTarget, SpendState } from "@/lib/store/spend-store"

export type Intent = "waste" | "aws" | "seats" | "procurement" | "alternatives" | "annual" | "billing"

export type AnswerTarget = { type: "drawer"; drawer: NonNullable<DrawerTarget> } | { type: "link"; href: string }

export interface AnswerItem {
  key: string
  brand: BrandKey | "SpendIQ"
  name: string
  detail?: string
  figure: string
  /** Secondary line under the figure, e.g. annualised. */
  subFigure?: string
  target: AnswerTarget
}

export interface Answer {
  headline: string
  items: AnswerItem[]
  actions: { label: string; href: string }[]
  /** Shown for the fallback: clickable example questions. */
  suggestions?: string[]
}

export const QUICK_PROMPTS: { intent: Intent; prompt: string }[] = [
  { intent: "waste", prompt: "Where are we wasting the most money right now?" },
  { intent: "aws", prompt: "How can we cut our AWS bill this month?" },
  { intent: "seats", prompt: "Which software subscriptions have unused seats?" },
  { intent: "procurement", prompt: "Do we need to buy new infrastructure for pending requests?" },
  { intent: "alternatives", prompt: "Which vendors have cheaper alternatives?" },
  { intent: "annual", prompt: "How much could we save this year if we approve all pending actions?" },
]

const RULES: { intent: Intent; pattern: RegExp }[] = [
  // Before "seats": "duplicate subscription" must not route to unused seats.
  { intent: "billing", pattern: /overbill|overcharg|invoice|duplicate|double.?bill|billed twice|contract|credit note|refund/ },
  { intent: "alternatives", pattern: /alternative|cheaper|switch|replace|competitor/ },
  { intent: "seats", pattern: /seat|licen[cs]e|unused|subscription|saas|inactive/ },
  { intent: "aws", pattern: /\baws\b|amazon|ec2|\brds\b|\bs3\b/ },
  { intent: "procurement", pattern: /\bbuy|purchas|infrastructure|request|procure|capacity/ },
  { intent: "annual", pattern: /year|annual|approve all|all pending|12 months/ },
  { intent: "waste", pattern: /wast|idle|most money|overspend|overprovision|biggest|top/ },
  { intent: "alternatives", pattern: /vendor/ },
  { intent: "annual", pattern: /sav(e|ing)/ },
]

export function routeIntent(text: string): Intent | null {
  const q = text.toLowerCase()
  const exact = QUICK_PROMPTS.find((p) => p.prompt.toLowerCase() === q.trim())
  if (exact) return exact.intent
  return RULES.find((r) => r.pattern.test(q))?.intent ?? null
}

const recTarget = (id: string): AnswerTarget => ({ type: "drawer", drawer: { kind: "recommendation", id } })

function waste(s: SpendState): Answer {
  const top = topOpportunities(s, 5)
  const sv = savings(s)
  if (top.length === 0) {
    return {
      headline: "There is no pending waste left in the queue. Every recommendation has been approved or dismissed.",
      items: [],
      actions: [{ label: "Open Recommendations", href: "/recommendations" }],
    }
  }
  return {
    headline: `${perMonth(sv.potentialMonthly)} is leaking across ${sv.pendingCount} pending actions. The biggest single item is ${top[0].title} at ${perMonth(recSavings(top[0]))}.`,
    items: top.map((r) => ({
      key: r.id,
      brand: r.brand,
      name: r.title,
      detail: `${r.category} · ${r.department}`,
      figure: perMonth(recSavings(r)),
      subFigure: perYear(recSavings(r) * 12),
      target: recTarget(r.id),
    })),
    actions: [
      { label: "Open Recommendations", href: "/recommendations" },
      { label: "Open Overview", href: "/" },
    ],
  }
}

function aws(s: SpendState): Answer {
  const bill = sum(
    s.resources.filter((r) => r.provider === "AWS"),
    (r) => r.monthlyCost,
  )
  const recs = s.recommendations
    .filter((r) => r.source === "cloud" && r.brand === "AWS" && r.status === "Pending")
    .sort((a, b) => recSavings(b) - recSavings(a))
  const total = sum(recs, recSavings)
  const approved = sum(
    s.recommendations.filter((r) => r.source === "cloud" && r.brand === "AWS" && r.status === "Approved"),
    recSavings,
  )
  if (recs.length === 0) {
    return {
      headline: `No AWS actions are pending against the ${perMonth(bill)} AWS bill.${approved > 0 ? ` ${perMonth(approved)} of AWS savings is already approved.` : ""}`,
      items: [],
      actions: [{ label: "Open Cloud", href: "/cloud" }],
    }
  }
  return {
    headline: `You can cut ${perMonth(total)} (${pct(bill > 0 ? (total / bill) * 100 : 0)}) from the ${perMonth(bill)} AWS bill with ${recs.length} pending action${recs.length === 1 ? "" : "s"}.${approved > 0 ? ` ${perMonth(approved)} is already approved.` : ""}`,
    items: recs.slice(0, 5).map((r) => ({
      key: r.id,
      brand: r.brand,
      name: r.title,
      detail: `${money(r.currentMonthly)} → ${money(r.recommendedMonthly)} · ${r.risk} risk`,
      figure: perMonth(recSavings(r)),
      target: recTarget(r.id),
    })),
    actions: [
      { label: "Open Cloud", href: "/cloud" },
      { label: "Open Recommendations", href: "/recommendations" },
    ],
  }
}

function seats(s: SpendState): Answer {
  const rows = s.vendors
    .filter((v) => unusedUnits(v) > 0)
    .map((v) => ({ v, unused: unusedUnits(v), waste: unusedUnits(v) * v.unitPrice }))
    .sort((a, b) => b.waste - a.waste)
  // Top five by cost, plus every contract the SpendQ engine flagged (Zoom's 204 idle seats).
  const shown = rows.filter((r, i) => i < 5 || r.v.id.startsWith("be-"))
  if (rows.length === 0) {
    return {
      headline: "Every subscription is fully assigned. No unused seats right now.",
      items: [],
      actions: [{ label: "Open Vendors", href: "/vendors" }],
    }
  }
  const total = sum(rows, (r) => r.waste)
  const units = sum(rows, (r) => r.unused)
  return {
    headline: `${rows.length} subscriptions carry ${units.toLocaleString("en-US")} unused seats or hosts, costing ${perMonth(total)} (${perYear(total * 12)}).`,
    items: shown.map(({ v, unused, waste }) => {
      const rec = recommendationFor(s, v.id)
      const action = rec ? ` · action ${rec.status.toLowerCase()}` : ""
      return {
        key: v.id,
        brand: v.brand,
        name: v.name,
        detail: `${unused} of ${v.purchased} ${v.unit} unused · ${licenseUtilization(v)}% utilized${action}`,
        figure: perMonth(waste),
        target: { type: "drawer", drawer: { kind: "vendor", id: v.id } },
      }
    }),
    actions: [
      { label: "Open Vendors", href: "/vendors" },
      { label: "Open Recommendations", href: "/recommendations" },
    ],
  }
}

function procurement(s: SpendState): Answer {
  const pending = s.requests.filter((p) => p.status === "Pending review" || p.status === "In review")
  const summary = procurementSummary(s)
  if (pending.length === 0) {
    return {
      headline: `No requests are waiting for review. Approved optimizations already avoid ${perMonth(summary.avoided)} of new spend.`,
      items: [],
      actions: [{ label: "Open Procurement", href: "/procurement" }],
    }
  }
  const requested = sum(pending, (p) => p.requestedMonthly)
  const avoided = sum(pending, (p) => p.analysis.avoided)
  const withReuse = pending.filter((p) => p.analysis.reuse)
  return {
    headline:
      withReuse.length > 0
        ? `Not all of it. ${withReuse.length} of ${pending.length} pending requests can reuse existing capacity, and the optimized plans avoid ${perMonth(avoided)} of the ${perMonth(requested)} requested.`
        : `${pending.length} pending requests ask for ${perMonth(requested)}. No spare capacity matches, but cheaper options avoid ${perMonth(avoided)}.`,
    items: pending.map((p) => {
      const a = p.analysis
      const detail = a.reuse
        ? `Reuse ${a.reuse.quantity} ${a.unit} from ${a.reuse.source}`
        : a.alternative
          ? `No spare capacity · ${a.alternative.name} benchmark`
          : "No reuse found · buy as requested"
      return {
        key: p.id,
        brand: a.reuse?.brand ?? a.alternative?.brand ?? "SpendIQ",
        name: `${p.id} · ${p.title}`,
        detail: `${detail} · ${p.status}`,
        figure: a.avoided > 0 ? `${perMonth(a.avoided)} avoided` : perMonth(p.requestedMonthly),
        subFigure: a.avoided > 0 ? `${a.reductionPct}% less than requested` : "no savings found",
        target: { type: "drawer", drawer: { kind: "request", id: p.id } },
      }
    }),
    actions: [{ label: "Open Procurement", href: "/procurement" }],
  }
}

function alternatives(s: SpendState): Answer {
  const rows = s.vendors
    .map((v) => {
      const current = vendorMonthly(v)
      const best = v.alternatives
        .filter((a) => a.monthly < current && a.featureMatch >= 85)
        .sort((a, b) => a.monthly - b.monthly)[0]
      return best ? { v, best, current, saving: current - best.monthly } : null
    })
    .filter((r) => r !== null)
    .sort((a, b) => b.saving - a.saving)
  if (rows.length === 0) {
    return {
      headline: "No vendor has a cheaper alternative with at least an 85% feature match right now.",
      items: [],
      actions: [{ label: "Open Vendors", href: "/vendors" }],
    }
  }
  const total = sum(rows, (r) => r.saving)
  return {
    headline: `${rows.length} vendor${rows.length === 1 ? " has" : "s have"} a cheaper alternative with 85%+ feature match, worth up to ${perMonth(total)} combined.`,
    items: rows.slice(0, 5).map(({ v, best, saving }) => ({
      key: v.id,
      brand: v.brand,
      name: `${v.name} → ${best.name}`,
      detail: `${best.featureMatch}% feature match · ${best.migrationEffort} migration effort`,
      figure: perMonth(saving),
      subFigure: perYear(saving * 12),
      target: { type: "drawer", drawer: { kind: "vendor", id: v.id } },
    })),
    actions: [{ label: "Open Vendors", href: "/vendors" }],
  }
}

function annual(s: SpendState): Answer {
  const sv = savings(s)
  const total = (sv.approvedMonthly + sv.potentialMonthly) * 12
  const sources = [
    { key: "cloud", label: "Cloud optimization", href: "/cloud" },
    { key: "vendor", label: "Vendor and SaaS", href: "/vendors" },
    { key: "procurement", label: "Procurement avoidance", href: "/procurement" },
  ] as const
  const bySource = sources
    .map((src) => ({ ...src, monthly: potentialBySource(s, src.key) }))
    .filter((src) => src.monthly > 0)
  return {
    headline: `${perYear(total)} in projected savings this year: ${perYear(sv.approvedAnnual)} already approved plus ${perYear(sv.potentialAnnual)} if you approve the ${sv.pendingCount} pending actions.`,
    items: [
      {
        key: "approved",
        brand: "SpendIQ",
        name: "Already approved",
        detail: `${sv.approvedCount} approved actions · projected, not yet realized`,
        figure: perYear(sv.approvedAnnual),
        subFigure: perMonth(sv.approvedMonthly),
        target: { type: "link", href: "/recommendations" },
      },
      ...bySource.map((src) => ({
        key: src.key,
        brand: "SpendIQ" as const,
        name: `Pending · ${src.label}`,
        detail: `${s.recommendations.filter((r) => r.source === src.key && r.status === "Pending").length} actions awaiting approval`,
        figure: perYear(src.monthly * 12),
        subFigure: perMonth(src.monthly),
        target: { type: "link" as const, href: src.href },
      })),
    ],
    actions: [{ label: "Open Recommendations", href: "/recommendations" }],
  }
}

const BILLING_CATEGORIES: RecCategory[] = ["Overbilling", "Duplicate invoice", "Duplicate subscription"]
const STATUS_ORDER: Record<RecStatus, number> = { Pending: 0, Approved: 1, Dismissed: 2 }

/** Contract and invoice errors the SpendQ engine found: overbilling, double-billing, duplicate contracts. */
function billing(s: SpendState): Answer {
  const recs = s.recommendations
    .filter((r) => BILLING_CATEGORIES.includes(r.category))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || recSavings(b) - recSavings(a))
  if (recs.length === 0) {
    return {
      headline: "No overbilling, duplicate invoices or duplicate subscriptions have been found against your contracts.",
      items: [],
      actions: [{ label: "Open Recommendations", href: "/recommendations" }],
    }
  }
  const open = recs.filter((r) => r.status === "Pending")
  const oneTime = sum(open.filter((r) => savingKind(r) === "one-time"), oneTimeAmount)
  const recurring = sum(open.filter((r) => savingKind(r) !== "one-time"), recSavings)
  const parts = [
    oneTime > 0 ? `${money(oneTime)} recoverable as one-time credits or refunds` : null,
    recurring > 0 ? `${perYear(recurring * 12)} from merging duplicate contracts` : null,
  ].filter(Boolean)
  return {
    headline:
      open.length > 0
        ? `The SpendQ engine found ${recs.length} contract and invoice issue${recs.length === 1 ? "" : "s"}, ${open.length} still open${parts.length > 0 ? `: ${parts.join(", plus ")}` : ""}.`
        : `All ${recs.length} contract and invoice issues the SpendQ engine found have been decided.`,
    items: recs.map((r) => {
      const oneOff = savingKind(r) === "one-time"
      const status = r.status === "Pending" ? "open" : r.status.toLowerCase()
      return {
        key: r.id,
        brand: r.brand,
        name: r.title,
        detail: `${r.category} · ${r.department} · ${status}`,
        figure: oneOff ? `${money(oneTimeAmount(r))} one-time` : perYear(recSavings(r) * 12),
        subFigure: oneOff ? "credit or refund" : perMonth(recSavings(r)),
        target: recTarget(r.id),
      }
    }),
    actions: [{ label: "Open Recommendations", href: "/recommendations" }],
  }
}

const HANDLERS: Record<Intent, (s: SpendState) => Answer> = {
  waste,
  aws,
  seats,
  procurement,
  alternatives,
  annual,
  billing,
}

export function answer(intent: Intent | null, s: SpendState): Answer {
  if (intent) return HANDLERS[intent](s)
  return {
    headline:
      "I can answer questions about waste, your AWS bill, unused seats, overbilling and duplicate invoices, pending procurement requests, cheaper vendors and this year's savings. Try one of these:",
    items: [],
    actions: [],
    suggestions: QUICK_PROMPTS.map((p) => p.prompt),
  }
}
