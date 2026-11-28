"""Detection engine: reads the raw tables and finds problems by rule.

Nothing here knows which problems were planted. Each detector applies one rule to
all the data; run_engine() collects findings, turns them into proposed actions and
saves both. tests/test_engine.py checks the result against scripts/planted.py.
"""
from collections import defaultdict
from datetime import datetime, timedelta
from itertools import combinations
from statistics import median

from sqlmodel import Session, delete, select

from app.models import (
    Action, ActionKind, ApprovalTier, BillingCycle, Contract, Department, Finding, FindingType, Invoice, Licence,
    LicenceAssignment, Vendor,
)
from app.settings import ACTIVE_WINDOW_DAYS, CFO_APPROVAL_THRESHOLD_KES, DEMO_TODAY, TZ, to_kes

# Rule thresholds, in one place so the pitch can quote them.
UNUSED_UTILISATION_BELOW = 0.6      # flag licences with under 60% of paid seats active
PRICE_TOLERANCE = 0.01              # invoice price more than 1% above contract
DUPLICATE_INVOICE_DAYS = 7          # same vendor + amount within 7 days
ANOMALY_RATIO = 2.0                 # month at least 2x the vendor's median ...
ANOMALY_MAD_Z = 3.5                 # ... and a robust z-score above 3.5
RENEWAL_NOTICE_WITHIN_DAYS = 30     # notice deadline within 30 days


def _kes(x: float) -> str:
    return f"KES {x:,.0f}"


class Data:
    """All raw tables loaded once, with the lookups detectors need."""

    def __init__(self, s: Session):
        self.vendors = {v.id: v for v in s.exec(select(Vendor)).all()}
        self.depts = {d.id: d for d in s.exec(select(Department)).all()}
        self.contracts = {c.id: c for c in s.exec(select(Contract)).all()}
        self.invoices = s.exec(select(Invoice)).all()
        self.licences = {l.contract_id: l for l in s.exec(select(Licence)).all()}
        self.assignments: dict[str, list[LicenceAssignment]] = defaultdict(list)
        for a in s.exec(select(LicenceAssignment)).all():
            self.assignments[a.licence_id].append(a)
        self.cutoff = DEMO_TODAY - timedelta(days=ACTIVE_WINDOW_DAYS)

    def usage(self, contract_id: str) -> dict:
        lic = self.licences[contract_id]
        rows = self.assignments[lic.id]
        return {
            "seats_paid": lic.seats_paid,
            "seats_assigned": len(rows),
            "seats_active_90d": sum(1 for a in rows if a.last_login_date and a.last_login_date >= self.cutoff),
            "never_signed_in": sum(1 for a in rows if a.last_login_date is None),
        }

    def users(self, contract_id: str) -> set[str]:
        return {a.employee_id for a in self.assignments[self.licences[contract_id].id]}

    def canonical(self, c: Contract) -> str:
        v = self.vendors[c.vendor_id]
        return v.canonical_vendor_id or v.id

    def vendor_name(self, c: Contract) -> str:
        v = self.vendors[c.vendor_id]
        return v.canonical_name or v.name

    def country(self, c: Contract) -> str:
        return self.depts[c.department_id].country.value


def _finding(**kw) -> Finding:
    return Finding(detected_at=datetime.combine(DEMO_TODAY, datetime.min.time(), tzinfo=TZ).replace(hour=8), id="", **kw)


# ---------- detectors ----------

def unused_licences(d: Data) -> list[Finding]:
    out = []
    for cid, lic in d.licences.items():
        c, u = d.contracts[cid], d.usage(cid)
        if not lic.seats_paid or u["seats_active_90d"] / lic.seats_paid >= UNUSED_UTILISATION_BELOW:
            continue
        idle = lic.seats_paid - u["seats_active_90d"]
        saving = to_kes(idle * c.unit_price * 12, c.currency)
        out.append(_finding(
            type=FindingType.unused_licence,
            title=f"{idle} of {lic.seats_paid} {d.vendor_name(c).split()[0]} seats unused in the last {ACTIVE_WINDOW_DAYS} days",
            explanation=(f"{d.depts[c.department_id].name} pays for {lic.seats_paid} {lic.product_name} seats. Only "
                         f"{u['seats_active_90d']} people signed in in the last {ACTIVE_WINDOW_DAYS} days, and "
                         f"{u['never_signed_in']} assigned users never signed in. Cutting to active users saves {_kes(saving)} a year."),
            amount_at_issue_kes=saving, est_saving_kes=saving, saving_basis="annual", confidence=0.9,
            department_id=c.department_id, vendor_ids=[c.vendor_id], contract_ids=[cid], licence_ids=[lic.id], evidence=u,
        ))
    return out


