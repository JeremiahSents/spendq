"""SpendQ API.

    uvicorn app.main:app --reload
"""
import os
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from app import schemas as S
from app.db import ensure_ready, get_session
from app.models import (
    Action, ActionStatus, BillingCycle, Contract, Department, Finding, FindingStatus, FindingType, Invoice, Licence,
    LicenceAssignment, Vendor,
)
from app.settings import ACTIVE_WINDOW_DAYS, CORS_ORIGINS, DEMO_TODAY, RENEWAL_WINDOW_DAYS, TZ, USD_TO_KES, to_kes


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_ready()  # first boot on a fresh database: build the demo data
    yield


app = FastAPI(title="SpendQ API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app"),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- helpers ----------

def annual_value_kes(c: Contract) -> float:
    per_year = {
        BillingCycle.monthly: c.unit_price * c.quantity * 12,
        BillingCycle.usage: c.unit_price * 12,
        BillingCycle.annual: c.unit_price * c.quantity,
        BillingCycle.one_off: c.unit_price * c.quantity,
    }[c.billing_cycle]
    return to_kes(per_year, c.currency)


def contract_out(c: Contract, vendors: dict[str, Vendor], depts: dict[str, Department]) -> S.ContractOut:
    v = vendors[c.vendor_id]
    return S.ContractOut(
        **c.model_dump(), vendor_name=v.canonical_name or v.name, department_name=depts[c.department_id].name,
        notice_deadline=c.end_date - timedelta(days=c.notice_days), days_to_end=(c.end_date - DEMO_TODAY).days,
        annual_value_kes=annual_value_kes(c),
    )


def invoice_out(i: Invoice, vendors: dict[str, Vendor]) -> S.InvoiceOut:
    v = vendors[i.vendor_id]
    return S.InvoiceOut(**i.model_dump(), vendor_name=v.canonical_name or v.name, amount_kes=to_kes(i.amount, i.currency))


def licence_out(s: Session, lic: Licence) -> S.LicenceOut:
    cutoff = DEMO_TODAY - timedelta(days=ACTIVE_WINDOW_DAYS)
    rows = s.exec(select(LicenceAssignment).where(LicenceAssignment.licence_id == lic.id)).all()
    active = sum(1 for a in rows if a.last_login_date and a.last_login_date >= cutoff)
    return S.LicenceOut(
        id=lic.id, contract_id=lic.contract_id, product_name=lic.product_name, seats_paid=lic.seats_paid,
        seats_assigned=len(rows), seats_active_90d=active, never_signed_in=sum(1 for a in rows if a.last_login_date is None),
        utilisation=round(active / lic.seats_paid, 3) if lic.seats_paid else 0.0,
    )


def finding_out(f: Finding, vendors: dict[str, Vendor], depts: dict[str, Department]) -> S.FindingOut:
    names = list(dict.fromkeys(vendors[v].canonical_name or vendors[v].name for v in f.vendor_ids))
    return S.FindingOut(
        **f.model_dump(), department_name=depts[f.department_id].name if f.department_id else None, vendor_names=names,
    )


def action_out(a: Action, findings: dict[str, Finding]) -> S.ActionOut:
    f = findings[a.finding_id]
    return S.ActionOut(**a.model_dump(), finding_title=f.title, finding_type=f.type)


def lookups(s: Session):
    return ({v.id: v for v in s.exec(select(Vendor)).all()}, {d.id: d for d in s.exec(select(Department)).all()})


def get_or_404(s: Session, model, id_: str):
    obj = s.get(model, id_)
    if obj is None:
        raise HTTPException(404, f"{model.__name__} {id_} not found")
    return obj


# ---------- routes ----------

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "as_of": DEMO_TODAY.isoformat()}


