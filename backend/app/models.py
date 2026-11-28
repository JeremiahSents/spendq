"""Database tables. This file is the data contract.

Change a field here, re-run `python -m scripts.seed`, re-export fixtures and
regenerate the frontend types (see README). Announce every change in the group chat.
"""
from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


# ---------- enums ----------

class Country(str, Enum):
    KE = "KE"
    UG = "UG"
    TZ = "TZ"
    RW = "RW"


class Currency(str, Enum):
    KES = "KES"
    USD = "USD"


class BillingCycle(str, Enum):
    monthly = "monthly"
    annual = "annual"
    one_off = "one_off"
    usage = "usage"  # variable monthly bill, e.g. cloud


class FindingType(str, Enum):
    unused_licence = "unused_licence"
    duplicate_subscription = "duplicate_subscription"
    vendor_overlap = "vendor_overlap"
    overbilling = "overbilling"
    duplicate_invoice = "duplicate_invoice"
    anomaly = "anomaly"
    renewal_due = "renewal_due"


class FindingStatus(str, Enum):
    open = "open"
    actioned = "actioned"
    dismissed = "dismissed"


class ActionKind(str, Enum):
    reclaim_seats = "reclaim_seats"
    cancel_subscription = "cancel_subscription"
    consolidate_vendor = "consolidate_vendor"
    dispute_invoice = "dispute_invoice"
    block_duplicate_payment = "block_duplicate_payment"
    investigate = "investigate"
    renegotiate = "renegotiate"


class ActionStatus(str, Enum):
    proposed = "proposed"
    approved = "approved"
    rejected = "rejected"
    done = "done"


class ApprovalTier(str, Enum):
    manager = "manager"  # below the KES threshold in settings
    cfo = "cfo"          # at or above it


# ---------- raw data (what the bank's systems would give us) ----------

class Department(SQLModel, table=True):
    id: str = Field(primary_key=True)            # "dep_it_ke"
    name: str                                    # "IT"
    country: Country
    cost_centre: str                             # "CC-1100"


class Vendor(SQLModel, table=True):
    """One row per vendor-master record. Real ERPs hold the same company twice
    under different names; canonical_vendor_id groups them after matching."""
    id: str = Field(primary_key=True)            # "ven_atlassian_1"
    name: str                                    # exactly as in the ERP
    category: str                                # "software", "cloud", "connectivity", ...
    country: str                                 # where the billing entity sits
    canonical_vendor_id: Optional[str] = None    # filled by the matching step
    canonical_name: Optional[str] = None         # "Atlassian"


class Contract(SQLModel, table=True):
    id: str = Field(primary_key=True)            # "con_zoom_mkt"
    vendor_id: str = Field(foreign_key="vendor.id", index=True)
    department_id: str = Field(foreign_key="department.id", index=True)
    title: str
    service_category: str                        # "video_conferencing", "crm", ...
    capabilities: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    billing_cycle: BillingCycle
    unit: str                                    # "seat/month", "month", "year", "engagement"
    unit_price: float                            # in `currency`; for usage billing, the expected monthly amount
    currency: Currency
    quantity: int                                # seats or units contracted
    start_date: date
    end_date: date
    auto_renew: bool
    notice_days: int                             # notice needed before end_date to stop auto-renewal
    pdf_path: Optional[str] = None               # contract document, for LLM term extraction


class Invoice(SQLModel, table=True):
    id: str = Field(primary_key=True)
    invoice_number: str                          # vendor's number
    vendor_id: str = Field(foreign_key="vendor.id", index=True)
    contract_id: Optional[str] = Field(default=None, foreign_key="contract.id", index=True)  # None = off-contract spend
    department_id: str = Field(foreign_key="department.id", index=True)
    invoice_date: date
    description: str
    quantity: float
    unit_price: float
    amount: float                                # quantity * unit_price, in `currency`
    currency: Currency
    etims_number: Optional[str] = None           # KRA eTIMS control number (Kenyan invoices)


class Licence(SQLModel, table=True):
    id: str = Field(primary_key=True)
    contract_id: str = Field(foreign_key="contract.id", index=True)
    product_name: str                            # "Zoom Business"
    seats_paid: int


class LicenceAssignment(SQLModel, table=True):
    """One row per seat given to a person, with their last sign-in (from SSO logs)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    licence_id: str = Field(foreign_key="licence.id", index=True)
    employee_id: str = Field(index=True)         # "emp_0042"
    assigned_date: date
    last_login_date: Optional[date] = None       # None = never signed in


# ---------- outputs (what the system produces) ----------

class Finding(SQLModel, table=True):
    id: str = Field(primary_key=True)            # "fnd_001"
    type: FindingType
    title: str                                   # one line, shown in lists
    explanation: str                             # 2-3 sentences with the evidence
    amount_at_issue_kes: float                   # money involved
    est_saving_kes: float                        # what acting on it should save (annualised or one-time, see saving_basis)
    saving_basis: str                            # "annual" | "one_time" | "none"
    confidence: float                            # 0..1
    status: FindingStatus = FindingStatus.open
    department_id: Optional[str] = Field(default=None, foreign_key="department.id")
    vendor_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    contract_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    invoice_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    licence_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    related_finding_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    evidence: dict = Field(default_factory=dict, sa_column=Column(JSON))  # numbers the UI can chart
    detected_at: datetime


class Action(SQLModel, table=True):
    id: str = Field(primary_key=True)            # "act_001"
    finding_id: str = Field(foreign_key="finding.id", index=True)
    kind: ActionKind
    description: str
    est_saving_kes: float
    approval_tier: ApprovalTier
    status: ActionStatus = ActionStatus.proposed
    draft: Optional[str] = None                  # e.g. renegotiation brief or dispute email
    approver: Optional[str] = None
    decided_at: Optional[datetime] = None
    realised_saving_kes: float = 0.0
