"""Ground-truth findings and actions for the planted problems.

Until the detection engine exists, the API serves these so the frontend has real
shapes and numbers to build against. Once the engine is written, tests compare its
output to this file: every planted problem must be found, with the same savings.
All figures are computed from the generated data, never typed by hand.
"""
from datetime import datetime, timedelta
from statistics import median

from app.models import (
    Action, ActionKind, ActionStatus, ApprovalTier, Finding, FindingStatus, FindingType,
)
from app.settings import ACTIVE_WINDOW_DAYS, CFO_APPROVAL_THRESHOLD_KES, DEMO_TODAY, TZ, to_kes
from scripts.generate import (
    AWS_SPIKE_MONTH, LIQUID_DUPLICATE_MONTH, SFDC_OVERBILL_FROM, Dataset,
)

DETECTED_AT = datetime.combine(DEMO_TODAY, datetime.min.time(), tzinfo=TZ).replace(hour=8)


def _tier(saving_kes: float) -> ApprovalTier:
    return ApprovalTier.cfo if saving_kes >= CFO_APPROVAL_THRESHOLD_KES else ApprovalTier.manager


def _kes(x: float) -> str:
    return f"KES {x:,.0f}"


def build(ds: Dataset) -> tuple[list[Finding], list[Action]]:
    contracts = {c.id: c for c in ds.contracts}
    licences = {l.contract_id: l for l in ds.licences}
    cutoff = DEMO_TODAY - timedelta(days=ACTIVE_WINDOW_DAYS)

    def seats(contract_id: str) -> dict:
        lic = licences[contract_id]
        rows = [a for a in ds.assignments if a.licence_id == lic.id]
        return {
            "seats_paid": lic.seats_paid,
            "seats_assigned": len(rows),
            "seats_active_90d": sum(1 for a in rows if a.last_login_date and a.last_login_date >= cutoff),
            "never_signed_in": sum(1 for a in rows if a.last_login_date is None),
            "users": {a.employee_id for a in rows},
        }

    findings: list[Finding] = []
    actions: list[Action] = []

    # 1. Zoom unused seats
    zoom = contracts["con_zoom_mkt"]
    z = seats(zoom.id)
    idle = z["seats_paid"] - z["seats_active_90d"]
    f1_saving = to_kes(idle * zoom.unit_price * 12, zoom.currency)
    findings.append(Finding(
        id="fnd_001", type=FindingType.unused_licence,
        title=f"{idle} of {z['seats_paid']} Zoom seats unused in the last 90 days",
        explanation=(f"Marketing pays for {z['seats_paid']} Zoom Business seats. Only {z['seats_active_90d']} people signed in "
                     f"in the last {ACTIVE_WINDOW_DAYS} days, and {z['never_signed_in']} assigned users never signed in. "
                     f"Cutting to active users saves {_kes(f1_saving)} a year."),
        amount_at_issue_kes=f1_saving, est_saving_kes=f1_saving, saving_basis="annual", confidence=0.9,
        department_id=zoom.department_id, vendor_ids=[zoom.vendor_id], contract_ids=[zoom.id],
        licence_ids=[licences[zoom.id].id], related_finding_ids=["fnd_002", "fnd_007"],
        evidence={k: v for k, v in z.items() if k != "users"}, detected_at=DETECTED_AT,
    ))

    # 2. Zoom overlaps Teams
    m365 = contracts["con_m365_ke"]
    f2_saving = to_kes(z["seats_active_90d"] * zoom.unit_price * 12, zoom.currency)
    zoom_annual = to_kes(zoom.quantity * zoom.unit_price * 12, zoom.currency)
    findings.append(Finding(
        id="fnd_002", type=FindingType.vendor_overlap,
        title="Zoom duplicates video calling already paid for in Microsoft 365",
        explanation=(f"Every Kenya staff member already has Microsoft Teams through the Microsoft 365 E3 agreement "
                     f"({m365.quantity} seats). The {z['seats_active_90d']} active Zoom users could move to Teams, "
                     f"saving a further {_kes(f2_saving)} a year on top of the unused seats."),
        amount_at_issue_kes=zoom_annual, est_saving_kes=f2_saving, saving_basis="annual", confidence=0.7,
        department_id=zoom.department_id, vendor_ids=[zoom.vendor_id, m365.vendor_id], contract_ids=[zoom.id, m365.id],
        licence_ids=[licences[zoom.id].id, licences[m365.id].id], related_finding_ids=["fnd_001"],
        evidence={"shared_capability": "video_conferencing", "tools": ["Zoom Business", "Microsoft Teams (M365 E3)"],
                  "zoom_active_users": z["seats_active_90d"]},
        detected_at=DETECTED_AT,
    ))

    # 3. Jira bought twice
    jit, jdig = contracts["con_jira_it"], contracts["con_jira_dig"]
    a, b = seats(jit.id), seats(jdig.id)
    shared = len(a["users"] & b["users"])
    dig_annual = to_kes(jdig.quantity * jdig.unit_price * 12, jdig.currency)
    moved_cost = to_kes((b["seats_assigned"] - shared) * jit.unit_price * 12, jit.currency)
    f3_saving = round(dig_annual - moved_cost, 2)
    findings.append(Finding(
        id="fnd_003", type=FindingType.duplicate_subscription,
        title="Jira bought twice: IT and Digital Banking hold separate contracts",
        explanation=(f"Two vendor records ('Atlassian Pty Ltd' and 'ATLASSIAN PTY. LIMITED') are the same company. "
                     f"Digital Banking pays USD {jdig.unit_price}/seat while IT pays USD {jit.unit_price}/seat, and "
                     f"{shared} people hold a seat on both. Moving Digital's users onto IT's contract saves {_kes(f3_saving)} a year."),
        amount_at_issue_kes=dig_annual, est_saving_kes=f3_saving, saving_basis="annual", confidence=0.85,
        status=FindingStatus.actioned, department_id=jdig.department_id,
        vendor_ids=[jit.vendor_id, jdig.vendor_id], contract_ids=[jit.id, jdig.id],
        licence_ids=[licences[jit.id].id, licences[jdig.id].id],
        evidence={"shared_users": shared, "unit_price_usd": {jit.id: jit.unit_price, jdig.id: jdig.unit_price},
                  "seats_paid": {jit.id: jit.quantity, jdig.id: jdig.quantity}},
        detected_at=DETECTED_AT,
    ))

    # 4. Salesforce overbilling
    sfdc = contracts["con_sfdc"]
    over = [i for i in ds.invoices if i.contract_id == sfdc.id and i.unit_price > sfdc.unit_price]
    over_usd = sum((i.unit_price - sfdc.unit_price) * i.quantity for i in over)
    f4_saving = to_kes(over_usd, sfdc.currency)
    findings.append(Finding(
        id="fnd_004", type=FindingType.overbilling,
        title=f"Salesforce billed above contract rate for {len(over)} months",
        explanation=(f"The contract fixes Sales Cloud at USD {sfdc.unit_price:.0f} per user per month for the initial term. "
                     f"Since {SFDC_OVERBILL_FROM:%B %Y}, invoices charge USD {over[0].unit_price:.0f}. "
                     f"The overcharge so far is USD {over_usd:,.0f} ({_kes(f4_saving)}), recoverable as a credit note."),
        amount_at_issue_kes=f4_saving, est_saving_kes=f4_saving, saving_basis="one_time", confidence=0.95,
        status=FindingStatus.actioned, department_id=sfdc.department_id, vendor_ids=[sfdc.vendor_id],
        contract_ids=[sfdc.id], invoice_ids=[i.id for i in over],
        evidence={"contract_unit_price_usd": sfdc.unit_price, "invoiced_unit_price_usd": over[0].unit_price,
                  "months_affected": len(over), "overcharge_usd": over_usd,
                  "contract_clause": f"Unit price is fixed at USD {sfdc.unit_price:.0f} per user per month for the initial term."},
        detected_at=DETECTED_AT,
    ))

    # 5. Liquid duplicate invoice
    liquid = contracts["con_liquid"]
    pair = [i for i in ds.invoices if i.contract_id == liquid.id
            and i.invoice_date.year == LIQUID_DUPLICATE_MONTH.year and i.invoice_date.month == LIQUID_DUPLICATE_MONTH.month]
    f5_saving = to_kes(pair[1].amount, pair[1].currency)
    findings.append(Finding(
        id="fnd_005", type=FindingType.duplicate_invoice,
        title=f"Liquid {LIQUID_DUPLICATE_MONTH:%B} invoice billed twice",
        explanation=(f"Invoices {pair[0].invoice_number} and {pair[1].invoice_number} carry the same amount "
                     f"({_kes(pair[0].amount)}) and description, three days apart. One should be blocked or refunded."),
        amount_at_issue_kes=f5_saving, est_saving_kes=f5_saving, saving_basis="one_time", confidence=0.97,
        status=FindingStatus.actioned, department_id=liquid.department_id, vendor_ids=[liquid.vendor_id],
        contract_ids=[liquid.id], invoice_ids=[i.id for i in pair],
        evidence={"invoice_numbers": [i.invoice_number for i in pair], "days_apart": (pair[1].invoice_date - pair[0].invoice_date).days},
        detected_at=DETECTED_AT,
    ))

    # 6. AWS spike
    aws = contracts["con_aws"]
    aws_inv = sorted((i for i in ds.invoices if i.contract_id == aws.id), key=lambda i: i.invoice_date)
    spike = next(i for i in aws_inv if i.invoice_date.month == AWS_SPIKE_MONTH.month and i.invoice_date.year == AWS_SPIKE_MONTH.year)
    baseline = median(i.amount for i in aws_inv if i is not spike)
    excess_kes = to_kes(spike.amount - baseline, aws.currency)
    findings.append(Finding(
        id="fnd_006", type=FindingType.anomaly,
        title=f"AWS bill {spike.amount / baseline:.1f}x normal in {AWS_SPIKE_MONTH:%B %Y}",
        explanation=(f"AWS usually bills about USD {baseline:,.0f} a month. {AWS_SPIKE_MONTH:%B} came to USD {spike.amount:,.0f}, "
                     f"{_kes(excess_kes)} above normal. The cause is unknown until someone checks the usage report."),
        amount_at_issue_kes=excess_kes, est_saving_kes=0.0, saving_basis="none", confidence=0.6,
        department_id=aws.department_id, vendor_ids=[aws.vendor_id], contract_ids=[aws.id], invoice_ids=[spike.id],
        evidence={"monthly_usd": [{"month": f"{i.invoice_date:%Y-%m}", "amount": i.amount} for i in aws_inv],
                  "baseline_usd": baseline},
        detected_at=DETECTED_AT,
    ))

    # 7. Zoom renewal
    notice_deadline = zoom.end_date - timedelta(days=zoom.notice_days)
    findings.append(Finding(
        id="fnd_007", type=FindingType.renewal_due,
        title=f"Zoom auto-renews on {zoom.end_date:%d %b %Y}; notice due by {notice_deadline:%d %b}",
        explanation=(f"The Zoom contract renews automatically for another term unless notice is given "
                     f"{zoom.notice_days} days before {zoom.end_date:%d %B %Y}. That leaves "
                     f"{(notice_deadline - DEMO_TODAY).days} days to act on the unused seats and the Teams overlap."),
        amount_at_issue_kes=zoom_annual, est_saving_kes=0.0, saving_basis="none", confidence=1.0,
        department_id=zoom.department_id, vendor_ids=[zoom.vendor_id], contract_ids=[zoom.id],
        related_finding_ids=["fnd_001", "fnd_002"],
        evidence={"end_date": zoom.end_date.isoformat(), "notice_deadline": notice_deadline.isoformat(),
                  "days_to_notice_deadline": (notice_deadline - DEMO_TODAY).days, "auto_renew": zoom.auto_renew},
        detected_at=DETECTED_AT,
    ))

    decided = DETECTED_AT - timedelta(days=6)
    actions += [
        Action(id="act_001", finding_id="fnd_001", kind=ActionKind.reclaim_seats,
               description=f"Reduce Zoom to {z['seats_active_90d']} seats at renewal and remove inactive users now",
               est_saving_kes=f1_saving, approval_tier=_tier(f1_saving),
               draft=(f"Subject: Zoom Business – seat reduction at renewal\n\nHello Zoom team,\n\nAhead of our renewal on "
                      f"{zoom.end_date:%d %B %Y}, NCBA will reduce its Zoom Business subscription from {zoom.quantity} to "
                      f"{z['seats_active_90d']} seats. Please confirm the revised quote.\n\nRegards,\nProcurement")),
        Action(id="act_002", finding_id="fnd_002", kind=ActionKind.cancel_subscription,
               description=f"Move remaining Zoom users to Microsoft Teams and give notice before {notice_deadline:%d %b %Y}",
               est_saving_kes=f2_saving, approval_tier=_tier(f2_saving)),
        Action(id="act_003", finding_id="fnd_003", kind=ActionKind.consolidate_vendor,
               description="Move Digital Banking's Jira users onto IT's enterprise contract and end the team plan",
               est_saving_kes=f3_saving, approval_tier=_tier(f3_saving), status=ActionStatus.done,
               approver="Head of IT Procurement", decided_at=decided, realised_saving_kes=f3_saving),
        Action(id="act_004", finding_id="fnd_004", kind=ActionKind.dispute_invoice,
               description=f"Request a credit note of USD {over_usd:,.0f} and correct future invoices to USD {sfdc.unit_price:.0f}",
               est_saving_kes=f4_saving, approval_tier=_tier(f4_saving), status=ActionStatus.done,
               approver="Accounts Payable Manager", decided_at=decided, realised_saving_kes=f4_saving,
               draft=(f"Subject: Invoice dispute – Sales Cloud unit price\n\nHello Salesforce billing team,\n\nOur contract fixes "
                      f"Sales Cloud Enterprise at USD {sfdc.unit_price:.0f} per user per month. Invoices since "
                      f"{SFDC_OVERBILL_FROM:%B %Y} charge USD {over[0].unit_price:.0f}. Please issue a credit note for "
                      f"USD {over_usd:,.0f} and correct future invoices.\n\nRegards,\nAccounts Payable")),
        Action(id="act_005", finding_id="fnd_005", kind=ActionKind.block_duplicate_payment,
               description=f"Block payment of duplicate invoice {pair[1].invoice_number}",
               est_saving_kes=f5_saving, approval_tier=_tier(f5_saving), status=ActionStatus.done,
               approver="Accounts Payable Manager", decided_at=decided, realised_saving_kes=f5_saving),
        Action(id="act_006", finding_id="fnd_006", kind=ActionKind.investigate,
               description=f"Ask the Digital Banking platform team to explain the {AWS_SPIKE_MONTH:%B} AWS usage",
               est_saving_kes=0.0, approval_tier=ApprovalTier.manager),
        Action(id="act_007", finding_id="fnd_007", kind=ActionKind.renegotiate,
               description=f"Send the renegotiation brief to the Zoom account manager before {notice_deadline:%d %b %Y}",
               est_saving_kes=0.0, approval_tier=ApprovalTier.manager,
               draft=(f"Renegotiation brief: Zoom Business\n\n- Current: {zoom.quantity} seats at USD {zoom.unit_price:.0f}/seat/month "
                      f"({_kes(zoom_annual)} a year)\n- Active users (90 days): {z['seats_active_90d']}\n- Overlap: Microsoft Teams "
                      f"already licensed for all Kenya staff\n- Position: renew at most {z['seats_active_90d']} seats, or exit\n"
                      f"- Deadline: notice by {notice_deadline:%d %B %Y}")),
    ]
    return findings, actions