@app.get("/summary", response_model=S.Summary)
def summary(s: Session = Depends(get_session)):
    invoices = s.exec(select(Invoice)).all()
    findings = [f for f in s.exec(select(Finding)).all() if f.status != FindingStatus.dismissed]
    actions = s.exec(select(Action)).all()
    contracts = s.exec(select(Contract)).all()
    vendors, _ = lookups(s)

    by_month: dict[str, float] = defaultdict(float)
    by_cat: dict[str, float] = defaultdict(float)
    for i in invoices:
        kes = to_kes(i.amount, i.currency)
        by_month[f"{i.invoice_date:%Y-%m}"] += kes
        by_cat[vendors[i.vendor_id].category] += kes

    by_type: dict[FindingType, S.TypeTotal] = {}
    for f in findings:
        t = by_type.setdefault(f.type, S.TypeTotal(type=f.type, count=0, est_saving_kes=0, amount_at_issue_kes=0))
        t.count += 1
        t.est_saving_kes += f.est_saving_kes
        t.amount_at_issue_kes += f.amount_at_issue_kes

    horizon = DEMO_TODAY + timedelta(days=RENEWAL_WINDOW_DAYS)
    return S.Summary(
        as_of=DEMO_TODAY, usd_to_kes=USD_TO_KES,
        total_spend_12m_kes=round(sum(by_month.values()), 2),
        vendor_count=len({v.canonical_vendor_id or v.id for v in vendors.values()}),
        contract_count=len(contracts),
        found_kes=round(sum(f.est_saving_kes for f in findings), 2),
        approved_kes=round(sum(a.est_saving_kes for a in actions if a.status in (ActionStatus.approved, ActionStatus.done)), 2),
        realised_kes=round(sum(a.realised_saving_kes for a in actions), 2),
        open_finding_count=sum(1 for f in findings if f.status == FindingStatus.open),
        pending_approval_count=sum(1 for a in actions if a.status == ActionStatus.proposed),
        renewals_next_90d=sum(1 for c in contracts if DEMO_TODAY <= c.end_date <= horizon),
        findings_by_type=sorted(by_type.values(), key=lambda t: -t.est_saving_kes),
        spend_by_month=[S.MonthTotal(month=m, amount_kes=round(v, 2)) for m, v in sorted(by_month.items())],
        spend_by_category=sorted((S.CategoryTotal(category=c, amount_kes=round(v, 2)) for c, v in by_cat.items()),
                                 key=lambda c: -c.amount_kes),
    )


@app.get("/departments", response_model=list[S.DepartmentOut])
def departments(s: Session = Depends(get_session)):
    return [S.DepartmentOut(**d.model_dump()) for d in s.exec(select(Department)).all()]


def _vendor_out(v: Vendor, contracts, invoices, findings) -> S.VendorOut:
    return S.VendorOut(
        **v.model_dump(),
        spend_12m_kes=round(sum(to_kes(i.amount, i.currency) for i in invoices if i.vendor_id == v.id), 2),
        contract_count=sum(1 for c in contracts if c.vendor_id == v.id),
        open_finding_count=sum(1 for f in findings if v.id in f.vendor_ids and f.status == FindingStatus.open),
    )


@app.get("/vendors", response_model=list[S.VendorOut])
def vendors_list(s: Session = Depends(get_session)):
    contracts, invoices, findings = s.exec(select(Contract)).all(), s.exec(select(Invoice)).all(), s.exec(select(Finding)).all()
    out = [_vendor_out(v, contracts, invoices, findings) for v in s.exec(select(Vendor)).all()]
    return sorted(out, key=lambda v: -v.spend_12m_kes)


@app.get("/vendors/{vendor_id}", response_model=S.VendorDetail)
def vendor_detail(vendor_id: str, s: Session = Depends(get_session)):
    v = get_or_404(s, Vendor, vendor_id)
    vendors, depts = lookups(s)
    contracts = s.exec(select(Contract).where(Contract.vendor_id == vendor_id)).all()
    invoices = s.exec(select(Invoice).where(Invoice.vendor_id == vendor_id).order_by(Invoice.invoice_date.desc())).all()
    findings = [f for f in s.exec(select(Finding)).all() if vendor_id in f.vendor_ids]
    base = _vendor_out(v, contracts, invoices, findings)
    return S.VendorDetail(
        **base.model_dump(), contracts=[contract_out(c, vendors, depts) for c in contracts],
        invoices=[invoice_out(i, vendors) for i in invoices], findings=[finding_out(f, vendors, depts) for f in findings],
    )


@app.get("/contracts", response_model=list[S.ContractOut])
def contracts_list(department_id: Optional[str] = None, s: Session = Depends(get_session)):
    vendors, depts = lookups(s)
    q = select(Contract)
    if department_id:
        q = q.where(Contract.department_id == department_id)
    return [contract_out(c, vendors, depts) for c in s.exec(q).all()]


