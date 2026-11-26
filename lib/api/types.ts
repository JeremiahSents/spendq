// Friendly names for the API types. Do not edit schema.d.ts by hand:
// regenerate it from the backend (see backend/README.md).
import type { components } from "./schema"

type Schemas = components["schemas"]

export type Summary = Schemas["Summary"]
export type Department = Schemas["DepartmentOut"]
export type Vendor = Schemas["VendorOut"]
export type VendorDetail = Schemas["VendorDetail"]
export type Contract = Schemas["ContractOut"]
export type Invoice = Schemas["InvoiceOut"]
export type Licence = Schemas["LicenceOut"]
export type Finding = Schemas["FindingOut"]
export type FindingDetail = Schemas["FindingDetail"]
export type Action = Schemas["ActionOut"]
export type Renewal = Schemas["RenewalOut"]
export type Ledger = Schemas["Ledger"]
export type LedgerEntry = Schemas["LedgerEntry"]
export type Decision = Schemas["DecisionIn"]

export type FindingType = Finding["type"]
export type FindingStatus = Finding["status"]
export type ActionStatus = Action["status"]
export type ActionKind = Action["kind"]

// The graph endpoint returns nodes and edges ready for React Flow.
export type GraphNodeKind = "vendor" | "contract" | "licence" | "usage" | "department" | "invoice"
export type GraphNodeData = {
  kind: GraphNodeKind
  label: string
  sublabel: string | null
  highlight: boolean
}
export type GraphNode = Omit<Schemas["GraphNode"], "data"> & { data: GraphNodeData }
export type GraphEdge = Schemas["GraphEdge"]
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] }

// Display labels for finding types, so every screen words them the same way.
export const FINDING_TYPE_LABEL: Record<FindingType, string> = {
  unused_licence: "Unused licences",
  duplicate_subscription: "Duplicate subscription",
  vendor_overlap: "Overlapping vendors",
  overbilling: "Billed above contract",
  duplicate_invoice: "Duplicate invoice",
  anomaly: "Spending anomaly",
  renewal_due: "Renewal due",
}