def vendor_overlaps(d: Data, unused: list[Finding]) -> list[Finding]:
    """Two seat-based tools from different companies, same country, sharing a capability.
    The narrower tool (fewer capabilities) is the one to drop."""
    unused_contracts = {cid for f in unused for cid in f.contract_ids}
    out = []
    licensed = [d.contracts[cid] for cid in d.licences]
    for a, b in combinations(licensed, 2):
        shared = set(a.capabilities) & set(b.capabilities)
        if not shared or d.canonical(a) == d.canonical(b) or d.country(a) != d.country(b) or a.service_category == b.service_category:
            continue
        narrow, broad = (a, b) if len(a.capabilities) <= len(b.capabilities) else (b, a)
        u = d.usage(narrow.id)
        # if the idle seats are already a finding, only count the active ones here
        seats = u["seats_active_90d"] if narrow.id in unused_contracts else narrow.quantity
        saving = to_kes(seats * narrow.unit_price * 12, narrow.currency)
        annual = to_kes(narrow.quantity * narrow.unit_price * 12, narrow.currency)
        cap = sorted(shared)[0].replace("_", " ")
        out.append(_finding(
            type=FindingType.vendor_overlap,
            title=f"{d.vendor_name(narrow).split()[0]} duplicates {cap} already paid for in {broad.title.split(' E3')[0]}",
            explanation=(f"{broad.title} ({broad.quantity} seats) already covers {cap}. The {u['seats_active_90d']} active "
                         f"{narrow.title} users could move across, saving {_kes(saving)} a year"
                         f"{' on top of the unused seats' if narrow.id in unused_contracts else ''}."),
            amount_at_issue_kes=annual, est_saving_kes=saving, saving_basis="annual", confidence=0.7,
            department_id=narrow.department_id, vendor_ids=[narrow.vendor_id, broad.vendor_id],
            contract_ids=[narrow.id, broad.id], licence_ids=[d.licences[narrow.id].id, d.licences[broad.id].id],
            evidence={"shared_capability": sorted(shared), "tools": [narrow.title, broad.title],
                      "narrow_tool_active_users": u["seats_active_90d"]},
        ))
    return out


def duplicate_subscriptions(d: Data) -> list[Finding]:
    """Same company (after vendor matching), same category, same country, two contracts."""
    groups: dict[tuple, list[Contract]] = defaultdict(list)
    for c in d.contracts.values():
        if c.id in d.licences:
            groups[(d.canonical(c), c.service_category, d.country(c))].append(c)
    out = []
    for contracts in groups.values():
        if len(contracts) < 2:
            continue
        target = min(contracts, key=lambda c: c.unit_price)          # keep the cheapest contract
        for src in (c for c in contracts if c.id != target.id):
            shared = len(d.users(src.id) & d.users(target.id))
            assigned = d.usage(src.id)["seats_assigned"]
            src_annual = to_kes(src.quantity * src.unit_price * 12, src.currency)
            moved = to_kes((assigned - shared) * target.unit_price * 12, target.currency)
            saving = round(src_annual - moved, 2)
            names = sorted({d.vendors[src.vendor_id].name, d.vendors[target.vendor_id].name})
            out.append(_finding(
                type=FindingType.duplicate_subscription,
                title=(f"{d.licences[src.id].product_name.split()[0]} bought twice: {d.depts[target.department_id].name} "
                       f"and {d.depts[src.department_id].name} hold separate contracts"),
                explanation=(f"{' and '.join(repr(n) for n in names)} are the same company. "
                             f"{d.depts[src.department_id].name} pays {src.currency.value} {src.unit_price}/seat while "
                             f"{d.depts[target.department_id].name} pays {target.currency.value} {target.unit_price}/seat, and "
                             f"{shared} people hold a seat on both. Moving them onto one contract saves {_kes(saving)} a year."),
                amount_at_issue_kes=src_annual, est_saving_kes=saving, saving_basis="annual", confidence=0.85,
                department_id=src.department_id, vendor_ids=[target.vendor_id, src.vendor_id],
                contract_ids=[target.id, src.id], licence_ids=[d.licences[target.id].id, d.licences[src.id].id],
                evidence={"shared_users": shared, "unit_price": {target.id: target.unit_price, src.id: src.unit_price},
                          "seats_paid": {target.id: target.quantity, src.id: src.quantity}},
            ))
    return out


