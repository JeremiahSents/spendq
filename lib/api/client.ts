// API client. With NEXT_PUBLIC_API_URL unset, every call returns the mock JSON
// in ./mock, so screens can be built before the backend is running.
import type {
  Action,
  Contract,
  Decision,
  Department,
  Finding,
  FindingDetail,
  FindingStatus,
  FindingType,
  Graph,
  Ledger,
  Renewal,
  Summary,
  Vendor,
  VendorDetail,
} from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL

async function get<T>(path: string, mock: () => Promise<{ default: unknown }>): Promise<T> {
  if (!API_URL) return (await mock()).default as T
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) throw new Error("Set NEXT_PUBLIC_API_URL to use actions")
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

function query(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])
  return q.size ? `?${q}` : ""
}

export const api = {
  summary: () => get<Summary>("/summary", () => import("./mock/summary.json")),
  departments: () => get<Department[]>("/departments", () => import("./mock/departments.json")),
  vendors: () => get<Vendor[]>("/vendors", () => import("./mock/vendors.json")),
  vendor: (id: string) => get<VendorDetail>(`/vendors/${id}`, () => import("./mock/vendor-zoom.json")),
  contracts: () => get<Contract[]>("/contracts", () => import("./mock/contracts.json")),
  findings: (f: { type?: FindingType; status?: FindingStatus; department_id?: string } = {}) =>
    get<Finding[]>(`/findings${query(f)}`, () => import("./mock/findings.json")),
  finding: (id: string) => get<FindingDetail>(`/findings/${id}`, () => import("./mock/finding-fnd_001.json")),
  findingGraph: (id: string) => get<Graph>(`/findings/${id}/graph`, () => import("./mock/graph-fnd_001.json")),
  actions: (status?: Action["status"]) => get<Action[]>(`/actions${query({ status })}`, () => import("./mock/actions.json")),
  renewals: (days = 90) => get<Renewal[]>(`/renewals?days=${days}`, () => import("./mock/renewals.json")),
  ledger: () => get<Ledger>("/ledger", () => import("./mock/ledger-with-entries.json")),
  approve: (id: string, d: Decision = { approver: "Demo judge" }) => post<Action>(`/actions/${id}/approve`, d),
  reject: (id: string, d: Decision = { approver: "Demo judge" }) => post<Action>(`/actions/${id}/reject`, d),
  complete: (id: string, d: Decision = { approver: "Demo judge" }) => post<Action>(`/actions/${id}/complete`, d),
}