@app.get("/findings", response_model=list[S.FindingOut])
def findings_list(
    type: Optional[FindingType] = None, status: Optional[FindingStatus] = None,
    department_id: Optional[str] = None, s: Session = Depends(get_session),
):
    vendors, depts = lookups(s)
    q = select(Finding)
    if type:
        q = q.where(Finding.type == type)
    if status:
        q = q.where(Finding.status == status)
    if department_id:
        q = q.where(Finding.department_id == department_id)
    rows = sorted(s.exec(q).all(), key=lambda f: (-f.est_saving_kes, -f.amount_at_issue_kes))
    return [finding_out(f, vendors, depts) for f in rows]


@app.get("/findings/{finding_id}", response_model=S.FindingDetail)
def finding_detail(finding_id: str, s: Session = Depends(get_session)):
    f = get_or_404(s, Finding, finding_id)
    vendors, depts = lookups(s)
    findings = {x.id: x for x in s.exec(select(Finding)).all()}
    return S.FindingDetail(
        **finding_out(f, vendors, depts).model_dump(),
        contracts=[contract_out(s.get(Contract, c), vendors, depts) for c in f.contract_ids],
        invoices=[invoice_out(s.get(Invoice, i), vendors) for i in f.invoice_ids],
        licences=[licence_out(s, s.get(Licence, l)) for l in f.licence_ids],
        actions=[action_out(a, findings) for a in s.exec(select(Action).where(Action.finding_id == f.id)).all()],
    )


@app.get("/findings/{finding_id}/graph", response_model=S.Graph)
def finding_graph(finding_id: str, s: Session = Depends(get_session)):
    """The money chain behind one finding: vendor -> contract -> licence -> usage, plus owner and invoices."""
    f = get_or_404(s, Finding, finding_id)
    vendors, depts = lookups(s)
    columns: dict[int, int] = defaultdict(int)
    nodes: dict[str, S.GraphNode] = {}
    edges: list[S.GraphEdge] = []

    def node(nid: str, kind: str, col: int, label: str, sub: Optional[str] = None, highlight: bool = False):
        if nid not in nodes:
            nodes[nid] = S.GraphNode(id=nid, position=S.Position(x=col * 280, y=columns[col] * 110),
                                     data={"kind": kind, "label": label, "sublabel": sub, "highlight": highlight})
            columns[col] += 1

    def edge(a: str, b: str, label: Optional[str] = None):
        edges.append(S.GraphEdge(id=f"{a}->{b}", source=a, target=b, label=label))

    for cid in f.contract_ids:
        c = s.get(Contract, cid)
        v = vendors[c.vendor_id]
        node(v.id, "vendor", 0, v.canonical_name or v.name, v.name)
        node(c.id, "contract", 1, c.title, f"{c.currency.value} {c.unit_price:,.2f} / {c.unit}", highlight=True)
        node(c.department_id, "department", 2, depts[c.department_id].name, "owner")
        edge(v.id, c.id)
        edge(c.id, c.department_id, "owned by")
        for lid in f.licence_ids:
            lic = s.get(Licence, lid)
            if lic.contract_id != c.id:
                continue
            lo = licence_out(s, lic)
            node(lic.id, "licence", 2, lic.product_name, f"{lo.seats_paid} seats paid")
            node(f"usage_{lic.id}", "usage", 3, f"{lo.seats_active_90d} active in {ACTIVE_WINDOW_DAYS} days",
                 f"{lo.utilisation:.0%} used", highlight=lo.utilisation < 0.6)
            edge(c.id, lic.id)
            edge(lic.id, f"usage_{lic.id}")
    for iid in f.invoice_ids[:6]:
        i = s.get(Invoice, iid)
        node(i.id, "invoice", 3, i.invoice_number, f"{i.currency.value} {i.amount:,.0f} on {i.invoice_date:%d %b %Y}", highlight=True)
        if i.contract_id:
            edge(i.contract_id, i.id, "billed")
    return S.Graph(nodes=list(nodes.values()), edges=edges)


@app.get("/actions", response_model=list[S.ActionOut])
def actions_list(status: Optional[ActionStatus] = None, s: Session = Depends(get_session)):
    findings = {f.id: f for f in s.exec(select(Finding)).all()}
    q = select(Action) if status is None else select(Action).where(Action.status == status)
    return [action_out(a, findings) for a in s.exec(q).all()]


