"use client"

/**
 * The single source of truth for SpendIQ.
 *
 * Every KPI, chart, table, drawer and Copilot answer reads from this store, and
 * every Approve / Dismiss goes through its reducer, so the screens can never
 * disagree about a number.
 */
import * as React from "react"

import { backendRecommendations, backendVendors, type BackendSnapshot } from "@/lib/api/adapter"
import { fixtureSnapshot, loadBackendSnapshot } from "@/lib/api/backend-data"
import {
  seedAnomalies,
  seedBudgets,
  seedIntegrations,
  seedResources,
  seedSettings,
  seedVendors,
} from "@/lib/data/seed"
import type {
  Anomaly,
  CloudResource,
  DateRange,
  DepartmentBudget,
  Integration,
  ProcurementRequest,
  Recommendation,
  RecStatus,
  RequestCategory,
  Settings,
  Vendor,
  Department,
} from "@/lib/data/types"
import { moneyFormat, type Currency } from "@/lib/format"
import { analyzeRequest } from "@/lib/procurement/engine"
import { cloudDonor, evaluateProcurementOption, recommendedPlan } from "@/lib/procurement/policies"
import { buildRecommendations, procurementRecommendation, resourceRecommendation, seedRequests, vendorRecommendation } from "./build"
import { buildResource, buildVendor, type NewResourceInput, type NewVendorInput } from "./create"
import { scopeWorkspace } from "./selectors"

export const WORKSPACES = ["NCBA Tech & Cloud Ops", "Group Digital Banking", "All Subsidiaries"] as const
export type Workspace = (typeof WORKSPACES)[number]

/** A drawer any screen (or the Copilot) can open. */
export type DrawerTarget =
  | { kind: "recommendation"; id: string }
  | { kind: "resource"; id: string }
  | { kind: "vendor"; id: string }
  | { kind: "request"; id: string }
  | null

export interface SpendState {
  resources: CloudResource[]
  vendors: Vendor[]
  requests: ProcurementRequest[]
  recommendations: Recommendation[]
  budgets: DepartmentBudget[]
  anomalies: Anomaly[]
  integrations: Integration[]
  settings: Settings
  workspace: Workspace
  currency: Currency
  range: DateRange
  drawer: DrawerTarget
  copilotOpen: boolean
  blankMode: boolean
}

export type RequestDecision = "optimized" | "as-requested" | "review" | "reject"

export interface NewRequest {
  title: string
  department: Department
  category: RequestCategory
  justification: string
  capacity: number
  preferredVendor: string
  requestedMonthly: number
}

type Action =
  | { type: "setRecStatus"; id: string; status: RecStatus }
  | { type: "submitRequest"; request: ProcurementRequest }
  | { type: "decideRequest"; id: string; decision: RequestDecision }
  | { type: "restoreRequest"; request: ProcurementRequest }
  | { type: "refreshRequest"; id: string }
  | { type: "setCurrency"; currency: Currency }
  | { type: "setWorkspace"; workspace: Workspace }
  | { type: "setRange"; range: DateRange }
  | { type: "openDrawer"; target: DrawerTarget }
  | { type: "setCopilot"; open: boolean }
  | { type: "toggleIntegration"; id: string }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "hydrateBackend"; snapshot: BackendSnapshot }
  | { type: "restoreSaved"; saved: SavedDemo }
  | { type: "resetDemo"; snapshot?: BackendSnapshot | null }
  | { type: "clearWorkspace" }
  | { type: "addResource"; resource: CloudResource }
  | { type: "addVendor"; vendor: Vendor }

/** Seed vendors the backend owns the truth for; its contracts replace them. */
const BACKEND_OWNED = new Set(["ven-zoom", "ven-m365"])
const localVendors = seedVendors.filter((v) => !BACKEND_OWNED.has(v.id))

/** Swap in a backend snapshot: its vendors and findings replace the previous ones. */
function withBackend(state: Pick<SpendState, "vendors" | "recommendations">, snapshot: BackendSnapshot) {
  return {
    vendors: [...state.vendors.filter((v) => !v.id.startsWith("be-")), ...backendVendors(snapshot)],
    recommendations: [...state.recommendations.filter((r) => !r.actionId), ...backendRecommendations(snapshot)],
  }
}

function initialState(): SpendState {
  const base = {
    vendors: localVendors,
    recommendations: buildRecommendations(seedResources, localVendors, seedRequests),
  }
  return {
    resources: seedResources,
    requests: seedRequests,
    ...withBackend(base, fixtureSnapshot),
    budgets: seedBudgets,
    anomalies: seedAnomalies,
    integrations: seedIntegrations,
    settings: seedSettings,
    workspace: "NCBA Tech & Cloud Ops",
    currency: "USD",
    range: "30d",
    drawer: null,
    copilotOpen: false,
    blankMode: false,
  }
}