def overbilling(d: Data) -> list[Finding]:
    by_contract: dict[str, list[Invoice]] = defaultdict(list)
    for i in d.invoices:
        c = d.contracts.get(i.contract_id) if i.contract_id else None
        if c and c.billing_cycle in (BillingCycle.monthly, BillingCycle.annual) and i.unit_price > c.unit_price * (1 + PRICE_TOLERANCE):
            by_contract[c.id].append(i)
    out = []
    for cid, invs in by_contract.items():
        c = d.contracts[cid]
        invs.sort(key=lambda i: i.invoice_date)
        over = sum((i.unit_price - c.unit_price) * i.quantity for i in invs)
        saving = to_kes(over, c.currency)
        cur = c.currency.value
        out.append(_finding(
            type=FindingType.overbilling,
            title=f"{d.vendor_name(c)} billed above contract rate for {len(invs)} months",
            explanation=(f"The contract fixes {c.title} at {cur} {c.unit_price:,.0f} per {c.unit.split('/')[0]} per month. "
                         f"Since {invs[0].invoice_date:%B %Y}, invoices charge {cur} {invs[0].unit_price:,.0f}. "
                         f"The overcharge so far is {cur} {over:,.0f} ({_kes(saving)}), recoverable as a credit note."),
            amount_at_issue_kes=saving, est_saving_kes=saving, saving_basis="one_time", confidence=0.95,
            department_id=c.department_id, vendor_ids=[c.vendor_id], contract_ids=[cid], invoice_ids=[i.id for i in invs],
            evidence={"contract_unit_price": c.unit_price, "invoiced_unit_price": invs[0].unit_price, "currency": cur,
                      "months_affected": len(invs), "overcharge": over,
                      "contract_clause": f"Unit price is fixed at {cur} {c.unit_price:.0f} per user per month for the initial term."},
        ))
    return out


def duplicate_invoices(d: Data) -> list[Finding]:
    out = []
    invs = sorted(d.invoices, key=lambda i: (i.vendor_id, i.invoice_date))
    for a, b in zip(invs, invs[1:]):
        if (a.vendor_id == b.vendor_id and a.amount == b.amount and a.invoice_number != b.invoice_number
                and (b.invoice_date - a.invoice_date).days <= DUPLICATE_INVOICE_DAYS):
            saving = to_kes(b.amount, b.currency)
            v = d.vendors[a.vendor_id]
            out.append(_finding(
                type=FindingType.duplicate_invoice,
                title=f"{(v.canonical_name or v.name).split()[0]} {a.invoice_date:%B} invoice billed twice",
                explanation=(f"Invoices {a.invoice_number} and {b.invoice_number} carry the same amount "
                             f"({a.currency.value} {a.amount:,.0f}) {(b.invoice_date - a.invoice_date).days} days apart. "
                             f"One should be blocked or refunded."),
                amount_at_issue_kes=saving, est_saving_kes=saving, saving_basis="one_time", confidence=0.97,
                department_id=a.department_id, vendor_ids=[a.vendor_id], contract_ids=[a.contract_id] if a.contract_id else [],
                invoice_ids=[a.id, b.id],
                evidence={"invoice_numbers": [a.invoice_number, b.invoice_number], "days_apart": (b.invoice_date - a.invoice_date).days},
            ))
    return out