def _decide(action_id: str, s: Session, status: ActionStatus, approver: str) -> S.ActionOut:
    a = get_or_404(s, Action, action_id)
    allowed = {ActionStatus.approved: {ActionStatus.proposed}, ActionStatus.rejected: {ActionStatus.proposed},
               ActionStatus.done: {ActionStatus.approved}}[status]
    if a.status not in allowed:
        raise HTTPException(409, f"Action {action_id} is {a.status.value}; cannot move to {status.value}")
    a.status, a.approver, a.decided_at = status, approver, datetime.now(TZ)
    f = s.get(Finding, a.finding_id)
    if status == ActionStatus.done:
        a.realised_saving_kes = a.est_saving_kes
    if status in (ActionStatus.approved, ActionStatus.done):
        f.status = FindingStatus.actioned
    s.add(a)
    s.add(f)
    s.commit()
    s.refresh(a)
    return action_out(a, {f.id: f})


@app.post("/actions/{action_id}/approve", response_model=S.ActionOut)
def approve(action_id: str, body: S.DecisionIn = S.DecisionIn(), s: Session = Depends(get_session)):
    return _decide(action_id, s, ActionStatus.approved, body.approver)


@app.post("/actions/{action_id}/reject", response_model=S.ActionOut)
def reject(action_id: str, body: S.DecisionIn = S.DecisionIn(), s: Session = Depends(get_session)):
    return _decide(action_id, s, ActionStatus.rejected, body.approver)


@app.post("/actions/{action_id}/complete", response_model=S.ActionOut)
def complete(action_id: str, body: S.DecisionIn = S.DecisionIn(), s: Session = Depends(get_session)):
    """Mark an approved action as carried out; its saving moves into the ledger as realised."""
    return _decide(action_id, s, ActionStatus.done, body.approver)


@app.get("/renewals", response_model=list[S.RenewalOut])
def renewals(days: int = Query(RENEWAL_WINDOW_DAYS, ge=1, le=730), s: Session = Depends(get_session)):
    vendors, depts = lookups(s)
    horizon = DEMO_TODAY + timedelta(days=days)
    findings = s.exec(select(Finding)).all()
    licences = {l.contract_id: l for l in s.exec(select(Licence)).all()}
    out = []
    for c in s.exec(select(Contract)).all():
        if not (DEMO_TODAY <= c.end_date <= horizon):
            continue
        deadline = c.end_date - timedelta(days=c.notice_days)
        out.append(S.RenewalOut(
            contract_id=c.id, title=c.title, vendor_name=vendors[c.vendor_id].canonical_name or vendors[c.vendor_id].name,
            department_name=depts[c.department_id].name, end_date=c.end_date, notice_deadline=deadline,
            days_to_notice_deadline=(deadline - DEMO_TODAY).days, days_to_end=(c.end_date - DEMO_TODAY).days,
            auto_renew=c.auto_renew, annual_value_kes=annual_value_kes(c),
            utilisation=licence_out(s, licences[c.id]).utilisation if c.id in licences else None,
            finding_ids=[f.id for f in findings if c.id in f.contract_ids],
        ))
    return sorted(out, key=lambda r: r.days_to_notice_deadline)


@app.get("/ledger", response_model=S.Ledger)
def ledger(s: Session = Depends(get_session)):
    findings = {f.id: f for f in s.exec(select(Finding)).all()}
    acts = [a for a in s.exec(select(Action)).all() if a.status in (ActionStatus.approved, ActionStatus.done)]
    acts.sort(key=lambda a: a.decided_at or datetime.min.replace(tzinfo=TZ), reverse=True)
    entries = [S.LedgerEntry(
        action_id=a.id, finding_id=a.finding_id, finding_title=findings[a.finding_id].title, kind=a.kind, status=a.status,
        approver=a.approver, decided_at=a.decided_at, est_saving_kes=a.est_saving_kes,
        realised_saving_kes=a.realised_saving_kes, saving_basis=findings[a.finding_id].saving_basis,
    ) for a in acts]
    return S.Ledger(approved_kes=round(sum(e.est_saving_kes for e in entries), 2),
                    realised_kes=round(sum(e.realised_saving_kes for e in entries), 2), entries=entries)


@app.post("/admin/reset")
def reset(x_admin_token: Optional[str] = Header(default=None)):
    """Restore the demo to its starting state (run between judges)."""
    token = os.getenv("ADMIN_TOKEN")
    if token and x_admin_token != token:
        raise HTTPException(403, "Bad admin token")
    from scripts.seed import seed
    counts = seed()
    return {"reset": True, "counts": counts}
