"""API response shapes. The frontend's TypeScript types are generated from these
(via /openapi.json), so a change here is a change to the contract."""
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel

from app.models import (
    ActionKind, ActionStatus, ApprovalTier, BillingCycle, Country, Currency, FindingStatus, FindingType,
)


class DepartmentOut(BaseModel):
    id: str
    name: str
    country: Country
    cost_centre: str


class VendorOut(BaseModel):
    id: str
    name: str
    canonical_vendor_id: Optional[str]
    canonical_name: Optional[str]
    category: str
    country: str
    spend_12m_kes: float
    contract_count: int
    open_finding_count: int


class ContractOut(BaseModel):
    id: str
    vendor_id: str
    vendor_name: str
    department_id: str
    department_name: str
    title: str
    service_category: str
    capabilities: list[str]
    billing_cycle: BillingCycle
    unit: str
    unit_price: float
    currency: Currency
    quantity: int
    start_date: date
    end_date: date
    auto_renew: bool
    notice_days: int
    notice_deadline: date
    days_to_end: int
    annual_value_kes: float
    pdf_path: Optional[str]


class InvoiceOut(BaseModel):
    id: str
    invoice_number: str
    vendor_id: str
    vendor_name: str
    contract_id: Optional[str]
    department_id: str
    invoice_date: date
    description: str
    quantity: float
    unit_price: float
    amount: float
    currency: Currency
    amount_kes: float
    etims_number: Optional[str]


class LicenceOut(BaseModel):
    id: str
    contract_id: str
    product_name: str
    seats_paid: int
    seats_assigned: int
    seats_active_90d: int
    never_signed_in: int
    utilisation: float  # active / paid, 0..1


class ActionOut(BaseModel):
    id: str
    finding_id: str
    finding_title: str
    finding_type: FindingType
    kind: ActionKind
    description: str
    est_saving_kes: float
    approval_tier: ApprovalTier
    status: ActionStatus
    draft: Optional[str]
    approver: Optional[str]
    decided_at: Optional[datetime]
    realised_saving_kes: float


class FindingOut(BaseModel):
    id: str
    type: FindingType
    title: str
    explanation: str
    amount_at_issue_kes: float
    est_saving_kes: float
    saving_basis: Literal["annual", "one_time", "none"]
    confidence: float
    status: FindingStatus
    department_id: Optional[str]
    department_name: Optional[str]
    vendor_ids: list[str]
    vendor_names: list[str]
    contract_ids: list[str]
    invoice_ids: list[str]
    licence_ids: list[str]
    related_finding_ids: list[str]
    evidence: dict
    detected_at: datetime


class FindingDetail(FindingOut):
    contracts: list[ContractOut]
    invoices: list[InvoiceOut]
    licences: list[LicenceOut]
    actions: list[ActionOut]


class VendorDetail(VendorOut):
    contracts: list[ContractOut]
    invoices: list[InvoiceOut]
    findings: list[FindingOut]


class TypeTotal(BaseModel):
    type: FindingType
    count: int
    est_saving_kes: float
    amount_at_issue_kes: float


class MonthTotal(BaseModel):
    month: str  # "2026-09"
    amount_kes: float


class CategoryTotal(BaseModel):
    category: str
    amount_kes: float


class Summary(BaseModel):
    as_of: date
    usd_to_kes: float
    total_spend_12m_kes: float
    vendor_count: int
    contract_count: int
    found_kes: float          # est savings across all findings not dismissed
    approved_kes: float       # est savings of approved or done actions
    realised_kes: float       # savings already banked
    open_finding_count: int
    pending_approval_count: int
    renewals_next_90d: int
    findings_by_type: list[TypeTotal]
    spend_by_month: list[MonthTotal]
    spend_by_category: list[CategoryTotal]


class RenewalOut(BaseModel):
    contract_id: str
    title: str
    vendor_name: str
    department_name: str
    end_date: date
    notice_deadline: date
    days_to_notice_deadline: int
    days_to_end: int
    auto_renew: bool
    annual_value_kes: float
    utilisation: Optional[float]  # for licence contracts
    finding_ids: list[str]


class LedgerEntry(BaseModel):
    action_id: str
    finding_id: str
    finding_title: str
    kind: ActionKind
    status: ActionStatus
    approver: Optional[str]
    decided_at: Optional[datetime]
    est_saving_kes: float
    realised_saving_kes: float
    saving_basis: Literal["annual", "one_time", "none"]


class Ledger(BaseModel):
    approved_kes: float
    realised_kes: float
    entries: list[LedgerEntry]


NodeType = Literal["vendor", "contract", "licence", "usage", "department", "invoice"]


class Position(BaseModel):
    x: float
    y: float


class GraphNode(BaseModel):
    """Shaped for React Flow: pass straight in as `nodes` (type is our own field in `data`)."""
    id: str
    position: Position
    data: dict  # {"kind": NodeType, "label": str, "sublabel": str | None, "highlight": bool}


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None


class Graph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class DecisionIn(BaseModel):
    approver: str = "Demo judge"
    note: Optional[str] = None