function blankState(state: SpendState): SpendState {
  return {
    ...state,
    resources: [],
    vendors: [],
    requests: [],
    recommendations: [],
    anomalies: [],
    drawer: null,
    blankMode: true,
  }
}

/**
 * What survives a refresh. The demo has no database: decisions, new purchase
 * requests and settings are kept in localStorage, and everything else is
 * rebuilt from the seed and backend fixtures. Bump the key when the shape changes.
 */
export const STORAGE_KEY = "spendiq-demo-v1"

export interface SavedDemo {
  blankMode?: boolean
  recStatus: Record<string, RecStatus>
  requests: ProcurementRequest[]
  settings: Settings
  integrations: Integration[]
  workspace: Workspace
  currency?: Currency
  range: DateRange
  createdResources?: CloudResource[]
  createdVendors?: Vendor[]
}

function toSaved(state: SpendState): SavedDemo {
  return {
    blankMode: state.blankMode,
    recStatus: Object.fromEntries(state.recommendations.map((r) => [r.id, r.status])),
    requests: state.requests,
    settings: state.settings,
    integrations: state.integrations,
    workspace: state.workspace,
    currency: state.currency,
    range: state.range,
    createdResources: state.resources.filter((r) => r.createdInDemo),
    createdVendors: state.vendors.filter((v) => v.createdInDemo),
  }
}

function applySaved(saved: SavedDemo): SpendState {
  // Rebuild from the seed so replaying the same save never subtracts a reservation twice.
  const baseline = initialState()
  let state = saved.blankMode ? blankState(baseline) : baseline
  for (const resource of saved.createdResources ?? []) state = reducer(state, { type: "addResource", resource })
  for (const vendor of saved.createdVendors ?? []) state = reducer(state, { type: "addVendor", vendor })
  const savedRequests = saved.blankMode ? (saved.requests ?? []) : saved.requests?.length ? saved.requests : state.requests
  const restoredRequests = new Map<string, ProcurementRequest>()
  for (const request of [...savedRequests].reverse()) {
    const resources = reserveCapacity(state.resources, request)
    if (resources) state = { ...state, resources }
    restoredRequests.set(request.id, resources ? request : { ...request, status: "Pending review" })
  }
  const requests = savedRequests.map((request) => restoredRequests.get(request.id)!)
  // Procurement recommendations follow their requests, including ones filed in the demo.
  const procurementRecs = requests
    .map((p) => procurementRecommendation(p))
    .filter((r): r is Recommendation => r !== null)
  const recommendations = [...procurementRecs, ...state.recommendations.filter((r) => r.source !== "procurement")].map(
    (r) => (r.source !== "procurement" && saved.recStatus?.[r.id] ? { ...r, status: saved.recStatus[r.id] } : r),
  )
  return {
    ...state,
    requests,
    recommendations,
    settings: { ...state.settings, ...saved.settings },
    integrations: saved.integrations?.length ? saved.integrations : state.integrations,
    workspace: saved.workspace ?? state.workspace,
    currency: saved.currency === "KES" ? "KES" : "USD",
    range: saved.range ?? state.range,
  }
}

const STATUS_FOR_DECISION: Record<RequestDecision, ProcurementRequest["status"]> = {
  optimized: "Approved (Optimized)",
  "as-requested": "Approved (As requested)",
  review: "In review",
  reject: "Rejected",
}

function syncProcurementRec(state: SpendState, request: ProcurementRequest): Recommendation[] {
  const rec = procurementRecommendation(request)
  const without = state.recommendations.filter((r) => r.id !== `rec-${request.id}`)
  return rec ? [rec, ...without] : without
}

function reserveCapacity(resources: CloudResource[], request: ProcurementRequest, release = false) {
  const reuse = request.analysis.reuse
  if (request.status !== "Approved (Optimized)" || request.category !== "Cloud Compute" || !reuse) return resources
  const donor = cloudDonor(resources, request)
  if (!donor?.spare || (!release && donor.spare.vcpu < reuse.quantity)) return release ? resources : null
  const spare = { ...donor.spare, vcpu: donor.spare.vcpu + (release ? reuse.quantity : -reuse.quantity) }
  return resources.map((resource) => resource.id === donor.id ? { ...resource, spare } : resource)
}