def anomalies(d: Data) -> list[Finding]:
    """A month far above the vendor's usual bill: at least ANOMALY_RATIO x the median and a robust z above ANOMALY_MAD_Z."""
    series: dict[tuple, list[Invoice]] = defaultdict(list)
    for i in d.invoices:
        series[(i.vendor_id, i.contract_id)].append(i)
    out = []
    for (vid, cid), invs in series.items():
        if len(invs) < 6:
            continue
        invs.sort(key=lambda i: i.invoice_date)
        amounts = [i.amount for i in invs]
        med = median(amounts)
        mad = median(abs(x - med) for x in amounts) or 1.0
        for i in invs:
            z = 0.6745 * (i.amount - med) / mad
            if i.amount >= ANOMALY_RATIO * med and z > ANOMALY_MAD_Z:
                baseline = median(x.amount for x in invs if x is not i)
                excess = to_kes(i.amount - baseline, i.currency)
                v = d.vendors[vid]
                name = v.canonical_name or v.name
                short = "AWS" if name == "Amazon Web Services" else name.split()[0]
                out.append(_finding(
                    type=FindingType.anomaly,
                    title=f"{short} bill {i.amount / baseline:.1f}x normal in {i.invoice_date:%B %Y}",
                    explanation=(f"{short} usually bills about {i.currency.value} {baseline:,.0f} a month. "
                                 f"{i.invoice_date:%B} came to {i.currency.value} {i.amount:,.0f}, {_kes(excess)} above normal. "
                                 f"The cause is unknown until someone checks the usage report."),
                    amount_at_issue_kes=excess, est_saving_kes=0.0, saving_basis="none", confidence=0.6,
                    department_id=i.department_id, vendor_ids=[vid], contract_ids=[cid] if cid else [], invoice_ids=[i.id],
                    evidence={"monthly": [{"month": f"{x.invoice_date:%Y-%m}", "amount": x.amount} for x in invs],
                              "currency": i.currency.value, "baseline": baseline, "robust_z": round(z, 1)},
                ))
    return out


def renewals_due(d: Data, others: list[Finding]) -> list[Finding]:
    """Auto-renewing contract, notice deadline within the window, and another open finding on it: act before the deadline."""
    flagged = defaultdict(list)
    for f in others:
        for cid in f.contract_ids[:1]:  # the contract the finding is mainly about
            flagged[cid].append(f)
    out = []
    for c in d.contracts.values():
        deadline = c.end_date - timedelta(days=c.notice_days)
        days = (deadline - DEMO_TODAY).days
        if not c.auto_renew or not (0 <= days <= RENEWAL_NOTICE_WITHIN_DAYS) or c.id not in flagged:
            continue
        annual = to_kes(c.unit_price * c.quantity * 12 if c.billing_cycle == BillingCycle.monthly else c.unit_price * c.quantity, c.currency)
        out.append(_finding(
            type=FindingType.renewal_due,
            title=f"{d.vendor_name(c).split()[0]} auto-renews on {c.end_date:%d %b %Y}; notice due by {deadline:%d %b}",
            explanation=(f"The {c.title} contract renews automatically unless notice is given {c.notice_days} days before "
                         f"{c.end_date:%d %B %Y}. That leaves {days} days to act on the open findings for this contract."),
            amount_at_issue_kes=annual, est_saving_kes=0.0, saving_basis="none", confidence=1.0,
            department_id=c.department_id, vendor_ids=[c.vendor_id], contract_ids=[c.id],
            evidence={"end_date": c.end_date.isoformat(), "notice_deadline": deadline.isoformat(),
                      "days_to_notice_deadline": days, "auto_renew": c.auto_renew},
            related_finding_ids=[],  # filled after ids are assigned
        ))
        out[-1]._related_to = flagged[c.id]  # type: ignore[attr-defined]
    return out


# ---------- actions ----------

def _tier(kes: float) -> ApprovalTier:
    return ApprovalTier.cfo if kes >= CFO_APPROVAL_THRESHOLD_KES else ApprovalTier.manager


