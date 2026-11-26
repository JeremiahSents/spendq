export type Department =
  | "Core Banking"
  | "Digital Channels"
  | "Cloud Platform"
  | "Data & Risk"
  | "Security"

export type CloudProvider = "AWS" | "Azure" | "DigitalOcean" | "Vercel" | "Neon"

export type VendorKey =
  | "GitHub"
  | "Slack"
  | "Microsoft 365"
  | "OpenAI"
  | "Anthropic"
  | "Figma"
  | "Notion"
  | "Datadog"
  | "Zoom"
  | "New Relic"
  | "Grafana"
  | "Confluence"
  | "Microsoft Teams"
  | "Salesforce"
  | "Jira"
  | "Liquid"

/** Every mark the logo component can draw. */
export type BrandKey = CloudProvider | VendorKey

export type Environment = "Production" | "Staging" | "Development"
export type Risk = "Low" | "Medium" | "High"
export type Pillar = "Reuse" | "Innovate" | "Automate" | "Eliminate"

export type RecCategory =
  | "Idle infrastructure"
  | "Overprovisioned"
  | "Unused storage"
  | "Dev scheduling"
  | "Alternative provider"
  | "License reclaim"
  | "Seat reduction"
  | "Tier downgrade"
  | "Renegotiation"
  | "Consolidation"
  | "Vendor switch"
  | "Infrastructure reuse"
  | "Overbilling"
  | "Duplicate invoice"
  | "Duplicate subscription"
  | "Spend anomaly"
  | "Renewal notice"

/** The buckets the Overview savings chart groups categories into. */
export type SavingsBucket =
  | "Idle infrastructure"
  | "Overprovisioned"
  | "License reclaim"
  | "Vendor switch"
  | "Infrastructure reuse"
  | "Billing errors"

export type RecStatus = "Pending" | "Approved" | "Dismissed"
export type RecSource = "cloud" | "vendor" | "procurement"

export interface CloudResource {
  id: string
  name: string
  provider: CloudProvider
  type: string
  environment: Environment
  region: string
  size: string
  department: Department
  vcpu: number
  memoryGb: number
  /** Null for services with no CPU/memory notion (storage, gateways, platform plans). */
  cpu: number | null
  memory: number | null
  monthlyCost: number
  /** Cost of the recommended configuration. Equal to monthlyCost when nothing is flagged. */
  recommendedCost: number
  recommendedConfig?: string
  category?: RecCategory
  risk: Risk
  analysis?: string
  /** Verified headroom that procurement can reallocate before buying new capacity. */
  spare?: { vcpu: number; memoryGb: number; note: string }
  /** Added live during the demo (saved in localStorage, cleared by Reset). */
  createdInDemo?: boolean
  history: { day: string; cpu: number; memory: number }[]
}

export interface VendorAlternative {
  name: string
  brand?: BrandKey
  monthly: number
  featureMatch: number
  migrationEffort: "Low" | "Medium" | "High"
  note: string
}

export interface Vendor {
  id: string
  name: string
  brand: BrandKey
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
  description: string
  history: { month: string; spend: number }[]
  alternatives: VendorAlternative[]
  /** Added live during the demo (saved in localStorage, cleared by Reset). */
  createdInDemo?: boolean
  recommendation?: {
    category: RecCategory
    title: string
    action: string
    recommendedMonthly: number
    risk: Risk
    detail: string
  }
}

export interface Recommendation {
  id: string
  /** Backend action id, when the recommendation comes from the SpendQ API. */
  actionId?: string
  source: RecSource
  refId: string
  brand: BrandKey | "SpendIQ"
  title: string
  pillar: Pillar
  category: RecCategory
  department: Department
  currentMonthly: number
  recommendedMonthly: number
  risk: Risk
  status: RecStatus
  problem: string
  evidence: { label: string; value: string }[]
  steps: string[]
  dependencies: string[]
}

export type RequestCategory =
  | "Cloud Compute"
  | "Database"
  | "Storage"
  | "SaaS Licenses"
  | "AI API"
  | "Observability"

export type RequestStatus =
  | "Pending review"
  | "In review"
  | "Approved (Optimized)"
  | "Approved (As requested)"
  | "Rejected"

export interface ProcurementOption {
  key: "as-requested" | "reuse" | "optimized"
  label: string
  description: string
  monthly: number
  requirements: string
  complexity: "Low" | "Medium" | "High"
  risk: Risk
  recommended: boolean
  /** Parts of the plan, for the comparison card. */
  lines: { label: string; monthly: number; brand?: BrandKey }[]
}

export interface ProcurementAnalysis {
  unit: string
  capacity: number
  unitPrice: number
  reuse: { resourceId?: string; source: string; brand?: BrandKey; quantity: number; avoided: number } | null
  alternative: { name: string; brand?: BrandKey; unitPrice: number; featureMatch: number } | null
  options: ProcurementOption[]
  recommendedKey: ProcurementOption["key"]
  avoided: number
  reductionPct: number
  budget: { department: Department; budget: number; actual: number; headroom: number; fits: boolean }
  steps: string[]
  reuseChecked?: boolean
}

export interface ProcurementRequest {
  id: string
  title: string
  department: Department
  category: RequestCategory
  justification: string
  capacity: number
  preferredVendor: string
  requestedMonthly: number
  submittedAt: string
  requester: string
  status: RequestStatus
  analysis: ProcurementAnalysis
}

export interface Anomaly {
  id: string
  title: string
  detail: string
  severity: "Critical" | "Warning" | "Info"
  detectedAt: string
  target: { kind: "resource" | "vendor"; id: string }
}

export interface DepartmentBudget {
  department: Department
  monthlyBudget: number
}

export interface Integration {
  id: string
  name: string
  brand?: BrandKey
  kind: string
  connected: boolean
  lastSync: string
  detail: string
}

export interface Settings {
  autoApproveBelow: number
  requireCfoAbove: number
  blockOverBudget: boolean
  requireReuseCheck: boolean
  notifyOnAnomaly: boolean
  weeklyDigest: boolean
}

export type DateRange = "30d" | "qtd" | "ytd"