function updateRequest(state: SpendState, request: ProcurementRequest, enforcePolicy: boolean): SpendState {
  const previous = state.requests.find((item) => item.id === request.id)
  if (!previous) return state

  const released = reserveCapacity(state.resources, previous, true) ?? state.resources
  if (enforcePolicy && request.status.startsWith("Approved")) {
    const option = request.status === "Approved (Optimized)"
      ? recommendedPlan(request)
      : request.analysis.options.find((item) => item.key === "as-requested")!
    const evaluation = evaluateProcurementOption(state, previous, option)
    if (evaluation.blocked) return state
    request = { ...request, analysis: { ...request.analysis, budget: evaluation.budget } }
  }

  const resources = reserveCapacity(released, request)
  if (!resources) return state
  return {
    ...state,
    resources,
    requests: state.requests.map((item) => item.id === request.id ? request : item),
    recommendations: syncProcurementRec(state, request),
  }
}

function reducer(state: SpendState, action: Action): SpendState {
  switch (action.type) {
    case "setRecStatus": {
      const rec = state.recommendations.find((r) => r.id === action.id)
      if (!rec) return state
      if (rec.source === "procurement") {
        const request = state.requests.find((item) => item.id === rec.refId)
        if (!request) return state
        const status = action.status === "Approved" ? "Approved (Optimized)" : action.status === "Dismissed" ? "Rejected" : "Pending review"
        return updateRequest(state, { ...request, status }, true)
      }
      return {
        ...state,
        recommendations: state.recommendations.map((r) => (r.id === action.id ? { ...r, status: action.status } : r)),
      }
    }
    case "submitRequest": {
      const requests = [action.request, ...state.requests]
      return { ...state, requests, recommendations: syncProcurementRec(state, action.request) }
    }
    case "decideRequest": {
      const request = state.requests.find((item) => item.id === action.id)
      if (!request) return state
      return updateRequest(state, { ...request, status: STATUS_FOR_DECISION[action.decision] }, true)
    }
    case "restoreRequest":
      return updateRequest(state, action.request, false)
    case "refreshRequest": {
      const request = state.requests.find((item) => item.id === action.id)
      if (!request || request.status.startsWith("Approved") || request.status === "Rejected") return state
      const scoped = scopeWorkspace(state)
      return updateRequest(state, {
        ...request,
        analysis: analyzeRequest(request, scoped.resources, scoped.vendors, scoped.budgets),
      }, false)
    }
    case "setCurrency":
      return { ...state, currency: action.currency }
    case "setWorkspace":
      return { ...state, workspace: action.workspace }
    case "setRange":
      return { ...state, range: action.range }
    case "openDrawer":
      return { ...state, drawer: action.target }
    case "setCopilot":
      return { ...state, copilotOpen: action.open }
    case "toggleIntegration":
      return {
        ...state,
        integrations: state.integrations.map((i) =>
          i.id === action.id ? { ...i, connected: !i.connected, lastSync: i.connected ? "Disconnected" : "Just now" } : i,
        ),
      }
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case "hydrateBackend":
      return state.blankMode ? state : { ...state, ...withBackend(state, action.snapshot) }
    case "restoreSaved":
      return applySaved(action.saved)
    case "resetDemo": {
      const fresh = initialState()
      return action.snapshot ? { ...fresh, ...withBackend(fresh, action.snapshot) } : fresh
    }
    case "clearWorkspace":
      return blankState(state)
    case "addResource": {
      if (state.resources.some((r) => r.id === action.resource.id)) return state
      const rec = resourceRecommendation(action.resource)
      return {
        ...state,
        resources: [action.resource, ...state.resources],
        recommendations: rec ? [rec, ...state.recommendations] : state.recommendations,
      }
    }
    case "addVendor": {
      if (state.vendors.some((v) => v.id === action.vendor.id)) return state
      const rec = vendorRecommendation(action.vendor)
      return {
        ...state,
        vendors: [action.vendor, ...state.vendors],
        recommendations: rec ? [rec, ...state.recommendations] : state.recommendations,
      }
    }
  }
}

interface SpendContextValue {
  state: SpendState
  approveRecommendation: (id: string) => void
  dismissRecommendation: (id: string) => void
  resetRecommendation: (id: string) => void
  /** Runs the decision engine against live inventory and files the request. Returns its id. */
  submitRequest: (input: NewRequest) => string
  decideRequest: (id: string, decision: RequestDecision) => void
  restoreRequest: (request: ProcurementRequest) => void
  refreshRequest: (id: string) => void
  setCurrency: (currency: Currency) => void
  setWorkspace: (workspace: Workspace) => void
  setRange: (range: DateRange) => void
  openDrawer: (target: DrawerTarget) => void
  closeDrawer: () => void
  setCopilotOpen: (open: boolean) => void
  toggleIntegration: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  /** Clears saved demo state and returns every screen to the starting data. */
  resetDemo: () => void
  /** Removes all seeded resources, vendors, requests, recommendations, and anomalies to present from scratch. */
  clearWorkspace: () => void
  /** Adds a cloud resource, runs the right-sizing rules on it, and returns its id. */
  addResource: (input: NewResourceInput) => string
  /** Adds a vendor contract, runs the license rule on it, and returns its id. */
  addVendor: (input: NewVendorInput) => string
}

