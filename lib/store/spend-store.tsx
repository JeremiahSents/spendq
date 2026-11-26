"use client"

/**
 * The single source of truth for SpendIQ.
 *
 * Every KPI, chart, table, drawer and Copilot answer reads from this store, and
 * every Approve / Dismiss goes through its reducer, so the screens can never
 * disagree about a number.
 */
import * as React from "react"

import { analyzeRequest, type RequestInput } from "@/lib/procurement/engine"
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
import { buildRecommendations, procurementRecommendation, seedRequests } from "./build"

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
  range: DateRange
  drawer: DrawerTarget
  copilotOpen: boolean
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
  | { type: "setWorkspace"; workspace: Workspace }
  | { type: "setRange"; range: DateRange }
  | { type: "openDrawer"; target: DrawerTarget }
  | { type: "setCopilot"; open: boolean }
  | { type: "toggleIntegration"; id: string }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "hydrateBackend"; snapshot: BackendSnapshot }

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
    range: "30d",
    drawer: null,
    copilotOpen: false,
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

function reducer(state: SpendState, action: Action): SpendState {
  switch (action.type) {
    case "setRecStatus": {
      const rec = state.recommendations.find((r) => r.id === action.id)
      if (!rec) return state
      let requests = state.requests
      // A procurement recommendation and its request are one decision.
      if (rec.source === "procurement") {
        requests = state.requests.map((p) =>
          p.id !== rec.refId
            ? p
            : {
                ...p,
                status:
                  action.status === "Approved"
                    ? "Approved (Optimized)"
                    : action.status === "Dismissed"
                      ? "Rejected"
                      : "Pending review",
              },
        )
      }
      return {
        ...state,
        requests,
        recommendations: state.recommendations.map((r) => (r.id === action.id ? { ...r, status: action.status } : r)),
      }
    }
    case "submitRequest": {
      const requests = [action.request, ...state.requests]
      return { ...state, requests, recommendations: syncProcurementRec(state, action.request) }
    }
    case "decideRequest": {
      const request = state.requests.find((p) => p.id === action.id)
      if (!request) return state
      const updated = { ...request, status: STATUS_FOR_DECISION[action.decision] }
      return {
        ...state,
        requests: state.requests.map((p) => (p.id === action.id ? updated : p)),
        recommendations: state.recommendations.map((r) =>
          r.id === `rec-${action.id}` ? (procurementRecommendation(updated) ?? r) : r,
        ),
      }
    }
    case "restoreRequest":
      return {
        ...state,
        requests: state.requests.map((p) => (p.id === action.request.id ? action.request : p)),
        recommendations: state.recommendations.map((r) =>
          r.id === `rec-${action.request.id}` ? (procurementRecommendation(action.request) ?? r) : r,
        ),
      }
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
      return { ...state, ...withBackend(state, action.snapshot) }
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
  setWorkspace: (workspace: Workspace) => void
  setRange: (range: DateRange) => void
  openDrawer: (target: DrawerTarget) => void
  closeDrawer: () => void
  setCopilotOpen: (open: boolean) => void
  toggleIntegration: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
}

const SpendContext = React.createContext<SpendContextValue | null>(null)

export function SpendProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, undefined, initialState)

  // With NEXT_PUBLIC_API_URL set, replace the fixture snapshot with live backend data.
  React.useEffect(() => {
    let cancelled = false
    loadBackendSnapshot()
      .then((snapshot) => {
        if (snapshot && !cancelled) dispatch({ type: "hydrateBackend", snapshot })
      })
      .catch((error) => console.warn("SpendQ API unavailable, using exported fixtures.", error))
    return () => {
      cancelled = true
    }
  }, [])
  const value = React.useMemo<SpendContextValue>(
    () => ({
      state,
      approveRecommendation: (id) => dispatch({ type: "setRecStatus", id, status: "Approved" }),
      dismissRecommendation: (id) => dispatch({ type: "setRecStatus", id, status: "Dismissed" }),
      resetRecommendation: (id) => dispatch({ type: "setRecStatus", id, status: "Pending" }),
      submitRequest: (input: NewRequest) => {
        const s = state
        const next = Math.max(1049, ...s.requests.map((p) => Number(p.id.replace("PR-", "")) || 0)) + 1
        const id = `PR-${next}`
        const engineInput: RequestInput = input
        const request: ProcurementRequest = {
          ...input,
          id,
          submittedAt: "2026-11-26",
          requester: "You",
          status: "Pending review",
          analysis: analyzeRequest(engineInput, s.resources, s.vendors, s.budgets),
        }
        dispatch({ type: "submitRequest", request })
        return id
      },
      decideRequest: (id, decision) => dispatch({ type: "decideRequest", id, decision }),
      restoreRequest: (request) => dispatch({ type: "restoreRequest", request }),
      setWorkspace: (workspace) => dispatch({ type: "setWorkspace", workspace }),
      setRange: (range) => dispatch({ type: "setRange", range }),
      openDrawer: (target) => dispatch({ type: "openDrawer", target }),
      closeDrawer: () => dispatch({ type: "openDrawer", target: null }),
      setCopilotOpen: (open) => dispatch({ type: "setCopilot", open }),
      toggleIntegration: (id) => dispatch({ type: "toggleIntegration", id }),
      updateSettings: (patch) => dispatch({ type: "updateSettings", patch }),
    }),
    [state],
  )

  return <SpendContext.Provider value={value}>{children}</SpendContext.Provider>
}

export function useSpend() {
  const ctx = React.useContext(SpendContext)
  if (!ctx) throw new Error("useSpend must be used inside <SpendProvider>")
  return ctx
}