def propose_action(f: Finding, d: Data, n: int) -> Action:
    c = d.contracts[f.contract_ids[0]] if f.contract_ids else None
    kind, desc, draft = {
        FindingType.unused_licence: (ActionKind.reclaim_seats,
            f"Reduce to {f.evidence.get('seats_active_90d')} seats at renewal and remove inactive users now", None),
        FindingType.vendor_overlap: (ActionKind.cancel_subscription,
            "Move remaining users to the tool already licensed and cancel at renewal", None),
        FindingType.duplicate_subscription: (ActionKind.consolidate_vendor,
            "Move users onto the cheaper contract and end the second one", None),
        FindingType.overbilling: (ActionKind.dispute_invoice, "Request a credit note and correct future invoices",
            (f"Subject: Invoice dispute – {c.title if c else ''} unit price\n\nHello,\n\nOur contract fixes the unit price at "
             f"{f.evidence.get('currency')} {f.evidence.get('contract_unit_price')}. Recent invoices charge "
             f"{f.evidence.get('currency')} {f.evidence.get('invoiced_unit_price')}. Please issue a credit note for "
             f"{f.evidence.get('currency')} {f.evidence.get('overcharge', 0):,.0f} and correct future invoices.\n\nRegards,\nAccounts Payable")),
        FindingType.duplicate_invoice: (ActionKind.block_duplicate_payment,
            f"Block payment of duplicate invoice {f.evidence.get('invoice_numbers', ['', ''])[1]}", None),
        FindingType.anomaly: (ActionKind.investigate, "Ask the owning team to explain the usage behind this bill", None),
        FindingType.renewal_due: (ActionKind.renegotiate,
            f"Give notice or renegotiate before {f.evidence.get('notice_deadline')}",
            (f"Renegotiation brief: {c.title if c else ''}\n\n- Current: {c.quantity if c else ''} units at {c.currency.value if c else ''} "
             f"{c.unit_price if c else ''}\n- Open findings: {', '.join(f.related_finding_ids)}\n- Deadline: notice by "
             f"{f.evidence.get('notice_deadline')}")),
    }[f.type]
    return Action(id=f"act_{n:03d}", finding_id=f.id, kind=kind, description=desc, est_saving_kes=f.est_saving_kes,
                  approval_tier=_tier(f.est_saving_kes), draft=draft)


# ---------- run ----------

def detect(s: Session) -> tuple[list[Finding], list[Action]]:
    d = Data(s)
    unused = unused_licences(d)
    found = unused + vendor_overlaps(d, unused) + duplicate_subscriptions(d) + overbilling(d) + duplicate_invoices(d) + anomalies(d)
    renewals = renewals_due(d, found)
    for n, f in enumerate(found + renewals, start=1):
        f.id = f"fnd_{n:03d}"
    for r in renewals:  # link renewals to the findings that make the deadline matter
        r.related_finding_ids = [f.id for f in r._related_to]  # type: ignore[attr-defined]
        for f in r._related_to:  # type: ignore[attr-defined]
            f.related_finding_ids = sorted(set(f.related_finding_ids) | {r.id})
    # link findings on the same contract to each other
    for a, b in combinations(found, 2):
        if a.contract_ids and b.contract_ids and a.contract_ids[0] == b.contract_ids[0]:
            a.related_finding_ids = sorted(set(a.related_finding_ids) | {b.id})
            b.related_finding_ids = sorted(set(b.related_finding_ids) | {a.id})
    findings = found + renewals
    actions = [propose_action(f, d, n) for n, f in enumerate(findings, start=1)]
    return findings, actions


def run_engine(s: Session) -> dict[str, int]:
    """Clear old findings and actions, detect again, save. Returns counts by type."""
    s.exec(delete(Action))
    s.exec(delete(Finding))
    findings, actions = detect(s)
    for f in findings:
        f.__dict__.pop("_related_to", None)
    s.add_all(findings)
    s.flush()
    s.add_all(actions)
    s.commit()
    counts: dict[str, int] = defaultdict(int)
    for f in findings:
        counts[f.type.value] += 1
    return dict(counts)