const SpendContext = React.createContext<SpendContextValue | null>(null)

export function SpendProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, undefined, initialState)
  const backendRef = React.useRef<BackendSnapshot | null>(null)

  // Restore the saved demo after mount (reading storage during render would
  // break hydration), then save on every change from then on.
  const initial = React.useRef(state)
  React.useLayoutEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) dispatch({ type: "restoreSaved", saved: JSON.parse(raw) as SavedDemo })
    } catch (error) {
      console.warn("Ignoring unreadable saved demo state.", error)
    }
  }, [])
  React.useLayoutEffect(() => {
    if (state === initial.current) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSaved(state)))
    } catch {
      // Storage full or blocked: the demo still works, it just won't survive a refresh.
    }
  }, [state])

  // With NEXT_PUBLIC_API_URL set, replace the fixture snapshot with live backend data.
  React.useEffect(() => {
    let cancelled = false
    loadBackendSnapshot()
      .then((snapshot) => {
        if (snapshot && !cancelled) {
          backendRef.current = snapshot
          dispatch({ type: "hydrateBackend", snapshot })
        }
      })
      .catch((error) => console.warn("SpendQ API unavailable, using exported fixtures.", error))
    return () => {
      cancelled = true
    }
  }, [])
  const visibleState = React.useMemo(() => scopeWorkspace(state), [state])
  const value = React.useMemo<SpendContextValue>(
    () => ({
      state: visibleState,
      approveRecommendation: (id) => dispatch({ type: "setRecStatus", id, status: "Approved" }),
      dismissRecommendation: (id) => dispatch({ type: "setRecStatus", id, status: "Dismissed" }),
      resetRecommendation: (id) => dispatch({ type: "setRecStatus", id, status: "Pending" }),
      submitRequest: (input: NewRequest) => {
        const s = state
        const next = Math.max(1049, ...s.requests.map((p) => Number(p.id.replace("PR-", "")) || 0)) + 1
        const id = `PR-${next}`
        const request: ProcurementRequest = {
          ...input,
          id,
          submittedAt: "2026-11-26",
          requester: "You",
          status: "Pending review",
          analysis: analyzeRequest(input, visibleState.resources, visibleState.vendors, visibleState.budgets),
        }
        dispatch({ type: "submitRequest", request })
        return id
      },
      decideRequest: (id, decision) => dispatch({ type: "decideRequest", id, decision }),
      restoreRequest: (request) => dispatch({ type: "restoreRequest", request }),
      refreshRequest: (id) => dispatch({ type: "refreshRequest", id }),
      setCurrency: (currency) => dispatch({ type: "setCurrency", currency }),
      setWorkspace: (workspace) => dispatch({ type: "setWorkspace", workspace }),
      setRange: (range) => dispatch({ type: "setRange", range }),
      openDrawer: (target) => dispatch({ type: "openDrawer", target }),
      closeDrawer: () => dispatch({ type: "openDrawer", target: null }),
      setCopilotOpen: (open) => dispatch({ type: "setCopilot", open }),
      toggleIntegration: (id) => dispatch({ type: "toggleIntegration", id }),
      updateSettings: (patch) => dispatch({ type: "updateSettings", patch }),
      addResource: (input) => {
        const resource = buildResource(input, nextSeq(state.resources.map((r) => r.id), "res-demo-"))
        dispatch({ type: "addResource", resource })
        return resource.id
      },
      addVendor: (input) => {
        const vendor = buildVendor(input, nextSeq(state.vendors.map((v) => v.id), "ven-demo-"))
        dispatch({ type: "addVendor", vendor })
        return vendor.id
      },
      resetDemo: () => {
        dispatch({ type: "resetDemo", snapshot: backendRef.current })
      },
      clearWorkspace: () => {
        dispatch({ type: "clearWorkspace" })
      },
    }),
    [state, visibleState],
  )

  return <SpendContext.Provider value={value}>{children}</SpendContext.Provider>
}

function nextSeq(ids: string[], prefix: string) {
  return Math.max(0, ...ids.filter((id) => id.startsWith(prefix)).map((id) => Number(id.slice(prefix.length)) || 0)) + 1
}

export function useSpend() {
  const ctx = React.useContext(SpendContext)
  if (!ctx) throw new Error("useSpend must be used inside <SpendProvider>")
  return ctx
}

export function useMoney() {
  const { state } = useSpend()
  const { currency } = state
  return React.useMemo(() => moneyFormat(currency), [currency])
}
